import json
import random
from livekit.agents import function_tool, RunContext, get_job_context

quiz_data_store: dict[str, dict] = {}

TRIVIA_QUESTIONS = [
    {"question": "What is the capital of France?", "correct_answer": "Paris"},
    {"question": "How many continents are there?", "correct_answer": "7"},
    {"question": "What is the largest planet in our solar system?", "correct_answer": "Jupiter"},
    {"question": "In what year did World War II end?", "correct_answer": "1945"},
]

WRONG_OPTIONS = {
    "Paris": ["London", "Berlin", "Madrid"],
    "7": ["5", "6", "8"],
    "Jupiter": ["Saturn", "Neptune", "Earth"],
    "1945": ["1944", "1946", "1943"]
}

def generate_options(correct_answer: str) -> list[str]:
    options = WRONG_OPTIONS.get(correct_answer, ["Option A", "Option B", "Option C"]).copy()
    options.append(correct_answer)
    random.shuffle(options)
    return options


@function_tool()
async def show_quiz(context: RunContext) -> str:
    """Start a 4-question trivia quiz."""
    room = get_job_context().room
    quiz_data_store[room.name] = {
        "questions": TRIVIA_QUESTIONS,
        "current_question_index": 0,
        "answers": [],
        "quiz_active": False,
        "quiz_ready": True,
        "total_questions": len(TRIVIA_QUESTIONS)
    }
    
    await room.local_participant.perform_rpc(
        destination_identity=next(iter(room.remote_participants)),
        method="client.showStartQuiz",
        payload=json.dumps({"total_questions": len(TRIVIA_QUESTIONS)}),
        response_timeout=5.0
    )
    return "Quiz prepared. Waiting for user to start."

