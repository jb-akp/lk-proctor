from dotenv import load_dotenv
import json
import logging
import asyncio
import random

from livekit import agents, rtc
from livekit.agents import AgentServer, AgentSession, Agent, room_io
from livekit.rtc.rpc import RpcInvocationData
from livekit.plugins import noise_cancellation, silero
from livekit.plugins.turn_detector.multilingual import MultilingualModel

from quiz import show_quiz, quiz_data_store

load_dotenv(".env.local")

class Assistant(Agent):
    def __init__(self) -> None:
        super().__init__(
            instructions="""You are a friendly and helpful voice AI assistant that can administer math quizzes. 

IMPORTANT: You must always speak in English. Never respond in any other language.

When the user wants to practice math or take a quiz, you can use your show_quiz tool to start a 4-question quiz with addition, subtraction, multiplication, and division.

CRITICAL QUIZ BEHAVIOR:
- When you start a quiz, speak ONLY at the beginning to encourage them (e.g., "Good luck! Focus and take your time.")
- DO NOT speak or provide feedback during the quiz after each question - remain completely silent
- After all 4 questions are answered, a score popup will appear automatically and you will be given explicit instructions about what to say
- DO NOT speak on your own after the quiz completes - only speak when given explicit score instructions

Be conversational and natural. If the user asks for a quiz, wants to practice math, or wants to test themselves, offer to show them a quiz.

You have access to tools for showing quizzes.""",
            tools=[show_quiz],
        )

server = AgentServer()

@server.rtc_session()
async def my_agent(ctx: agents.JobContext):
    session = AgentSession(
        stt="assemblyai/universal-streaming:en",
        llm="openai/gpt-4.1-mini",
        tts="cartesia/sonic-3:9626c31c-bec5-4cca-baa8-f8ba9e84c8bc",
        vad=silero.VAD.load(),
        turn_detection=MultilingualModel(),
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
        """Handle quiz answer submission from the client and show next question or final score."""
        try:
            payload = json.loads(data.payload)
            user_answer = payload.get("answer")
            
            room_name = ctx.room.name
            quiz_data = quiz_data_store.get(room_name)
            
            if quiz_data is None or not quiz_data.get('quiz_active'):
                return json.dumps({"error": "No active quiz found"})
            
            questions = quiz_data.get('questions', [])
            current_index = quiz_data.get('current_question_index', 0)
            answers = quiz_data.get('answers', [])
            
            if current_index >= len(questions):
                return json.dumps({"error": "Quiz already completed"})
            
            # Get current question
            current_question = questions[current_index]
            correct_answer = current_question['correct_answer']
            
            # Convert to int for comparison
            user_answer_int = int(user_answer) if isinstance(user_answer, (int, str)) else None
            
            # Determine if answer is correct
            is_correct = user_answer_int == correct_answer
            
            # Store the answer
            answers.append({
                "question": current_question['question'],
                "user_answer": user_answer_int,
                "correct_answer": correct_answer,
                "is_correct": is_correct
            })
            quiz_data['answers'] = answers
            quiz_data['current_question_index'] = current_index + 1
            
            # Check if quiz is complete
            if current_index + 1 >= len(questions):
                # Quiz complete - calculate score
                score = sum(1 for ans in answers if ans['is_correct'])
                total = len(questions)
                quiz_data['quiz_active'] = False
                quiz_data['final_score'] = score
                quiz_data['total_questions'] = total
                
                # Show score popup
                if ctx.room.remote_participants:
                    participant_identity = next(iter(ctx.room.remote_participants))
                    await ctx.room.local_participant.perform_rpc(
                        destination_identity=participant_identity,
                        method="client.showScore",
                        payload=json.dumps({
                            "score": score,
                            "total": total,
                            "percentage": int((score / total) * 100)
                        }),
                        response_timeout=5.0
                    )
                
                # Schedule voice feedback about score - be very explicit
                async def send_score_feedback_async():
                    try:
                        # Wait a moment for the score popup to appear first
                        await asyncio.sleep(1.5)
                        
                        percentage = int((score / total) * 100)
                        # Use session.say() directly to avoid LLM interpretation
                        if score == total:
                            await session.say(f"Congratulations! You got a perfect score - {score} out of {total}! Excellent work!")
                        elif percentage >= 75:
                            await session.say(f"Great job! You scored {score} out of {total}, that's {percentage} percent. Well done!")
                        elif percentage >= 50:
                            await session.say(f"Good effort! You scored {score} out of {total}, that's {percentage} percent. Keep practicing!")
                        else:
                            await session.say(f"You scored {score} out of {total}, that's {percentage} percent. Keep practicing and you'll improve!")
                    except Exception as e:
                        logging.error(f"Error sending score feedback (non-critical): {e}")
                
                asyncio.create_task(send_score_feedback_async())
                
                return json.dumps({
                    "status": "quiz_complete",
                    "score": score,
                    "total": total,
                    "is_correct": is_correct
                })
            else:
                # Return result first so frontend can show feedback
                result_response = json.dumps({
                    "status": "correct" if is_correct else "incorrect",
                    "message": "Correct!" if is_correct else "Incorrect",
                    "next_question": True
                })
                
                # Delay showing next question to allow feedback to display longer
                async def show_next_question_delayed():
                    try:
                        # Wait 3 seconds to match when frontend closes feedback popup
                        await asyncio.sleep(3.0)
                        
                        next_question = questions[current_index + 1]
                        correct_answer = next_question['correct_answer']
                        
                        # Generate multiple choice options
                        wrong_answers = set()
                        while len(wrong_answers) < 3:
                            offset = random.choice([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5])
                            wrong = correct_answer + offset
                            if wrong != correct_answer and wrong > 0:
                                wrong_answers.add(wrong)
                        
                        options = [correct_answer] + list(wrong_answers)
                        random.shuffle(options)
                        
                        # Show next question
                        if ctx.room.remote_participants:
                            participant_identity = next(iter(ctx.room.remote_participants))
                            await ctx.room.local_participant.perform_rpc(
                                destination_identity=participant_identity,
                                method="client.showQuiz",
                                payload=json.dumps({
                                    "type": "math_quiz",
                                    "question": next_question["question"],
                                    "options": options,
                                    "question_number": current_index + 2,
                                    "total_questions": len(questions),
                                }),
                                response_timeout=5.0
                            )
                    except Exception as e:
                        logging.error(f"Error showing next question (non-critical): {e}")
                
                # Schedule next question to show after delay (fire and forget)
                asyncio.create_task(show_next_question_delayed())
                
                # Return result immediately (no voice feedback - agent stays silent)
                return result_response
                
        except Exception as e:
            logging.error(f"Error handling quiz answer: {e}")
            return json.dumps({"error": str(e)})

    await session.generate_reply(
        instructions="""Greet the user naturally and warmly in English. Sound like a friendly teacher or tutor who's excited to help them practice math. Say something like "Hey there! Ready to test your math skills? I've got a quick quiz with 4 questions for you whenever you're ready." Keep it conversational and encouraging."""
    )


if __name__ == "__main__":
    agents.cli.run_app(server)