# Live Capture Issues Todo List

## Critical Failures (To Fix Immediately)
- [ ] **AI Voice Output not audible**: The user reports hearing no voice prompts ("Let's capture...", "That's a [object]...").
- [ ] **Real-time Transcription missing**: No text appears in the "Your Memory" box during recording.
- [ ] **Database Saving failed/laggy**: The save operation takes minutes and fails to save the memory text.

## investigation Tasks
- [ ] **Verify `responseModalities`**: deeply check if `[Modality.AUDIO, Modality.TEXT]` is correctly handled by the `LiveClient` and the Gemini API. It is possible asking for both simultaneously is causing conflicts or silence on one channel.
- [ ] **Review `LiveClient` implementation**: Ensure the WebSocket message construction for `response_modalities` is correct.
- [ ] **Debug Audio Output**: Verify `AudioStreamer` execution and volume levels.
- [ ] **Debug `handleDone` / Save Flow**: Investigate why the save operation hangs. It might be waiting for a promise that never resolves or a connection close event.

## Planned Fixes (Sequential)
1.  **Simplify Connection Config**: Temporarily isolate Text vs Audio to see which one breaks the other, or if the config is malformed.
2.  **Fix Transcription Stream**: Ensure that when the user speaks, we are receiving *some* event (interrupted? audio? content?).
3.  **Fix Save Timeout**: Ensure `stopLiveCapture` cleanly kills all streams immediately so the save operation isn't blocked by open sockets.
