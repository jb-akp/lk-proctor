# Quiz Frontend

A simplified frontend application for taking a trivia quiz with AI proctoring.

## Features

- 4 hardcoded trivia questions
- Client-side quiz logic (answers, scoring)
- LiveKit integration for voice agent
- RPC communication with backend for proctoring

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Create `.env.local` with:
```
LIVEKIT_URL=your_livekit_url
LIVEKIT_API_KEY=your_api_key
LIVEKIT_API_SECRET=your_api_secret
```

3. Run the development server:
```bash
pnpm dev
```

The app will run on http://localhost:3001

## How it works

1. User clicks "Start Quiz"
2. Frontend calls `backend.quizStarted` RPC to notify backend
3. User answers questions (all logic is client-side)
4. When quiz completes, frontend calls `backend.quizEnded` with score
5. Backend can send `frontend.hideQuiz` / `frontend.showQuiz` RPCs to hide/show quiz during phone detection

