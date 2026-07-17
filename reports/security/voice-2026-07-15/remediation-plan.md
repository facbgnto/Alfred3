# Remediation Plan

1. Add rate limiting to `/api/voice/*`.
2. Add local auth/session protection before LAN exposure.
3. Replace pyttsx3 with Piper or Kokoro.
4. Add browser/runtime E2E coverage for microphone permission failures.
5. Add dependency vulnerability scanning to CI.
