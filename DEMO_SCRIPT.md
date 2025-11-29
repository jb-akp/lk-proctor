# YouTube Tutorial Demo Script: AI-Powered Quiz Proctoring System

## Setup (Before Recording)
1. Start the agent: `cd livekit-voice-agent && uv run agent.py dev`
2. Start nextjs-frontend: `cd nextjs-frontend && npm run dev` (port 3000)
3. Start quiz-frontend: `cd quiz-frontend && npm run dev` (port 3001)
4. Have your phone ready (but keep it out of view initially)

---

## Demo Script

### [0:00-0:30] Introduction & Setup
**You:** "Hey everyone! Today I'm going to show you how to build an AI-powered quiz proctoring system using LiveKit Agents. This system can detect when someone tries to use their phone during a quiz and automatically warn them. Let me show you how it works!"

**[Screen shows: code editor, terminal, browser]**

**You:** "I've got three components running here: the LiveKit agent backend, the main frontend where the proctor interface is, and a separate quiz frontend. Let me connect and start the demo."

---

### [0:30-1:00] Initial Connection & Greeting
**You:** "I'm going to connect to the voice agent now..."

**[Click connect, allow camera/mic permissions]**

**Agent:** "Hello! Welcome. Are you ready to begin the trivia quiz?"

**You:** "Yes, I'm ready!"

**Agent:** "Perfect! I'm setting up your quiz now. You'll see a link appear on your screen in just a moment."

**[Quiz link popup appears]**

**Agent:** "Good luck! Take your time and do your best."

**You:** "Thanks! Let me click this link to open the quiz in a new tab."

---

### [1:00-2:30] Taking the Quiz (Normal Flow)
**You:** "Alright, so here's the quiz interface. It's a clean, modern design with four trivia questions. Let me start answering them."

**[Click "Start Quiz"]**

**You:** "First question: 'What is the capital of France?' Hmm, I know this one - it's Paris. Let me select that."

**[Select Paris, see correct feedback]**

**You:** "Great! Got that one right. Next question: 'How many continents are there?' That's seven continents. Easy."

**[Select 7, see correct feedback]**

**You:** "Perfect! Third question: 'What is the largest planet in our solar system?' That's Jupiter, definitely."

**[Select Jupiter, see correct feedback]**

**You:** "Excellent! Now for the last question..."

---

### [2:30-3:30] Phone Detection Demo
**You:** "Okay, so here's where it gets interesting. Let's say I'm not sure about this last question - 'In what year did World War II end?' I'm thinking... 1945? But I'm not 100% sure."

**[Pause, look uncertain]**

**You:** "You know what, let me just quickly check my phone to look this up..."

**[Reach for phone, bring it into camera view]**

**Agent:** "I notice you have your phone out. Please put it away so we can continue the quiz fairly. Thank you!"

**[Red warning modal appears on quiz screen]**

**You:** "Whoa! Did you see that? The AI agent detected my phone immediately and showed a warning modal on the quiz screen. That's pretty cool! The system is monitoring my camera feed in real-time using vision AI."

**[Put phone away]**

**You:** "Okay, I'll put it away. The warning disappears after the agent finishes speaking. Let me continue with the quiz."

---

### [3:30-4:00] Completing the Quiz
**You:** "So I'll answer 1945 for the last question."

**[Select 1945, see correct feedback]**

**You:** "Perfect! All four correct. Let me finish the quiz."

**[Click "Finish Quiz"]**

**Agent:** "Great job completing the quiz! You scored 4 out of 4. Well done!"

**You:** "Awesome! The agent congratulated me on my perfect score."

---

### [4:00-5:00] Technical Explanation
**You:** "So let me break down what just happened here. This system uses several key technologies:"

**[Switch to code view]**

**You:** 
- "LiveKit Agents for the voice AI backend
- Real-time video streaming for proctoring
- Vision AI using GPT-4o-mini to detect phones in the camera feed
- RPC communication between the frontend and backend
- A separate quiz frontend that connects to the same LiveKit room"

**You:** "The agent monitors the video stream every 3 seconds, sending frames to the vision model to check for phones. When it detects one, it sends an RPC message to the quiz frontend to show the warning modal, and speaks a warning message."

---

### [5:00-5:30] Closing
**You:** "This is a great example of how you can combine voice AI, vision AI, and real-time communication to build intelligent proctoring systems. If you want to see the full code and build this yourself, check out the repository link in the description below."

**You:** "Thanks for watching, and don't forget to like and subscribe if you want to see more LiveKit tutorials!"

---

## Key Talking Points to Emphasize:
1. **Real-time detection** - The phone was detected almost instantly
2. **Multi-modal AI** - Combines voice and vision AI
3. **Clean architecture** - Separate frontends for different purposes
4. **User experience** - Smooth, non-intrusive warnings
5. **Professional design** - Modern, polished UI

## Suggested Agent Message Improvements:

1. **Initial greeting** (line 216): Keep as is - it's good
2. **Quiz setup message** (line 36): Current is good, but could be slightly more enthusiastic:
   - Current: "Perfect! I'm setting up your quiz now. You'll see a link appear on your screen in just a moment."
   - Suggested: "Perfect! I'm setting up your quiz now. You'll see a link appear on your screen in just a moment. Once you click it, the quiz will open in a new tab."

3. **Good luck message** (line 20): Current instruction is good, but could be more specific:
   - Current instruction: "wish them good luck with a brief, encouraging message like 'Good luck! Take your time and do your best.'"
   - Suggested: "Good luck! Take your time, read each question carefully, and do your best. I'll be here monitoring if you need anything."

4. **Phone warning** (line 125): Current is good, but could be slightly more firm:
   - Current: "I notice you have your phone out. Please put it away so we can continue the quiz fairly. Thank you!"
   - Suggested: "I've detected a phone in view. Please put it away immediately so we can maintain quiz integrity. Thank you for your cooperation."

5. **Score message** (line 171): Current is good, but could be more personalized:
   - Current: "Great job completing the quiz! You scored {score_text}. Well done!"
   - Suggested: "Excellent work completing the quiz! You scored {score_text}. That's fantastic! Well done!"

