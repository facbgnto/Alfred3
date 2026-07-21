# Voice Providers

Alfred talks to text-to-speech engines only through `VoiceManager`
(`apps/api/src/services/voice/VoiceManager.ts`). No other module imports a
provider SDK or calls a provider's HTTP API directly — this keeps API keys
out of the frontend and makes it possible to swap providers without
touching the orchestrator, the WebSocket layer, or the UI.

## The `VoiceProvider` interface

`apps/api/src/services/voice/providers/VoiceProvider.ts`:

```typescript
export interface VoiceProvider {
  name: string;
  configured: boolean;
  synthesize(options: SynthesizeOptions): Promise<SynthesizeResult>;
  stream?(options: SynthesizeOptions): AsyncIterable<Uint8Array>;
  healthCheck(): Promise<{ ok: boolean; detail?: string; latencyMs?: number }>;
}
```

`configured` tells `VoiceManager` whether the provider has what it needs
(API key, base URL, voice ID) to be selected at all. A provider that is not
`configured` is skipped and never called — this is what keeps cloud
providers inert until you explicitly set their credentials.

## Providers

| Provider | File | Type | Configured when |
|---|---|---|---|
| Piper / pyttsx3 | `providers/PiperVoiceProvider.ts` | local | always (talks to `apps/voice-service`, the Python process) |
| Kokoro | `providers/KokoroVoiceProvider.ts` | local | always (health-checked against `KOKORO_BASE_URL`) |
| OpenAI | `providers/OpenAIVoiceProvider.ts` | cloud | `OPENAI_API_KEY` + `OPENAI_TTS_MODEL` + `OPENAI_TTS_VOICE` all set |
| ElevenLabs | `providers/ElevenLabsVoiceProvider.ts` | cloud | `ELEVENLABS_API_KEY` + `ELEVENLABS_VOICE_ID` set |
| Cartesia | `providers/CartesiaVoiceProvider.ts` | cloud, **experimental** | `CARTESIA_API_KEY` + `CARTESIA_VOICE_ID` set |
| XTTS v2 | `providers/XTTSVoiceProvider.ts` | local | `XTTS_SPEAKER_ID` set (an authorized local voice sample) |

Alfred ships local-first: the previous security review for this project
explicitly decided not to add external voice APIs. The cloud providers above
exist as real, ready-to-use implementations of their documented REST
contracts, but **none of them are enabled by default** — there is no default
API key, no default model, no default voice for OpenAI/ElevenLabs/Cartesia.
Enable one only if you decide the tradeoff (your voice data leaving the
machine) is acceptable for your use case.

Cartesia is marked experimental because its exact wire format hasn't been
verified against a live account; verify against the current Cartesia docs
before relying on it in production. XTTS v2 (see below) has been built and
verified end-to-end against a real, self-hosted server.

## Selecting a provider

Runtime selection lives in `voiceSettingsStore`
(`apps/api/src/services/voice/settingsStore.ts`), seeded from `.env` and
mutable via `PUT /api/voice/settings` (used by the "Ajustes de voz" panel in
the UI) without restarting the API:

```env
VOICE_TTS_PROVIDER=piper
VOICE_TTS_FALLBACK_PROVIDER=pyttsx3
```

`GET /api/voice/providers` lists every provider with its `configured` flag,
so the frontend can grey out providers that have no credentials yet.

## Fallback

`synthesizeSpeech()` in `VoiceManager.ts`:

1. Normalizes the text (`normalizeForSpeech`) and checks the audio cache.
2. Tries the active provider (`VOICE_TTS_PROVIDER`). If it throws (not
   configured, network error, non-2xx response) and the request was not
   aborted by the user, the failure is logged via `eventBus.emit('tts.provider.failed', ...)`.
3. Tries `VOICE_TTS_FALLBACK_PROVIDER` once. If that also fails, the error
   propagates — the caller (`voiceOrchestrator`) does not crash the whole
   voice turn, it just skips speaking that segment.
4. On success, the result is written back into the audio cache (unless the
   request was marked `sensitive` or caching is disabled).

This never blocks the conversation entirely: a TTS failure degrades to
"no audio for this segment", not a crash.

## Adding a new provider

1. Create `providers/<Name>VoiceProvider.ts` implementing `VoiceProvider`.
2. Register it in the `registry` map in `VoiceManager.ts` and add its name to
   `listedProviderNames`.
3. Add its env vars to `apps/api/src/config/env.ts` (with safe/empty
   defaults) and to `.env.example`.
4. If it needs a new `VOICE_TTS_PROVIDER` enum value, add it to the `zod`
   enum in `env.ts` and to the `voiceSettingsSchema` enum in
   `apps/api/src/routes/http.ts`.

## Configuring each provider

### OpenAI

```env
OPENAI_API_KEY=sk-...
OPENAI_TTS_MODEL=<check the current model name in the OpenAI docs>
OPENAI_TTS_VOICE=<a voice id from the OpenAI docs>
```

There is intentionally no default model or voice — OpenAI's TTS model
lineup changes, and guessing a name here would silently break at runtime.
Set both explicitly after checking `https://platform.openai.com/docs`.

### ElevenLabs

```env
ELEVENLABS_API_KEY=...
ELEVENLABS_VOICE_ID=...
ELEVENLABS_MODEL_ID=eleven_multilingual_v2
ELEVENLABS_STABILITY=0.5
ELEVENLABS_SIMILARITY_BOOST=0.75
ELEVENLABS_STYLE=0
ELEVENLABS_SPEAKER_BOOST=true
ELEVENLABS_OUTPUT_FORMAT=mp3_44100_128
```

### Cartesia (experimental)

```env
CARTESIA_API_KEY=...
CARTESIA_VOICE_ID=...
CARTESIA_MODEL_ID=sonic-2
```

`healthCheck()` for Cartesia intentionally always reports `unavailable`
(`health_check_not_verified`) until someone verifies a real health endpoint
against the current Cartesia API — do not treat that as a bug.

### Kokoro (local)

Run [kokoro-fastapi](https://github.com/remsky/Kokoro-FastAPI) (or a
compatible OpenAI-style TTS server) and point Alfred at it:

```env
KOKORO_BASE_URL=http://127.0.0.1:8880
VOICE_TTS_PROVIDER=kokoro
```

### Piper (local, Raspberry Pi friendly)

Already the default. Runs inside `apps/voice-service` (Python, FastAPI). Put
a Piper `.onnx` voice model in `apps/voice-service/voices/` and set:

```env
VOICE_TTS_PIPER_MODEL=/path/to/es_ES-davefx-medium.onnx
VOICE_TTS_PITCH_SHIFT=0
```

If the model file is missing or fails to load, the Python service falls
back to `pyttsx3` automatically (see `apps/voice-service/app/tts.py`).

### XTTS v2 (local, voice cloning)

Alfred runs its own small FastAPI server for XTTS
(`apps/voice-service/xtts_server/main.py`) instead of the `xtts-api-server`
PyPI package — that package pins `coqui-tts==0.24.1`, which has no wheel for
Python ≥3.13. See `apps/voice-service/requirements-xtts.txt` for the full
story (transformers/torchcodec version issues found and fixed) and the exact
install commands. Verified end-to-end on Python 3.14, CPU-only (no NVIDIA
GPU): the model downloads (~1.9GB, once), loads, and synthesizes correctly —
around **15 seconds per short sentence** on a 12-core CPU. That's too slow
for live back-and-forth conversation; treat it as an opt-in provider for
preview/cached phrases, not the default for `VOICE_TTS_PROVIDER`.

**Licensing**: the XTTS v2 model itself is [CPML](https://coqui.ai/cpml) —
free for non-commercial use, paid license required from Coqui for commercial
use. `xtts_server/main.py` auto-accepts the CPML on startup
(`COQUI_TOS_AGREED=1`), which is appropriate for a personal, non-commercial
assistant — re-evaluate if you ever use Alfred commercially.

Setup:

```bash
python3 -m venv apps/voice-service/.venv-xtts
apps/voice-service/.venv-xtts/bin/pip install -r apps/voice-service/requirements-xtts.txt
apps/voice-service/.venv-xtts/bin/pip install torch torchaudio torchcodec --index-url https://download.pytorch.org/whl/cpu
```

Drop an **authorized** voice sample (your own voice, or one you have rights
to use — Alfred does not support cloning third-party voices without
authorization) as `apps/voice-service/xtts-samples/<id>.wav` (wav/mp3/flac/ogg
all work), then:

```env
XTTS_BASE_URL=http://127.0.0.1:8020
XTTS_SPEAKER_ID=<id>
```

Start the server: `apps/voice-service/.venv-xtts/bin/python apps/voice-service/run_xtts.py`.
The client only ever sends `<id>` (never a path or raw audio); the server
resolves it strictly inside `xtts-samples/` and rejects anything with `/`,
`..`, or characters outside `[a-zA-Z0-9_-]` — confirmed with a live path
traversal attempt during testing (`../../../etc/passwd` → 400, unknown id →
404).

## Voice Activity Detection

The browser uses real Silero VAD via [`@ricky0123/vad-web`](https://github.com/ricky0123/vad)
(`apps/web/src/features/voice/hooks/useVoiceRecorder.ts`), not amplitude/RMS. The
ONNX model and the onnxruntime-web WASM runtime are copied from `node_modules` into
`apps/web/public/vad/` by `apps/web/scripts/copy-vad-assets.mjs`, which runs
automatically on `npm install` (`postinstall`). Those files are gitignored — they are
binaries regenerated locally, not committed. The library is lazy-loaded (dynamic
`import()`) only when the user actually starts listening, so it doesn't add to the
initial page load.

During barge-in (`alfredState === 'speaking'`), the hook raises
`positiveSpeechThreshold`/`negativeSpeechThreshold` via `vad.setOptions(...)` instead
of hand-rolling a second detector — this reuses vad-web's own debounced state machine
rather than duplicating VAD logic.

The Python listener (`apps/voice-service/microphone_listener.py`) still uses
`webrtcvad` for command-utterance segmentation server-side; that is unrelated to the
browser path and unaffected by this.

## Wake word

`apps/voice-service/app/wakeword.py` runs [openWakeWord](https://github.com/dscripka/openWakeWord)
directly on raw audio frames — no more transcribing every utterance with Whisper just
to search for "alfred" in the text. It is an **optional** dependency
(`apps/voice-service/requirements-wakeword.txt`, not in the base `requirements.txt`):
if it isn't installed, or the model can't be loaded/downloaded, wake word detection
falls back automatically to the previous transcript-based check in
`microphone_listener.py` — nothing breaks.

There is no official openWakeWord model for the word "alfred". By default Alfred uses
the generic pretrained `hey_jarvis` model (closest in spirit to a butler-style
assistant). To use the literal word "Alfred", train a custom model with
[openWakeWord's training notebook](https://github.com/dscripka/openWakeWord#training-new-models)
and point `VOICE_WAKE_WORD_MODEL_PATH` at the resulting `.onnx` file.

Install (Linux/Raspberry Pi — see the comment in `requirements-wakeword.txt` for why
this isn't a plain `pip install -r`):

```bash
apps/voice-service/.venv/bin/pip install onnxruntime tqdm scipy scikit-learn requests
apps/voice-service/.venv/bin/pip install --no-deps openwakeword==0.6.0
```

`openwakeword` declares `tflite-runtime` as a hard Linux dependency in its package
metadata, but Alfred only ever uses the ONNX inference backend
(`inference_framework="onnx"` in `wakeword.py`), which never imports `tflite_runtime`.
`tflite-runtime` wheels are frequently unavailable for newer Python versions and for
Raspberry Pi, which makes a plain `pip install -r requirements-wakeword.txt` fail even
though the feature works fine without it — installing without deps and adding the
real transitive dependencies manually (as above) sidesteps that. This was verified
against Python 3.14 on Linux in this repo: with those two commands, openWakeWord loads
and scores audio correctly.

The first time it runs, `download_models(["hey_jarvis"])` fetches the required `.onnx`
files (embedding/melspectrogram/VAD/wake-word models, a few MB total) from GitHub
releases and caches them inside the installed package; subsequent runs reuse the
cache. If there's no internet on first boot (e.g., an offline Raspberry Pi), that
download fails, is caught, and wake word falls back to the transcript-based path —
pre-download the models on a machine with internet and copy the cache over if you need
wake word working fully offline from the start.
