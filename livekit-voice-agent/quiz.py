import json
import random
import logging
from livekit.agents import function_tool, RunContext, get_job_context, ToolError

# Shared quiz data store (room name -> quiz data)
# This is accessible from both the function tool and the RPC handler in agent.py
quiz_data_store: dict[str, dict] = {}


def generate_question(operation: str) -> tuple[str, int]:
    """Generate a math question and return the question string and correct answer."""
    if operation == "addition":
        num1 = random.randint(1, 20)
        num2 = random.randint(1, 20)
        return f"{num1} + {num2}", num1 + num2
    elif operation == "subtraction":
        num1 = random.randint(10, 30)
        num2 = random.randint(1, num1)
        return f"{num1} - {num2}", num1 - num2
    elif operation == "multiplication":
        num1 = random.randint(2, 10)
        num2 = random.randint(2, 10)
        return f"{num1} × {num2}", num1 * num2
    elif operation == "division":
        # Generate division that results in whole number
        divisor = random.randint(2, 10)
        quotient = random.randint(2, 10)
        dividend = divisor * quotient
        return f"{dividend} ÷ {divisor}", quotient
    else:
        raise ValueError(f"Unknown operation: {operation}")


@function_tool()
async def show_quiz(
    context: RunContext,
) -> str:
    """Start a 4-question math quiz with addition, subtraction, multiplication, and division.
    
    This function initiates a quiz sequence that will display 4 math problems one at a time.
    The agent will remain silent during the quiz and only speak at the beginning and end.
    
    Returns:
        A confirmation message that the quiz has started.
    """
    try:
        room = get_job_context().room
        
        # Generate 4 questions with different operations
        operations = ["addition", "subtraction", "multiplication", "division"]
        random.shuffle(operations)  # Randomize order
        
        questions = []
        for operation in operations:
            question_str, correct_answer = generate_question(operation)
            questions.append({
                "question": question_str,
                "correct_answer": correct_answer,
                "operation": operation
            })
        
        # Initialize quiz data store for this room
        quiz_data_store[room.name] = {
            "questions": questions,
            "current_question_index": 0,
            "answers": [],
            "quiz_active": True,
            "total_questions": 4
        }
        
        # Get the user's participant identity
        if not room.remote_participants:
            raise ToolError("No user participant found in the room")
        
        participant_identity = next(iter(room.remote_participants))
        
        # Show the first question
        first_question = questions[0]
        correct_answer = first_question["correct_answer"]
        
        # Generate multiple choice options (3 wrong answers + 1 correct)
        wrong_answers = set()
        while len(wrong_answers) < 3:
            offset = random.choice([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5])
            wrong = correct_answer + offset
            if wrong != correct_answer and wrong > 0:
                wrong_answers.add(wrong)
        
        options = [correct_answer] + list(wrong_answers)
        random.shuffle(options)
        
        # Send RPC call to show first question
        await room.local_participant.perform_rpc(
            destination_identity=participant_identity,
            method="client.showQuiz",
            payload=json.dumps({
                "type": "math_quiz",
                "question": first_question["question"],
                "options": options,
                "question_number": 1,
                "total_questions": 4,
            }),
            response_timeout=5.0
        )
        
        return "Quiz started with 4 questions. First question displayed. Agent will remain silent during the quiz."
            
    except Exception as e:
        logging.error(f"Error starting quiz: {e}")
        raise ToolError(f"Unable to start quiz: {str(e)}")

