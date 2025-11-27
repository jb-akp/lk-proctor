import json
import random
from livekit.agents import function_tool, RunContext, get_job_context

quiz_data_store: dict[str, dict] = {}


def generate_question(operation: str) -> tuple[str, int]:
    if operation == "addition":
        n1, n2 = random.randint(1, 20), random.randint(1, 20)
        return f"{n1} + {n2}", n1 + n2
    elif operation == "subtraction":
        n1 = random.randint(10, 30)
        n2 = random.randint(1, n1)
        return f"{n1} - {n2}", n1 - n2
    elif operation == "multiplication":
        n1, n2 = random.randint(2, 10), random.randint(2, 10)
        return f"{n1} × {n2}", n1 * n2
    elif operation == "division":
        d, q = random.randint(2, 10), random.randint(2, 10)
        return f"{d * q} ÷ {d}", q
    raise ValueError(f"Unknown operation: {operation}")


@function_tool()
async def show_quiz(context: RunContext) -> str:
    """Start a 4-question math quiz with random operations."""
    room = get_job_context().room
    operations = ["addition", "subtraction", "multiplication", "division"]
    questions = []
    for _ in range(4):
        q, a = generate_question(random.choice(operations))
        questions.append({"question": q, "correct_answer": a})
    
    quiz_data_store[room.name] = {
        "questions": questions,
        "current_question_index": 0,
        "answers": [],
        "quiz_active": False,
        "quiz_ready": True,
        "total_questions": 4
    }
    
    await room.local_participant.perform_rpc(
        destination_identity=next(iter(room.remote_participants)),
        method="client.showStartQuiz",
        payload=json.dumps({"total_questions": 4}),
        response_timeout=5.0
    )
    return "Quiz prepared. Waiting for user to start."

