from dotenv import load_dotenv
import json
import asyncio

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, get_job_context, function_tool, RunContext
from livekit.agents.llm import ChatContext, ImageContent
from livekit.rtc.rpc import RpcInvocationData
from livekit.plugins import noise_cancellation, silero, openai, anam
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")

class ProctorAgent(Agent):
    def __init__(self, session: AgentSession, llm_instance: openai.LLM) -> None:
        super().__init__(
            instructions="""You are a professional exam proctor. Your role is to:
1. Greet the user warmly and ask if they are ready to begin the quiz
2. When they say yes or indicate readiness, call the show_quiz_link tool to display the quiz link
3. After the quiz link is shown, wish them good luck with a brief, encouraging message like "Good luck! Take your time, read each question carefully, and do your best. I'll be here monitoring if you need anything."
4. Once you've wished them luck, remain SILENT and observe. Do not speak during the quiz.
5. Act professionally and maintain a quiet, focused environment.""",
        )
        self._session = session
        self._llm = llm_instance
        self._latest_frame = None
        self._video_stream = None
        self._phone_monitoring_task = None
        self._tasks = []  # Prevent garbage collection of running tasks
        self.is_proctoring = False

    # --- QUIZ LINK TOOL ---
    @function_tool()
    async def show_quiz_link(self, context: RunContext) -> str:
        """Call this when the user says they are ready to take the quiz. This will display a popup with a link to the quiz website."""
        # Provide immediate verbal feedback to eliminate awkward silence
        await context.session.say("Perfect! I'm setting up your quiz now. You'll see a link appear on your screen in just a moment. Once you click it, the quiz will open in a new tab.", allow_interruptions=False)
        
        # Start phone monitoring when quiz link is shown
        if not self.is_proctoring:
            self.is_proctoring = True
            self._phone_monitoring_task = asyncio.create_task(self._monitor_for_phone())
        
        room = get_job_context().room
        user_identity = self._get_user_identity()
        
        if not user_identity:
            return "Error: Could not find user participant. Please ensure you are connected."
        
        try:
            # Include room name in URL so quiz-frontend can join the same room
            room_name = room.name
            quiz_url = f"http://localhost:3001?room={room_name}"
            
            await room.local_participant.perform_rpc(
                destination_identity=user_identity,
                method="frontend.showQuizLink",
                payload=json.dumps({"quizUrl": quiz_url, "roomName": room_name}),
                response_timeout=5.0
            )
            return "Quiz link popup displayed. Now wish the user good luck with a brief, encouraging message."
        except Exception as e:
            # If RPC fails, return error message that the LLM can communicate
            error_msg = f"Unable to display quiz link popup. Please refresh the page and try again. Error: {str(e)}"
            return error_msg

    def _get_user_identity(self):
        """Get the user participant identity, filtering out avatars."""
        room = get_job_context().room
        for identity in room.remote_participants:
            if identity.startswith("voice_assistant_user_"):
                return identity
        return next(iter(room.remote_participants), None)

    async def on_enter(self):
        """Initialize video stream when agent joins. User always joins first, so tracks should already be available."""
        self._room = get_job_context().room
        
        # Since user joins first, check for already-subscribed video tracks
        # (autoSubscribe is enabled by default, so tracks should be subscribed)
        def find_and_setup_video_track():
            remote_participants = list(self._room.remote_participants.values())
            if not remote_participants:
                return None
            
            # Get the user participant (not avatar)
            user_participant = None
            for participant in remote_participants:
                if not participant.identity.startswith("voice_assistant_user_"):
                    continue
                user_participant = participant
                break
            
            if not user_participant:
                user_participant = remote_participants[0]
            
            # Look for subscribed video track first (most common case)
            for publication in user_participant.track_publications.values():
                if (publication.track and 
                    publication.track.kind == rtc.TrackKind.KIND_VIDEO):
                    return publication.track
            
            return None
        
        # Try to find video track immediately
        video_track = find_and_setup_video_track()
        if video_track:
            self._create_video_stream(video_track)
        
        # Watch for video tracks that get subscribed later
        # (handles case where user enables camera after bot joins, or timing edge cases)
        @self._room.on("track_subscribed")
        def on_track_subscribed(track, publication, participant):
            # Only process video tracks from user participants (not avatars)
            if track.kind != rtc.TrackKind.KIND_VIDEO:
                return
            # Skip avatar participants - we only want user video
            if participant.identity.startswith("voice_assistant_user_"):
                self._create_video_stream(track)
    
    def _create_video_stream(self, track: rtc.Track):
        """Helper method to buffer the latest video frame from the user's track"""
        # Close any existing stream (we only want one at a time)
        if self._video_stream is not None:
            self._video_stream.close()
        
        # Create a new stream to receive frames
        self._video_stream = rtc.VideoStream(track)
        async def read_stream():
            async for event in self._video_stream:
                # Store the latest frame for use later
                self._latest_frame = event.frame
        
        # Store the async task to prevent garbage collection
        task = asyncio.create_task(read_stream())
        task.add_done_callback(lambda t: self._tasks.remove(t) if t in self._tasks else None)
        self._tasks.append(task)

    async def _monitor_for_phone(self):
        while True:
            await asyncio.sleep(3.0)
            if not self.is_proctoring or not self._latest_frame:
                continue
            try:
                chat_ctx = ChatContext()
                chat_ctx.add_message(role="system", content="You are a proctor. Look at this image and determine if there is a smartphone, mobile phone, or phone visible. The person might be holding it. Note: You will likely see the BACK of the phone (the rear case/camera area), not the screen. Look for rectangular devices that appear to be phones being held. Respond ONLY with 'PHONE_DETECTED' or 'CLEAR' - nothing else.")
                chat_ctx.add_message(role="user", content=[ImageContent(image=self._latest_frame, inference_width=512, inference_height=512)])
                
                full_text = ""
                async for chunk in self._llm.chat(chat_ctx=chat_ctx):
                    full_text += str(chunk)
                
                if "PHONE_DETECTED" in full_text.upper() or "PHONE" in full_text.upper():
                    room = get_job_context().room
                    
                    # Show warning modal only on quiz-frontend (participants without video tracks)
                    for participant_identity, participant in room.remote_participants.items():
                        if not participant_identity.startswith("voice_assistant_user_"):
                            continue  # Skip non-user participants
                        # Quiz-frontend doesn't publish video, nextjs-frontend does
                        has_video = any(
                            pub.track and pub.track.kind == rtc.TrackKind.KIND_VIDEO
                            for pub in participant.track_publications.values()
                        )
                        if not has_video:  # This is quiz-frontend (no video published)
                            try:
                                await room.local_participant.perform_rpc(
                                    destination_identity=participant_identity,
                                    method="frontend.showPhoneWarning",
                                    payload="{}",
                                    response_timeout=5.0
                                )
                            except Exception:
                                pass  # Don't fail if RPC fails
                    
                    # Speak the warning
                    await self._session.say("I've detected a phone in view. Please put it away immediately so we can maintain quiz integrity. Thank you for your cooperation.", allow_interruptions=False, add_to_chat_ctx=False)
                    
                    # Hide warning modal after agent finishes speaking
                    await asyncio.sleep(1.5)  # Wait for speech to complete (reduced from 3.0)
                    for participant_identity, participant in room.remote_participants.items():
                        if not participant_identity.startswith("voice_assistant_user_"):
                            continue  # Skip non-user participants
                        has_video = any(
                            pub.track and pub.track.kind == rtc.TrackKind.KIND_VIDEO
                            for pub in participant.track_publications.values()
                        )
                        if not has_video:  # This is quiz-frontend
                            try:
                                await room.local_participant.perform_rpc(
                                    destination_identity=participant_identity,
                                    method="frontend.hidePhoneWarning",
                                    payload="{}",
                                    response_timeout=5.0
                                )
                            except Exception:
                                pass
            except Exception:
                pass

    # --- RPC HANDLERS ---

    async def handle_stop_monitoring(self, data: RpcInvocationData) -> str:
        """Frontend calls this when quiz ends to stop phone monitoring"""
        self.is_proctoring = False
        if self._phone_monitoring_task:
            self._phone_monitoring_task.cancel()
            self._phone_monitoring_task = None
        return json.dumps({"status": "monitoring_stopped"})

    async def handle_quiz_score(self, data: RpcInvocationData) -> str:
        """Frontend calls this when quiz completes, passing the score"""
        payload = json.loads(data.payload)
        score_text = payload.get("score", "0 out of 4")
        
        # Stop monitoring since quiz is done
        self.is_proctoring = False
        if self._phone_monitoring_task:
            self._phone_monitoring_task.cancel()
            self._phone_monitoring_task = None
        
        # Speak the score
        await self._session.say(f"Excellent work completing the quiz! You scored {score_text}. That's fantastic! Well done!", allow_interruptions=False, add_to_chat_ctx=True)
        
        return json.dumps({"status": "score_received"})

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
    
    # Register RPC handlers after session.start() (room is now connected)
    ctx.room.local_participant.register_rpc_method("backend.stopMonitoring", assistant.handle_stop_monitoring)
    ctx.room.local_participant.register_rpc_method("backend.quizScore", assistant.handle_quiz_score)
    
    await session.generate_reply(
        instructions="Greet the user warmly in English. Sound professional but friendly. Ask them if they are ready to begin the quiz. Say something like 'Hello! Welcome. Are you ready to begin the trivia quiz?'"
    )

if __name__ == "__main__":
    agents.cli.run_app(server)
