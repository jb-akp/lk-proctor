import json
import random
import logging
from livekit.agents import function_tool, RunContext, get_job_context, ToolError

# Shared quiz data store (room name -> quiz data)
# This is accessible from both the function tool and the RPC handler in agent.py
quiz_data_store: dict[str, dict] = {}


@function_tool()
async def show_quiz(
    context: RunContext,
) -> str:
    """Show a math quiz popup on the user's screen with multiple choice answers.
    
    This function displays a simple addition problem as a popup on the frontend
    with multiple choice answers. The user can click an answer, and it will be
    sent back to the agent for validation.
    
    Returns:
        A confirmation message that the quiz was displayed.
    """
    try:
        # Generate a simple addition problem
        num1 = random.randint(1, 20)
        num2 = random.randint(1, 20)
        correct_answer = num1 + num2
        
        # Generate multiple choice options (3 wrong answers + 1 correct)
        wrong_answers = set()
        while len(wrong_answers) < 3:
            # Generate wrong answers that are close to the correct answer
            offset = random.choice([-5, -4, -3, -2, -1, 1, 2, 3, 4, 5])
            wrong = correct_answer + offset
            if wrong != correct_answer and wrong > 0:
                wrong_answers.add(wrong)
        
        # Create list of all options and shuffle
        options = [correct_answer] + list(wrong_answers)
        random.shuffle(options)
        
        # Store correct answer in the quiz data store (keyed by room name)
        room = get_job_context().room
        quiz_data_store[room.name] = {
            'correct_answer': correct_answer,
            'question': f"{num1} + {num2}"
        }
        
        # Get the user's participant identity (they are a remote participant from agent's perspective)
        if not room.remote_participants:
            raise ToolError("No user participant found in the room")
        
        participant_identity = next(iter(room.remote_participants))
        
        # Send RPC call to show quiz with multiple choice options
        await room.local_participant.perform_rpc(
            destination_identity=participant_identity,
            method="client.showQuiz",
            payload=json.dumps({
                "type": "addition_quiz",
                "question": f"{num1} + {num2}",
                "options": options,
            }),
            response_timeout=5.0  # Timeout just to confirm it was shown
        )
        
        return f"Quiz displayed on screen: {num1} + {num2} with multiple choice answers. Waiting for the user to select an answer."
            
    except Exception as e:
        logging.error(f"Error showing quiz: {e}")
        raise ToolError(f"Unable to show quiz: {str(e)}")

