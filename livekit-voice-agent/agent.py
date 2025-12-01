from dotenv import load_dotenv
import json
import asyncio
import time

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, get_job_context, function_tool, RunContext
from livekit.agents.llm import ChatContext, ImageContent
from livekit.plugins import noise_cancellation, silero, openai, anam
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")

class ProctorAgent(Agent):
    def __init__(self, session: AgentSession, llm_instance: openai.LLM) -> None:
        super().__init__(
            instructions="""You are a professional exam proctor. Your role is to:
1. Greet the user warmly and ask them how they are doing
2. Ask them to please share their screen so you can monitor the quiz (they can use the screen share button in the interface)
3. Wait for them to confirm they have shared their screen
4. When they confirm, call the show_quiz_link tool to display the quiz link
5. After the quiz link is shown, wish them good luck with a brief, encouraging message like "Good luck! Take your time, read each question carefully, and do your best. I'll be here monitoring if you need anything."
6. Once you've wished them luck, remain SILENT and observe. Do not speak during the quiz.
7. When the user says they are done with the quiz (e.g., "I'm done", "I finished", "I completed it"), call the check_quiz_score tool. Once the tool returns the score, congratulate them warmly and announce their score in a natural, enthusiastic way.
8. Act professionally and maintain a quiet, focused environment.""",
        )
        self._session = session
        self._llm = llm_instance
        self._latest_camera_frame = None
        self._latest_screen_frame = None
        self._camera_stream = None
        self._screen_stream = None
        self._monitoring_task = None
        self._tasks = []  # Prevent garbage collection of running tasks
        self.is_proctoring = False
        self._quiz_completed = False  # Track if we've already announced quiz completion
        self._phone_detected = False  # Track if we've already detected a phone (stop monitoring after first detection)

    # --- QUIZ LINK TOOL ---
    @function_tool()
    async def show_quiz_link(self, context: RunContext) -> str:
        """Call this when the user confirms they have shared their screen and are ready to take the quiz. This will display a popup with a link to the quiz website."""
        # Provide immediate verbal feedback to eliminate awkward silence
        await context.session.say("Perfect! I'm setting up your quiz now. You'll see a link appear on your screen in just a moment. Once you click it, the quiz will open in a new tab.", allow_interruptions=False)
        
        # Start monitoring when quiz link is shown (camera for phones only)
        if not self.is_proctoring:
            self.is_proctoring = True
            self._quiz_completed = False
            self._monitoring_task = asyncio.create_task(self._monitor_phone())
        
        room = get_job_context().room
        user_participant = self._get_user_participant()
        
        if not user_participant:
            return "Error: Could not find user participant. Please ensure you are connected."
        
        try:
            # Quiz is a standalone page - user will screen share from NextJS frontend
            quiz_url = "http://localhost:3001"
            
            await room.local_participant.perform_rpc(
                destination_identity=user_participant.identity,
                method="frontend.showQuizLink",
                payload=json.dumps({"quizUrl": quiz_url}),
                response_timeout=5.0
            )
            return "Quiz link popup displayed. Now wish the user good luck with a brief, encouraging message."
        except Exception as e:
            # If RPC fails, return error message that the LLM can communicate
            error_msg = f"Unable to display quiz link popup. Please refresh the page and try again. Error: {str(e)}"
            return error_msg

    # --- CHECK QUIZ SCORE TOOL ---
    @function_tool()
    async def check_quiz_score(self, context: RunContext) -> str:
        """Call this when the user says they are done with the quiz. This will check their screen share once to read the score and return it. The agent will then announce the score naturally."""
        if self._quiz_completed:
            return "Quiz score has already been announced."
        
        if not self._latest_screen_frame:
            return "Error: Screen share not available. Please make sure your screen is being shared so I can check your quiz score."
        
        # Check the screen and return whatever the vision LLM says
        response = await self._check_frame_with_llm(
            self._latest_screen_frame,
            "You are a proctor monitoring a quiz. Look at this screenshot of the quiz screen. The quiz completion screen will show 'Quiz Complete!' as a heading and display a score like 'X/4' or 'X out of 4'. If you see the quiz completion screen, respond with the score you see (e.g., '3 out of 4' or '4/4'). If the quiz is not complete, respond with 'The quiz is still in progress.'",
            inference_width=1024,
            inference_height=768
        )
        
        self._quiz_completed = True
        self._stop_monitoring()
        return response

    def _get_user_participant(self):
        """Get the user participant object, filtering out avatars."""
        room = get_job_context().room
        remote_participants = list(room.remote_participants.values())
        if not remote_participants:
            return None
        
        # Try to find user participant (not avatar)
        for participant in remote_participants:
            if participant.identity.startswith("voice_assistant_user_"):
                return participant
        
        # Fallback to first participant if no user participant found
        return remote_participants[0] if remote_participants else None
    

    async def on_enter(self):
        """Initialize video streams when agent joins. Camera is guaranteed to be on, screen share will start when quiz loads."""
        self._room = get_job_context().room
        
        # Find the user participant's tracks (camera and screen share)
        user_participant = self._get_user_participant()
        if not user_participant:
            return
        
        # Set up video track subscriptions (camera and screen share)
        @self._room.on("track_subscribed")
        def on_track_subscribed(track, publication, participant):
            # Only process video tracks from user participants
            if track.kind != rtc.TrackKind.KIND_VIDEO:
                return
            if not participant.identity.startswith("voice_assistant_user_"):
                return
            
            # Check if it's a screen share track and create appropriate stream
            is_screen_share = publication.source == rtc.TrackSource.SOURCE_SCREENSHARE
            self._create_video_stream(track, is_screen_share)
        
        # Check for existing tracks
        for publication in user_participant.track_publications.values():
            if publication.track and publication.track.kind == rtc.TrackKind.KIND_VIDEO:
                is_screen_share = publication.source == rtc.TrackSource.SOURCE_SCREENSHARE
                self._create_video_stream(publication.track, is_screen_share)
    
    def _stop_monitoring(self):
        """Stop monitoring and cancel the monitoring task."""
        self.is_proctoring = False
        if self._monitoring_task:
            self._monitoring_task.cancel()
            self._monitoring_task = None
    
    def _create_video_stream(self, track: rtc.Track, is_screen_share: bool):
        """Helper method to buffer the latest video frame from a video track"""
        stream_attr = "_screen_stream" if is_screen_share else "_camera_stream"
        frame_attr = "_latest_screen_frame" if is_screen_share else "_latest_camera_frame"
        
        # Close existing stream
        existing_stream = getattr(self, stream_attr)
        if existing_stream is not None:
            task = asyncio.create_task(existing_stream.aclose())
            task.add_done_callback(lambda t: self._tasks.remove(t) if t in self._tasks else None)
            self._tasks.append(task)
        
        # Create new stream
        stream = rtc.VideoStream(track)
        setattr(self, stream_attr, stream)
        
        async def read_stream():
            async for event in stream:
                setattr(self, frame_attr, event.frame)
        
        task = asyncio.create_task(read_stream())
        task.add_done_callback(lambda t: self._tasks.remove(t) if t in self._tasks else None)
        self._tasks.append(task)

    async def _check_frame_with_llm(self, frame, system_prompt, inference_width=512, inference_height=512):
        """Helper to check a frame with LLM vision"""
        try:
            chat_ctx = ChatContext()
            chat_ctx.add_message(role="system", content=system_prompt)
            chat_ctx.add_message(role="user", content=[ImageContent(image=frame, inference_width=inference_width, inference_height=inference_height)])
            
            full_text = ""
            async for chunk in self._llm.chat(chat_ctx=chat_ctx):
                full_text += str(chunk)
            return full_text
        except Exception:
            return ""

    async def _monitor_phone(self):
        """Monitor camera for phones - stops after first detection"""
        last_phone_check = 0.0
        
        PHONE_CHECK_INTERVAL = 6.0
        
        while True:
            await asyncio.sleep(3.0)
            if not self.is_proctoring or self._phone_detected:
                continue
            
            current_time = time.time()
            
            # Check for phone in camera feed
            if (current_time - last_phone_check) >= PHONE_CHECK_INTERVAL:
                last_phone_check = current_time
                if self._latest_camera_frame:
                    response = await self._check_frame_with_llm(
                        self._latest_camera_frame,
                        "You are a proctor. Look at this image and determine if there is a smartphone, mobile phone, or phone visible. The person might be holding it. Note: You will likely see the BACK of the phone (the rear case/camera area), not the screen. Look for rectangular devices that appear to be phones being held. Respond ONLY with 'PHONE_DETECTED' or 'CLEAR' - nothing else."
                    )
                    if "PHONE_DETECTED" in response.upper() or "PHONE" in response.upper():
                        self._phone_detected = True
                        await self._session.say("I've detected a phone in view. Please put it away immediately so we can maintain quiz integrity. Thank you for your cooperation.", allow_interruptions=False, add_to_chat_ctx=False)
                        # Stop monitoring after first detection
                        break


# --- MAIN ENTRY POINT ---

server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        stt="assemblyai/universal-streaming:en",
        llm="openai/gpt-4o-mini",
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )
    vision_llm = openai.LLM(model="gpt-4o-mini")
    assistant = ProctorAgent(session, vision_llm)

    # ANAM avatar
    avatar = anam.AvatarSession(
        persona_config=anam.PersonaConfig(
            name="Quiz Proctor",
            avatarId="30fa96d0-26c4-4e55-94a0-517025942e18",  
        ),
    )
    await avatar.start(session, room=ctx.room)
    
    await session.start(
        room=ctx.room,
        agent=assistant,
        room_options=room_io.RoomOptions(
            video_input=True,  # Critical: enables camera stream for proctoring
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
            ),
        ),
    )
    
    await session.generate_reply(
        instructions="Greet the user warmly in English. Sound professional but friendly. First ask how they are doing, then ask them to please share their screen so you can monitor them during the quiz. Say something like 'Hello! Welcome. How are you doing today? Before we begin, could you please share your screen? I'll need to monitor your screen during the quiz for proctoring purposes. You can use the screen share button in the interface.'"
    )

if __name__ == "__main__":
    agents.cli.run_app(server)
