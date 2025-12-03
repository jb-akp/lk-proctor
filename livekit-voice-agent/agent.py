from dotenv import load_dotenv
import asyncio

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, get_job_context, function_tool, RunContext
from livekit.agents.llm import ChatContext, ImageContent
from livekit.plugins import noise_cancellation, silero, openai, anam
from livekit.plugins.turn_detector.multilingual import MultilingualModel

load_dotenv(".env.local")

class ProctorAgent(Agent):
    def __init__(self, session: AgentSession, llm_instance: openai.LLM) -> None:
        super().__init__(
            instructions="""You are a professional exam proctor. 
1. Greet the user and ask them to share their screen.
2. When they confirm screen share, call show_quiz_link.
3. Wish them good luck, then stay SILENT.
4. You will be informed when quiz is complete or violations are detected.""",
        )
        self._session = session
        self._llm = llm_instance
        self._latest_screen_frame = None
        self._room = None

    @function_tool()
    async def show_quiz_link(self, context: RunContext) -> str:
        """Display quiz link popup and start monitoring screen share."""
        await self._session.say("Perfect! I'm setting up your quiz now. You'll see a link appear on your screen.", allow_interruptions=False)
        
        # Start monitoring
        asyncio.create_task(self._monitor_screen())
        
        # Send RPC to show quiz link
        for participant in self._room.remote_participants.values():
            if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
                await self._room.local_participant.perform_rpc(
                    destination_identity=participant.identity,
                    method="frontend.showQuizLink",
                    payload=""
                )
                break
        
        return "Quiz link displayed. Wish them good luck."

    async def on_enter(self) -> None:
        """Set up screen share track subscription."""
        self._room = get_job_context().room
        
        @self._room.on("track_subscribed")
        def on_track_subscribed(track, publication, participant):
            if (participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD and
                publication.source == rtc.TrackSource.SOURCE_SCREENSHARE and
                track.kind == rtc.TrackKind.KIND_VIDEO):
                self._create_screen_stream(track)
        
        # Check for existing screen share tracks
        for participant in self._room.remote_participants.values():
            if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
                for publication in participant.track_publications.values():
                    if (publication.track and 
                        publication.track.kind == rtc.TrackKind.KIND_VIDEO and 
                        publication.source == rtc.TrackSource.SOURCE_SCREENSHARE):
                        self._create_screen_stream(publication.track)

    def _create_screen_stream(self, track: rtc.Track) -> None:
        """Buffer latest screen share frame."""
        stream = rtc.VideoStream(track)
        async def read_stream():
            async for event in stream:
                self._latest_screen_frame = event.frame
        asyncio.create_task(read_stream())

    async def _monitor_screen(self) -> None:
        """Monitor screen for tab switches and quiz completion."""
        # Give user time to log onto the quiz
        await asyncio.sleep(8.0)
        
        while True:
            await asyncio.sleep(2.0)
            
            # Check screen with vision LLM
            chat_ctx = ChatContext()
            chat_ctx.add_message(
                role="system",
                content='You are a screen monitor. Look at the screen and return ONLY one of these exact strings - nothing else:\n- If quiz is COMPLETE/FINISHED (final results page), return the final score like "3 out of 4"\n- If student is on Google, phone, or any other tab/app (NOT the quiz), return exactly: "TAB_SWITCH"\n- If student is on the quiz page (even if score visible in progress), return exactly: "ON_QUIZ"\n\nCRITICAL: Return ONLY the exact string. Do not add any explanation, commentary, or other text.'
            )
            chat_ctx.add_message(
                role="user",
                content=[ImageContent(image=self._latest_screen_frame, inference_width=1024, inference_height=768)]
            )
            
            response = ""
            async for chunk in self._llm.chat(chat_ctx=chat_ctx):
                if chunk.delta and chunk.delta.content:
                    response += chunk.delta.content
            
            # Check if response is a score (format: "3 out of 4") - only when quiz is complete
            if "out of" in response:
                await self._session.say(
                    f"Congratulations! You scored {response}. Great job!",
                    allow_interruptions=False
                )
                break
            # Check for tab switch
            elif "TAB_SWITCH" in response:
                await self._session.say(
                    "I notice you've switched tabs. Please return to the quiz window to continue your exam.",
                    allow_interruptions=False,
                    add_to_chat_ctx=False
                )
            # Debug: log all responses to see what LLM is returning
            elif response and response != "ON_QUIZ":
                print(f"[MONITOR] LLM response: '{response}'")

server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    llm = openai.LLM(model="gpt-4o-mini")
    
    session = AgentSession(
        stt="assemblyai/universal-streaming:en",
        llm=llm,
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )
    
    avatar = anam.AvatarSession(
        persona_config=anam.PersonaConfig(
            name="Proctor",
            avatarId="default",
        ),
    )
    
    await avatar.start(session, room=ctx.room)
    
    await session.start(
        room=ctx.room,
        agent=ProctorAgent(session, llm),
        room_options=room_io.RoomOptions(
            video_input=True,
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
            ),
        ),
    )
    
    await session.generate_reply(
        instructions="Greet the user and ask them to share their screen to begin."
    )

if __name__ == "__main__":
    agents.cli.run_app(server)
