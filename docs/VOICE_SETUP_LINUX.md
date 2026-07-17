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
