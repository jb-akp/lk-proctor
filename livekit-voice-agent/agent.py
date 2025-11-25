from dotenv import load_dotenv
import json
import logging
import asyncio

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.rtc.rpc import RpcInvocationData
from livekit.plugins import (
    openai,
    noise_cancellation,
)

from quiz import show_quiz, quiz_data_store

load_dotenv(".env.local")

class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a friendly and helpful voice AI assistant that can also administer math quizzes. 

IMPORTANT: You must always speak in English. Never respond in any other language.

When the user wants to practice math or take a quiz, you can use your show_quiz tool to display an addition problem on their screen with multiple choice answers. 

Here's how the quiz flow works:
1. When the user asks for a quiz, math practice, or wants to test their addition skills, call the show_quiz function
2. A popup will appear on their screen with a math problem and 4 multiple choice answer options
3. The user will click one of the answer buttons on their screen
4. Once they submit an answer, you will automatically receive the result and can provide feedback
5. Give enthusiastic positive feedback when they get it right, and encouraging, helpful feedback when they get it wrong (politely explain the correct answer)

Be conversational and natural. If the user asks for a quiz, wants to practice math, or wants to test themselves, offer to show them a quiz. You can also proactively offer quizzes if appropriate.

You have access to tools for showing quizzes.""",
            tools=[show_quiz],
        )

server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            voice="coral"
        )
    )

    assistant = Assistant()
    
    await session.start(
        room=ctx.room,
        agent=assistant,
        room_options=room_io.RoomOptions(
            audio_input=room_io.AudioInputOptions(
                noise_cancellation=lambda params: noise_cancellation.BVCTelephony() if params.participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_SIP else noise_cancellation.BVC(),
            ),
            video_input=True,  # Enable video input - agent will see camera or screen share (uses most recently published track)
        ),
    )

    # Register RPC method to receive quiz answers from the client
    @ctx.room.local_participant.register_rpc_method("agent.submitQuizAnswer")
    async def handle_quiz_answer(data: RpcInvocationData) -> str:
        """Handle quiz answer submission from the client."""
        try:
            payload = json.loads(data.payload)
            user_answer = payload.get("answer")
            
            # Get the correct answer from the quiz data store
            room_name = ctx.room.name
            quiz_data = quiz_data_store.get(room_name)
            
            if quiz_data is None:
                return json.dumps({"error": "No active quiz found"})
            
            correct_answer = quiz_data.get('correct_answer')
            question = quiz_data.get('question', 'the question')
            
            if correct_answer is None:
                return json.dumps({"error": "No active quiz found"})
            
            # Convert to int for comparison
            user_answer_int = int(user_answer) if isinstance(user_answer, (int, str)) else None
            
            # Determine if answer is correct
            is_correct = user_answer_int == correct_answer
            
            # Build response payload
            result_status = "correct" if is_correct else "incorrect"
            response_payload = {
                "status": result_status,
                "message": "Correct answer!" if is_correct else "Incorrect answer"
            }
            if not is_correct:
                response_payload["correct_answer"] = correct_answer
            
            # Clear quiz data before returning
            quiz_data_store.pop(room_name, None)
            
            # Schedule voice feedback asynchronously (fire and forget)
            async def send_voice_feedback_async():
                try:
                    if is_correct:
                        await session.generate_reply(
                            instructions=f"Speak in English. The user answered {user_answer_int}, which is correct! Give them enthusiastic positive feedback for getting the question '{question}' right."
                        )
                    else:
                        await session.generate_reply(
                            instructions=f"Speak in English. The user answered {user_answer_int}, but the correct answer is {correct_answer} for the question '{question}'. Politely let them know they got it wrong and what the correct answer is."
                        )
                except Exception as e:
                    logging.error(f"Error sending voice feedback (non-critical): {e}")
            
            try:
                asyncio.create_task(send_voice_feedback_async())
            except Exception as e:
                logging.error(f"Error scheduling voice feedback task (non-critical): {e}")
            
            return json.dumps(response_payload)
                
        except Exception as e:
            logging.error(f"Error handling quiz answer: {e}")
            return json.dumps({"error": str(e)})

    await session.generate_reply(
        instructions="""Greet the user warmly and introduce yourself in English. Let them know you're a helpful assistant 
        who can also help them practice math with interactive quizzes. Ask how you can help them today. 
        Always speak in English - never use any other language."""
    )


if __name__ == "__main__":
    agents.cli.run_app(server)