from dotenv import load_dotenv
import json
import asyncio

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io, get_job_context
from livekit.agents.llm import ChatContext, ImageContent
from livekit.rtc.rpc import RpcInvocationData
from livekit.plugins import noise_cancellation, silero, openai
from livekit.plugins.turn_detector.multilingual import MultilingualModel

# We can remove the 'quiz' import if we define the logic locally or keep it simple
from quiz import show_quiz, quiz_data_store, generate_options 

load_dotenv(".env.local")

class Assistant(Agent):
    def __init__(self, session: AgentSession, llm_instance: openai.LLM) -> None:
        super().__init__(
            instructions="""You are a friendly trivia quiz voice assistant. Speak in English.
            QUIZ BEHAVIOR: Speak only at start and end. Stay silent during questions.""",
            tools=[show_quiz], 
        )
        self._session = session
        self._llm = llm_instance
        self._latest_frame = None
        self._video_stream = None
        self._phone_monitoring_task = None
        
        self.quiz_state = {
            "active": False,
            "questions": [],
            "current_index": 0,
            "answers": []
        }

    async def on_enter(self):
        self._room = get_job_context().room
        @self._room.on("track_subscribed")
        def on_track_subscribed(track, publication, participant):
            if track.kind == rtc.TrackKind.KIND_VIDEO:
                self._video_stream = rtc.VideoStream(track)
                asyncio.create_task(self._read_stream())

    async def _read_stream(self):
        async for event in self._video_stream:
            self._latest_frame = event.frame

    async def _monitor_for_phone(self):
        while self.quiz_state["active"]:
            await asyncio.sleep(3.0)
            if not self._latest_frame:
                continue
            try:
                chat_ctx = ChatContext()
                chat_ctx.add_message(role="system", content="You are a proctor. Look at this image and determine if there is a smartphone, mobile phone, or phone visible. The person might be holding it. Respond ONLY with 'PHONE_DETECTED' or 'CLEAR' - nothing else.")
                chat_ctx.add_message(role="user", content=[ImageContent(image=self._latest_frame, inference_width=512, inference_height=512)])
                
                full_text = ""
                async for chunk in self._llm.chat(chat_ctx=chat_ctx):
                    full_text += str(chunk)
                full_text = full_text.split("ID=")[0].strip().upper()
                
                if "PHONE_DETECTED" in full_text or "PHONE" in full_text:
                    await self._session.say("I notice you have your phone out. Please put it away so we can continue the quiz fairly. Thank you!")
            except Exception:
                pass

    # --- SIMPLIFIED QUIZ LOGIC ---

    async def _send_question(self, index):
        room = get_job_context().room
        q = self.quiz_state["questions"][index]
        await room.local_participant.perform_rpc(
            destination_identity=next(iter(room.remote_participants)),
            method="client.showQuiz",
            payload=json.dumps({
                "type": "trivia_quiz",
                "question": q["question"],
                "options": generate_options(q["correct_answer"]),
                "question_number": index + 1,
                "total_questions": len(self.quiz_state["questions"]),
            }),
            response_timeout=5.0
        )

    # --- RPC HANDLERS (Now Class Methods) ---

    async def handle_start_quiz(self, data: RpcInvocationData) -> str:
        room = get_job_context().room
        quiz_data = quiz_data_store[room.name]
        self.quiz_state["questions"] = quiz_data["questions"]
        self.quiz_state["active"] = True
        self.quiz_state["current_index"] = 0
        self.quiz_state["answers"] = []
        self._phone_monitoring_task = asyncio.create_task(self._monitor_for_phone())
        await self._send_question(0)
        return json.dumps({"status": "started"})

    async def handle_submit_answer(self, data: RpcInvocationData) -> str:
        payload = json.loads(data.payload)
        idx = self.quiz_state["current_index"]
        q = self.quiz_state["questions"][idx]
        is_correct = str(payload.get("answer")) == str(q["correct_answer"])
        self.quiz_state["answers"].append(is_correct)
        self.quiz_state["current_index"] = idx + 1
        if idx + 1 >= len(self.quiz_state["questions"]):
            return await self._finish_quiz()
        asyncio.create_task(self._delayed_next_question(2.0))
        return json.dumps({"status": "correct" if is_correct else "incorrect", "message": "Correct!" if is_correct else "Incorrect", "next_question": True})

    async def _delayed_next_question(self, delay):
        await asyncio.sleep(delay)
        await self._send_question(self.quiz_state["current_index"])

    async def _finish_quiz(self):
        score = sum(self.quiz_state["answers"])
        total = len(self.quiz_state["questions"])
        self.quiz_state["active"] = False
        if self._phone_monitoring_task:
            self._phone_monitoring_task.cancel()
            self._phone_monitoring_task = None
        room = get_job_context().room
        await room.local_participant.perform_rpc(
            destination_identity=next(iter(room.remote_participants)),
            method="client.showScore",
            payload=json.dumps({"score": score, "total": total, "percentage": int((score / total) * 100)}),
            response_timeout=5.0
        )
        async def send_feedback():
            await asyncio.sleep(1.5)
            percentage = int((score / total) * 100)
            if score == total:
                await self._session.say(f"Congratulations! You got a perfect score - {score} out of {total}! Excellent work!")
            elif percentage >= 75:
                await self._session.say(f"Great job! You scored {score} out of {total}, that's {percentage} percent. Well done!")
            elif percentage >= 50:
                await self._session.say(f"Good effort! You scored {score} out of {total}, that's {percentage} percent. Keep practicing!")
            else:
                await self._session.say(f"You scored {score} out of {total}, that's {percentage} percent. Keep practicing and you'll improve!")
        asyncio.create_task(send_feedback())
        return json.dumps({"status": "complete", "score": score, "total": total})

# --- MAIN ENTRY POINT ---

server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    # 1. Create the brains
    session = AgentSession(
        stt="assemblyai/universal-streaming:en",
        llm="openai/gpt-4o-mini", # Voice Brain
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
    )
    vision_llm = openai.LLM(model="gpt-4o-mini")
    assistant = Assistant(session, vision_llm)

    await session.start(
        room=ctx.room,
        agent=assistant,
        room_options=room_io.RoomOptions(
            video_input=True,
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
            ),
        ),
    )

    @ctx.room.local_participant.register_rpc_method("agent.startQuiz")
    async def handle_start_quiz(data: RpcInvocationData) -> str:
        return await assistant.handle_start_quiz(data)

    @ctx.room.local_participant.register_rpc_method("agent.submitQuizAnswer")
    async def handle_submit_answer(data: RpcInvocationData) -> str:
        return await assistant.handle_submit_answer(data)
    
    await session.generate_reply(
        instructions="Greet warmly in English. Sound like a friendly teacher. Say something like 'Hey there! Ready for a quick trivia quiz? I've got 4 questions for you whenever you're ready.'"
        )

if __name__ == "__main__":
    agents.cli.run_app(server)