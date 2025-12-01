# Quiz Frontend

A completely standalone frontend application for taking a trivia quiz. No LiveKit dependencies - just a pure React quiz app.

## Features

- 4 hardcoded trivia questions
- Client-side quiz logic (answers, scoring)
- Pure React component - no external dependencies needed
- Completely independent from LiveKit and the agent

## Setup

1. Install dependencies:
```bash
pnpm install
```

2. Run the development server:
```bash
pnpm dev
```

The app will run on http://localhost:3001

## How it works

1. User opens the quiz page at `http://localhost:3001` (standalone, no connection needed)
2. User clicks "Start Quiz" and answers questions (all logic is client-side)
3. The agent monitors the user's screen share from the NextJS frontend to detect quiz completion
4. Quiz frontend has no knowledge of the agent - it's just a regular quiz webpage

**Note:** The user screen shares from the NextJS frontend (which is connected to LiveKit). The agent sees the screen share and monitors the quiz visually.

