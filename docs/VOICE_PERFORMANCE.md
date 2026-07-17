# Voice Performance

## Measured Locally

Latest observed diagnostics after startup:

- STT health latency: single-digit to tens of milliseconds when the service is already loaded.
- Ollama health latency: tens of milliseconds.
- Frontend and API respond locally.

These are health latencies, not full speech-to-speech latencies.

## Optimizations Implemented

- Backend gateway keeps the STT provider URL centralized.
- faster-whisper model is loaded once by the Python service via singleton `get_transcriber()`.
- Ollama calls use timeout, keep-alive, context size, fallback model, and streaming abstraction.
- TTS is split by sentence at the backend.
- Conversation memory is bounded and summarized locally.
- Audio uploads are size-limited before forwarding to STT.
- Diagnostics expose provider health and recent local host metrics.

## Remaining Performance Work

- Replace pyttsx3 with Kokoro or Piper for lower latency and better voice quality.
- Add real streaming STT chunks. Current browser fallback records a blob and sends it to the gateway.
- Add OpenWakeWord for low-cost wake detection instead of transcript-based wake detection.
- Add measured per-stage timings from browser capture through first audio.
