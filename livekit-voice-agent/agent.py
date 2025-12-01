from dotenv import load_dotenv
import asyncio

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, get_job_context, function_tool, RunContext
from livekit.agents.llm import ChatContext, ImageContent
from livekit.plugins import noise_cancellation, google, anam

load_dotenv(".env.local")

class ProctorAgent(Agent):
    def __init__(self, session: AgentSession) -> None:
        super().__init__()
        self._session = session
        self._latest_camera_frame = None
        self._monitoring_task = None

    # --- QUIZ LINK TOOL ---
    @function_tool()
    async def show_quiz_link(self, context: RunContext) -> str:
        """Call this when the user confirms they have shared their screen and are ready to take the quiz. This will display a popup with a link to the quiz website."""
        await context.session.say("Perfect! I'm setting up your quiz now. You'll see a link appear on your screen in just a moment. Once you click it, the quiz will open in a new tab.", allow_interruptions=False)
        
        self._monitoring_task = asyncio.create_task(self._monitor_phone())
        
        for participant in self._room.remote_participants.values():
            if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
                user_participant = participant
                break
        
        await self._room.local_participant.perform_rpc(
            destination_identity=user_participant.identity,
            method="frontend.showQuizLink"
        )
        
        return "Quiz link popup displayed. Now wish the user good luck with a brief, encouraging message."

    async def on_enter(self) -> None:
        """Initialize camera stream for phone monitoring. Gemini Live automatically handles screen share video."""
        self._room = get_job_context().room
        
        for participant in self._room.remote_participants.values():
            if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
                user_participant = participant
                break
        
        # Set up camera stream for phone monitoring (screen share is handled automatically by Gemini)
        @self._room.on("track_subscribed")
        def on_track_subscribed(track, publication, participant):
            if track.kind != rtc.TrackKind.KIND_VIDEO:
                return
            if participant.kind != rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
                return
            if publication.source == rtc.TrackSource.SOURCE_SCREENSHARE:
                return  # Gemini handles screen share automatically
            
            self._create_camera_stream(track)
        
        # Check for existing camera tracks
        for publication in user_participant.track_publications.values():
            if publication.track and publication.track.kind == rtc.TrackKind.KIND_VIDEO and publication.source != rtc.TrackSource.SOURCE_SCREENSHARE:
                self._create_camera_stream(publication.track)

    def _create_camera_stream(self, track: rtc.Track) -> None:
        """Helper method to buffer the latest camera frame for phone monitoring"""
        stream = rtc.VideoStream(track)
        self._camera_stream = stream
        
        async def read_stream():
            async for event in stream:
                self._latest_camera_frame = event.frame
        
        asyncio.create_task(read_stream())

    async def _monitor_phone(self) -> None:
        """Monitor camera for phones - stops after first detection"""
        from livekit.plugins import openai
        
        vision_llm = openai.LLM(model="gpt-4o-mini")
        
        while True:
            await asyncio.sleep(3.0)
            
            # Check for phone in camera feed
            chat_ctx = ChatContext()
            chat_ctx.add_message(role="system", content="You are a proctor. Look at this image and determine if there is a smartphone, mobile phone, or phone visible. The person might be holding it. Note: You will likely see the BACK of the phone (the rear case/camera area), not the screen. Look for rectangular devices that appear to be phones being held. Respond ONLY with 'PHONE' or 'CLEAR' - nothing else, make sure every letter is in uppercase.")
            chat_ctx.add_message(role="user", content=[ImageContent(image=self._latest_camera_frame, inference_width=512, inference_height=512)])
            
            full_text = ""
            async for chunk in vision_llm.chat(chat_ctx=chat_ctx):
                full_text += str(chunk)
            
            if "PHONE" in full_text:
                await self._session.say("I've detected a phone in view. Please put it away immediately so we can maintain quiz integrity. Thank you for your cooperation.", allow_interruptions=False, add_to_chat_ctx=False)
                break


# --- MAIN ENTRY POINT ---

server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    # Gemini Live with automatic video support
    session = AgentSession(
        llm=google.realtime.RealtimeModel(
            model="gemini-2.0-flash-exp",
            voice="Puck",
            instructions="""You are a professional exam proctor. Your role is to:
1. Greet the user warmly with a short greeting like "Hello! How are you? Are you ready to start the quiz?"
2. After they respond, ask them to please share their screen so you can monitor the quiz (they can use the screen share button in the interface)
3. Wait for them to confirm they have shared their screen
4. When they confirm, call the show_quiz_link tool to display the quiz link
5. After the quiz link is shown, wish them good luck with a brief, encouraging message like "Good luck! Take your time, read each question carefully, and do your best. I'll be here monitoring if you need anything."
6. Once you've wished them luck, remain SILENT and observe. Do not speak during the quiz.
7. When the user says they are done with the quiz (e.g., "I'm done", "I finished", "I completed it"), look at the screen share video you can see. The quiz completion screen will show 'Quiz Complete!' as a heading and display a score like 'X/4' or 'X out of 4'. Congratulate them warmly and announce their score in a natural, enthusiastic way.
8. Act professionally and maintain a quiet, focused environment.""",
        ),
    )

    avatar = anam.AvatarSession(
        persona_config=anam.PersonaConfig(
            name="Quiz Proctor",
            avatarId="30fa96d0-26c4-4e55-94a0-517025942e18",  
        ),
    )
    await avatar.start(session, room=ctx.room)

    await session.start(
        room=ctx.room,
        agent=ProctorAgent(session),
        room_options=room_io.RoomOptions(
            video_enabled=True,  # Enables automatic video input for Gemini Live
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
            ),
        ),
    )

    await session.generate_reply(
        instructions="Greet the user warmly with a short greeting. Sound professional but friendly. Say something like 'Hello! How are you? Are you ready to start the quiz?' Keep it brief and wait for their response before asking about screen sharing."
    )

if __name__ == "__main__":
    agents.cli.run_app(server)
