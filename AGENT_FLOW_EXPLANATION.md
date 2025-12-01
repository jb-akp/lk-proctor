# Agent.py Data Flow - Line by Line Explanation

## Overview
This document explains the complete flow of data from when a user joins the room to when the agent detects a phone and reads the quiz score.

---

## 1. SERVER STARTUP & AGENT CREATION (Lines 157-171)

**When:** Server starts, before any user connects

```python
159: server = AgentServer()
```
- Creates the LiveKit agent server

```python
161: @server.rtc_session()
162: async def my_agent(ctx: agents.JobContext):
```
- Decorator that runs this function every time a new session starts (when agent joins a room)

```python
163-169: session = AgentSession(...)
```
- Creates the main agent session with:
  - `stt`: Speech-to-text (hears user)
  - `llm`: Main LLM for conversation (gpt-4o-mini)
  - `tts`: Text-to-speech (speaks to user)
  - `vad`: Voice Activity Detection (knows when user stops talking)
  - `turn_detection`: Determines conversation turns

```python
170: vision_llm = openai.LLM(model="gpt-4o-mini")
```
- **Separate** LLM instance specifically for vision (analyzing video frames)
- This is different from the main conversation LLM

```python
171: assistant = ProctorAgent(session, vision_llm)
```
- Creates our custom `ProctorAgent` class instance
- Passes in the session (for conversation) and vision_llm (for analyzing frames)

**Key Point:** At this point, the agent class is created with:
- `self._session` = conversation session
- `self._llm` = vision LLM (for analyzing images)
- `self._latest_camera_frame` = None (will store latest camera frame)
- `self._latest_screen_frame` = None (will store latest screen share frame)
- `self._monitoring_task` = None (will store the phone monitoring task)

---

## 2. AGENT JOINS ROOM - `on_enter()` CALLED (Lines 82-103)

**When:** Agent joins the LiveKit room (right after user connects)

```python
182-191: await session.start(room=ctx.room, agent=assistant, ...)
```
- This triggers `on_enter()` to run automatically

```python
84: self._room = get_job_context().room
```
- Gets the LiveKit room object and stores it in `self._room`
- This gives us access to all participants, tracks, etc.

```python
87: user_participant = self._get_user_participant()
```
- Calls helper to find the user (STANDARD participant, not avatar)

**Inside `_get_user_participant()` (lines 67-79):**
```python
69: remote_participants = list(self._room.remote_participants.values())
```
- Gets all remote participants in the room (users, not the agent itself)

```python
74-76: for participant in remote_participants:
    if participant.kind == rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
        return participant
```
- Filters for STANDARD participants (users)
- Avatars are AGENT kind, so they're filtered out

---

## 3. VIDEO STREAM SETUP (Lines 89-103)

**Two parts: Event listener for NEW tracks + Processing EXISTING tracks**

### Part A: Event Listener for Future Tracks (Lines 90-98)

```python
90: @self._room.on("track_subscribed")
91: def on_track_subscribed(track, publication, participant):
```
- Sets up an event listener that fires whenever a NEW video track is subscribed to
- This will catch the screen share when it starts later

```python
93-94: if track.kind != rtc.TrackKind.KIND_VIDEO:
    return
```
- Only process video tracks (ignore audio)

```python
95-96: if participant.kind != rtc.ParticipantKind.PARTICIPANT_KIND_STANDARD:
    return
```
- Only process tracks from users (not avatars)

```python
98: self._create_video_stream(track, publication.source == rtc.TrackSource.SOURCE_SCREENSHARE)
```
- Creates a video stream for this track
- Second parameter: `True` if screen share, `False` if camera

### Part B: Process Existing Tracks (Lines 100-103)

```python
101: for publication in user_participant.track_publications.values():
```
- Loops through all tracks the user has already published
- At this point, the camera should already be on

```python
102: if publication.track and publication.track.kind == rtc.TrackKind.KIND_VIDEO:
```
- Checks if track exists and is video

```python
103: self._create_video_stream(publication.track, publication.source == rtc.TrackSource.SOURCE_SCREENSHARE)
```
- Creates video stream for the camera track

---

## 4. VIDEO STREAM CREATION - `_create_video_stream()` (Lines 111-129)

**Called for:** Both camera and screen share tracks

```python
113: stream_attr = "_screen_stream" if is_screen_share else "_camera_stream"
114: frame_attr = "_latest_screen_frame" if is_screen_share else "_latest_camera_frame"
```
- Determines which attributes to use based on track type

```python
117-119: existing_stream = getattr(self, stream_attr, None)
if existing_stream is not None:
    asyncio.create_task(existing_stream.aclose())
```
- Closes any existing stream for this track type (if user re-shares screen)

```python
122: stream = rtc.VideoStream(track)
```
- Creates a VideoStream object from the LiveKit track
- This allows us to read frames from the track

```python
123: setattr(self, stream_attr, stream)
```
- Saves the stream object (so we can close it later)

```python
125-127: async def read_stream():
    async for event in stream:
        setattr(self, frame_attr, event.frame)
```
- **Critical:** Inner async function that continuously reads frames
- Each frame is stored in `self._latest_camera_frame` or `self._latest_screen_frame`
- This runs in the background, constantly updating the latest frame

```python
129: asyncio.create_task(read_stream())
```
- Starts the frame-reading loop as a background task
- This runs forever, keeping `_latest_camera_frame` and `_latest_screen_frame` updated

**Result:** 
- `self._latest_camera_frame` = always has the most recent camera frame
- `self._latest_screen_frame` = always has the most recent screen share frame

---

## 5. AGENT GREETS USER (Lines 193-195)

```python
193-195: await session.generate_reply(instructions="Greet the user...")
```
- Main conversation LLM generates a greeting
- Agent says: "Hello! Welcome. How are you doing today? Please share your screen..."

**User responds:** "I've shared my screen"

---

## 6. USER CONFIRMS SCREEN SHARE - `show_quiz_link()` TOOL CALLED (Lines 32-50)

**When:** Main LLM calls the `show_quiz_link` tool (after user confirms)

```python
36: await context.session.say("Perfect! I'm setting up your quiz now...")
```
- Agent speaks immediately (no awkward silence)

```python
39: self._monitoring_task = asyncio.create_task(self._monitor_phone())
```
- **Starts phone monitoring in the background**
- This task runs independently and continuously checks for phones

```python
41: user_participant = self._get_user_participant()
```
- Gets the user participant object again

```python
44-49: await self._room.local_participant.perform_rpc(...)
```
- Sends RPC to the frontend to show quiz link popup
- `destination_identity`: user's identity
- `method`: "frontend.showQuizLink"
- `payload`: "" (empty, URL is hardcoded in frontend)

```python
50: return "Quiz link popup displayed. Now wish the user good luck..."
```
- Returns message to main LLM
- Main LLM then says "Good luck!" and goes silent

**User clicks quiz link, opens quiz in new tab, starts taking quiz**

---

## 7. PHONE MONITORING - `_monitor_phone()` (Lines 142-154)

**Running in background:** Started in step 6, line 39

```python
144: while True:
```
- Infinite loop (runs until phone detected)

```python
145: await asyncio.sleep(6.0)
```
- Wait 6 seconds between checks (reduces API calls)

```python
148-151: response = await self._check_frame_with_llm(self._latest_camera_frame, ...)
```
- Calls helper to analyze the latest camera frame
- Uses vision LLM to check for phones

**Inside `_check_frame_with_llm()` (lines 131-140):**

```python
133: chat_ctx = ChatContext()
```
- Creates a new chat context for the vision LLM

```python
134: chat_ctx.add_message(role="system", content=system_prompt)
```
- Sets system prompt: "You are a proctor. Look for phones..."

```python
135: chat_ctx.add_message(role="user", content=[ImageContent(...)])
```
- Adds the camera frame as an image
- `inference_width/height`: dimensions for LLM to analyze at

```python
138-139: async for chunk in self._llm.chat(chat_ctx=chat_ctx):
    full_text += str(chunk)
```
- Sends to vision LLM (OpenAI GPT-4o-mini)
- Streams response chunks and combines into full text
- Returns: "PHONE_DETECTED" or "CLEAR" or similar

**Back to `_monitor_phone()`:**

```python
152: if "PHONE_DETECTED" in response.upper() or "PHONE" in response.upper():
```
- Checks if LLM detected a phone

```python
153: await self._session.say("I've detected a phone in view...")
```
- **Agent speaks:** "I've detected a phone in view. Please put it away..."
- `add_to_chat_ctx=False`: Don't add this to conversation history

```python
154: break
```
- Exits the monitoring loop (stops checking after first detection)

**User puts phone away, continues quiz**

---

## 8. USER SAYS "I'M DONE" - `check_quiz_score()` TOOL CALLED (Lines 53-65)

**When:** User says "I'm done with the quiz" or similar

**Main LLM calls:** `check_quiz_score` tool

```python
57-62: response = await self._check_frame_with_llm(self._latest_screen_frame, ...)
```
- **Uses screen share frame** (not camera)
- Analyzes the latest screen frame to find the quiz completion screen
- System prompt: "Look for 'Quiz Complete!' and score like 'X/4'"

**Inside `_check_frame_with_llm()` again:**
- Creates chat context with system prompt about quiz completion
- Adds screen share frame as image (1024x768 resolution)
- Sends to vision LLM
- Returns: "4/4" or "3 out of 4" or "The quiz is still in progress"

```python
64: self._stop_monitoring()
```
- Stops phone monitoring (no longer needed)

**Inside `_stop_monitoring()` (lines 105-109):**

```python
107: if self._monitoring_task:
    self._monitoring_task.cancel()
```
- Cancels the background monitoring task
- Prevents future phone checks

```python
65: return response
```
- Returns the score text (e.g., "4/4" or "3 out of 4")

**Back to main LLM:**
- Receives tool return value: "4/4"
- Main LLM generates natural response: "Congratulations! You got 4 out of 4! Excellent work!"
- Agent speaks this to the user

---

## DATA FLOW SUMMARY

1. **Agent joins** → `on_enter()` runs → Sets up frame readers for camera
2. **User shares screen** → Event listener catches it → Sets up frame reader for screen
3. **Frame readers continuously update:**
   - `self._latest_camera_frame` = most recent camera frame
   - `self._latest_screen_frame` = most recent screen frame
4. **Quiz starts** → Phone monitoring task starts → Checks camera every 6 seconds
5. **Phone detected** → Vision LLM sees phone → Agent speaks warning → Monitoring stops
6. **User finishes** → `check_quiz_score()` called → Vision LLM analyzes screen → Returns score → Main LLM announces score

---

## KEY CONCEPTS

- **Two LLMs:**
  - Main LLM (`session`): Handles conversation
  - Vision LLM (`self._llm`): Analyzes video frames
  
- **Frame Buffering:**
  - Background tasks continuously update `_latest_camera_frame` and `_latest_screen_frame`
  - We always analyze the "latest" frame, not a specific timestamp
  
- **Async Tasks:**
  - Phone monitoring runs independently (`asyncio.create_task`)
  - Frame reading runs independently
  - All can run simultaneously without blocking

