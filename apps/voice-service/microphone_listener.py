"""Escucha continua local con VAD, filtro de energía y activación por palabra completa."""

import collections
import os
import re
import tempfile
import time
import wave

import httpx
import numpy as np
import sounddevice as sd
import webrtcvad

from app.config import settings
from app.transcriber import get_transcriber
from app.tts import speak
from app.wakeword import WakeWordDetector

FRAME_MS = 30
FRAME_SAMPLES = settings.sample_rate * FRAME_MS // 1000
MAX_FRAMES = max(1, int(settings.max_utterance_seconds * 1000 / FRAME_MS))

# Modo 1 = equilibrio entre sensibilidad y ruido
vad = webrtcvad.Vad(1)
awake_until = 0.0
cooldown_until = 0.0


def publish_state(state: str, reason: str | None = None) -> None:
    try:
        httpx.post(
            f"{settings.api_url}/api/voice/state",
            json={"state": state, "reason": reason},
            timeout=5,
        ).raise_for_status()
    except Exception as exc:
        print(f"Aviso: no se pudo publicar estado {state}: {exc}")


def rms_level(raw: bytes) -> float:
    samples = np.frombuffer(raw, dtype=np.int16).astype(np.float32)
    if samples.size == 0:
        return 0.0
    return float(np.sqrt(np.mean(samples * samples)))


def save_wav(frames: list[bytes]) -> str:
    fd, path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    with wave.open(path, "wb") as wav_file:
        wav_file.setnchannels(1)
        wav_file.setsampwidth(2)
        wav_file.setframerate(settings.sample_rate)
        wav_file.writeframes(b"".join(frames))
    return path


def wake_pattern() -> re.Pattern[str]:
    words = [re.escape(word.strip()) for word in settings.wake_words.split(",") if word.strip()]
    return re.compile(rf"\b(?:{'|'.join(words)})\b", re.IGNORECASE)


def main() -> None:
    global awake_until, cooldown_until

    wake_regex = wake_pattern()
    wake_detector = WakeWordDetector()
    print("ALFRED Voice Engine escuchando. Ctrl+C para salir.")
    print(f"Filtro de ruido RMS: {settings.min_rms} | VAD: equilibrado | Wake word: {settings.wake_words}")
    if wake_detector.available:
        print("Deteccion de wake word: openWakeWord (acustica, sin transcribir).")
    else:
        print("Deteccion de wake word: por transcripcion (legado).")
    publish_state("wake_listening", "microphone-listener-started")

    ring: collections.deque[bytes] = collections.deque(maxlen=8)
    frames: list[bytes] = []
    speaking = False
    silence_ms = 0
    voiced_ms = 0

    with sd.RawInputStream(
        samplerate=settings.sample_rate,
        blocksize=FRAME_SAMPLES,
        dtype="int16",
        channels=1,
    ) as stream:
        while True:
            data, status = stream.read(FRAME_SAMPLES)
            raw = bytes(data)

            # Evita capturar la propia voz TTS y descarta datos almacenados en el buffer.
            if time.time() < cooldown_until:
                ring.clear()
                frames.clear()
                speaking = False
                silence_ms = 0
                voiced_ms = 0
                continue

            if wake_detector.available:
                score = wake_detector.score(raw)
                already_awake = time.time() < awake_until
                if score >= settings.wake_word_threshold and not already_awake:
                    wake_detector.reset()
                    ring.clear()
                    frames = []
                    speaking = False
                    silence_ms = 0
                    voiced_ms = 0
                    awake_until = time.time() + settings.awake_timeout
                    print(f"ALFRED: A su servicio, señor. (wake word acustico, score={score:.2f})")
                    publish_state("speaking", "wake-acknowledgement")
                    speak("A su servicio, señor.")
                    publish_state("listening", "conversation-active")
                    cooldown_until = time.time() + settings.post_tts_cooldown_ms / 1000
                    continue
                if not already_awake:
                    # openWakeWord ya cubre la deteccion de la palabra de activacion sobre
                    # audio crudo: mientras este dormido, no vale la pena acumular audio
                    # ni gastar CPU transcribiendo con Whisper solo para buscar "alfred".
                    continue

            level = rms_level(raw)
            has_energy = level >= settings.min_rms
            is_speech = has_energy and vad.is_speech(raw, settings.sample_rate)

            if not speaking:
                ring.append(raw)
                if is_speech:
                    speaking = True
                    frames = list(ring)
                    silence_ms = 0
                    voiced_ms = FRAME_MS
                continue

            frames.append(raw)
            if is_speech:
                silence_ms = 0
                voiced_ms += FRAME_MS
            else:
                silence_ms += FRAME_MS

            reached_silence = silence_ms >= settings.silence_ms
            reached_limit = len(frames) >= MAX_FRAMES
            if not (reached_silence or reached_limit):
                continue

            captured_frames = frames
            speaking = False
            frames = []
            ring.clear()
            silence_ms = 0

            # No enviar golpes, televisión lejana o fragmentos demasiado cortos a Whisper.
            if voiced_ms < settings.min_speech_ms:
                voiced_ms = 0
                continue
            voiced_ms = 0

            path = save_wav(captured_frames)
            try:
                publish_state("transcribing", "audio-captured")
                text = get_transcriber().transcribe(path).strip()
                if not text:
                    continue

                print("Usted:", text)
                wake_match = wake_regex.search(text)
                if wake_match:
                    awake_until = time.time() + settings.awake_timeout
                    text = wake_regex.sub("", text, count=1).strip(" ,.;:-")
                    if not text:
                        print("ALFRED: A su servicio, señor.")
                        publish_state("speaking", "wake-acknowledgement")
                        speak("A su servicio, señor.")
                        publish_state("listening", "conversation-active")
                        cooldown_until = time.time() + settings.post_tts_cooldown_ms / 1000
                        continue

                if time.time() >= awake_until or not text:
                    continue

                publish_state("thinking", "processing-command")
                response = httpx.post(
                    f"{settings.api_url}/api/voice/transcript",
                    json={"text": text},
                    timeout=120,
                )
                response.raise_for_status()
                answer = response.json()["response"]
                print("ALFRED:", answer)
                publish_state("speaking", "answer-ready")
                speak(answer)
                publish_state("listening", "conversation-active")
                cooldown_until = time.time() + settings.post_tts_cooldown_ms / 1000

            except Exception as exc:
                publish_state("error", str(exc))
                print("Error:", exc)
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass
                if time.time() >= awake_until:
                    publish_state("wake_listening", "waiting-for-wake-word")


if __name__ == "__main__":
    main()
