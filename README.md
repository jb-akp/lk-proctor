# AI-Powered Quiz Proctoring System

An intelligent quiz proctoring system built with LiveKit Agents that uses AI vision to monitor users during online quizzes. The system can detect phone usage in real-time and automatically announce quiz scores upon completion.

## Features

- **AI Voice Agent**: Professional quiz proctor powered by LiveKit Agents with OpenAI GPT-4o-mini
- **Real-time Phone Detection**: Uses vision AI to monitor camera feed and detect phone usage
- **Screen Share Monitoring**: Monitors screen share to detect quiz completion and read scores
- **Standalone Quiz Frontend**: Clean, modern quiz interface completely independent from LiveKit
- **Virtual Avatar**: ANAM avatar integration for a more engaging user experience

## Architecture

The system consists of three main components:

1. **LiveKit Voice Agent** (`livekit-voice-agent/`): Python-based AI agent that handles voice interaction, camera monitoring, and screen share analysis
2. **NextJS Frontend** (`nextjs-frontend/`): Main interface where users connect to the agent, share their screen, and interact with the proctor
3. **Quiz Frontend** (`quiz-frontend/`): Standalone React application with the quiz interface - no LiveKit dependencies

## How It Works

1. User connects to the voice agent through the NextJS frontend
2. Agent greets the user and asks them to share their screen
3. Once screen share is confirmed, agent displays a quiz link popup
4. User opens the quiz in a new tab (standalone, runs on localhost:3001)
5. Agent monitors the camera feed every 3 seconds to detect phone usage
6. If a phone is detected, agent immediately warns the user
7. When user completes the quiz and says "I'm done", agent checks the screen share to read the score
8. Agent announces the score with a congratulatory message

## Setup

### Prerequisites

- Python 3.12+ with `uv` package manager
- Node.js 18+ with `pnpm`
- LiveKit server credentials (API key, secret, URL)
- OpenAI API key

### 1. LiveKit Voice Agent

```bash
cd livekit-voice-agent

# Install dependencies (using uv)
uv sync

# Set up environment variables in .env.local
# LIVEKIT_API_KEY=your_key
# LIVEKIT_API_SECRET=your_secret
# LIVEKIT_URL=your_livekit_url
# OPENAI_API_KEY=your_openai_key

# Run the agent
uv run agent.py dev
```

### 2. NextJS Frontend

```bash
cd nextjs-frontend

# Install dependencies
pnpm install

# Set up environment variables in .env.local
# LIVEKIT_API_KEY=your_key
# LIVEKIT_API_SECRET=your_secret
# LIVEKIT_URL=your_livekit_url

# Run the development server
pnpm dev
```

The frontend will run on http://localhost:3000

### 3. Quiz Frontend

```bash
cd quiz-frontend

# Install dependencies
pnpm install

# Run the development server
pnpm dev
```

The quiz frontend will run on http://localhost:3001 (standalone, no LiveKit needed)

## Usage

1. Start all three services (agent, NextJS frontend, quiz frontend)
2. Open http://localhost:3000 in your browser
3. Click "Start call" and allow camera/microphone permissions
4. Agent will greet you and ask you to share your screen
5. Share your screen using the screen share button
6. Confirm screen share with the agent
7. Agent will display a quiz link popup
8. Click the link to open the quiz in a new tab
9. Complete the quiz normally
10. When done, tell the agent "I'm done with the quiz"
11. Agent will check your screen share and announce your score

## Project Structure

```
.
├── livekit-voice-agent/    # Python AI agent
│   ├── agent.py            # Main agent implementation
│   └── pyproject.toml      # Python dependencies
├── nextjs-frontend/        # Main LiveKit frontend
│   ├── components/         # React components
│   ├── app/                # Next.js app directory
│   └── package.json        # Node.js dependencies
└── quiz-frontend/          # Standalone quiz app
    ├── components/         # Quiz component
    ├── app/                # Next.js app directory
    └── package.json        # Node.js dependencies
```

## Technology Stack

- **Backend**: LiveKit Agents (Python), OpenAI GPT-4o-mini
- **Frontend**: Next.js 15, React 19, TypeScript
- **Real-time Communication**: LiveKit RTC
- **Voice AI**: AssemblyAI STT, Cartesia TTS, Silero VAD
- **Vision AI**: OpenAI GPT-4o-mini with vision capabilities
- **Virtual Avatar**: ANAM

## License

This project is open source and free to use or modify.

