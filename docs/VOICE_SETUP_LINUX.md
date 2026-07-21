# Voice Setup Linux

## Install

```bash
cp -n .env.example .env
bash scripts/setup-linux.sh
ollama pull qwen3:8b
ollama pull qwen3:4b
```

Install system audio and ffmpeg packages for your distro, for example:

```bash
sudo apt-get install -y ffmpeg portaudio19-dev
```

## Run

```bash
bash scripts/start-alfred.sh
```

## Stop

```bash
bash scripts/stop-alfred.sh
```

## Doctor

```bash
npm run doctor
```

## Optional: real wake word (openWakeWord)

By default, wake word detection transcribes everything with Whisper and looks
for "alfred" in the text. For acoustic detection (no transcription needed
until after the wake word), install the optional dependency — see
[VOICE_PROVIDERS.md](./VOICE_PROVIDERS.md#wake-word) for why this needs two
commands instead of a plain `pip install -r`:

```bash
apps/voice-service/.venv/bin/pip install onnxruntime tqdm scipy scikit-learn requests
apps/voice-service/.venv/bin/pip install --no-deps openwakeword==0.6.0
```

If this isn't installed, or the install fails on your Raspberry Pi/Python
version, Alfred keeps working exactly as before (transcript-based wake word).
