import io
import os
import tempfile
import threading
import wave
from pathlib import Path

import pyttsx3

from .config import settings

VOICES_DIR = Path(__file__).resolve().parent.parent / "voices"
_configured_model = Path(settings.piper_model_path)
# La ruta puede venir absoluta o relativa a apps/voice-service (convencion de .env).
PIPER_MODEL = _configured_model if _configured_model.is_absolute() else VOICES_DIR.parent / _configured_model
PITCH_SHIFT_SEMITONES = settings.pitch_shift_semitones


def _pitch_shift_wav(wav_bytes: bytes, semitones: float) -> bytes:
    """Baja (o sube) el tono manteniendo la duracion, via librosa (phase vocoder)."""
    if not semitones or not wav_bytes:
        return wav_bytes
    try:
        import librosa
        import soundfile as sf
    except ImportError:
        return wav_bytes

    audio, sample_rate = sf.read(io.BytesIO(wav_bytes), dtype="float32")
    shifted = librosa.effects.pitch_shift(audio, sr=sample_rate, n_steps=semitones)
    out = io.BytesIO()
    sf.write(out, shifted, sample_rate, subtype="PCM_16", format="WAV")
    return out.getvalue()


class PyttsxEngine:
    """Motor de respaldo (robotico, offline). Se usa si Piper no esta disponible."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._engine: pyttsx3.Engine | None = None
        self._cancelled = False

    def _get_engine(self) -> pyttsx3.Engine:
        if self._engine is None:
            engine = pyttsx3.init()
            engine.setProperty("rate", 165)
            engine.setProperty("volume", 0.95)
            for voice in engine.getProperty("voices"):
                name = voice.name.lower()
                if "spanish" in name or "español" in name or "espanol" in name:
                    engine.setProperty("voice", voice.id)
                    break
            self._engine = engine
        return self._engine

    def synthesize(self, text: str, speed: float = 1.0) -> bytes:
        with self._lock:
            self._cancelled = False
            engine = self._get_engine()
            engine.setProperty("rate", max(80, min(260, int(165 * speed))))

            fd, path = tempfile.mkstemp(suffix=".wav")
            os.close(fd)
            try:
                engine.save_to_file(text, path)
                engine.runAndWait()
                if self._cancelled:
                    return b""
                with open(path, "rb") as fh:
                    return fh.read()
            finally:
                try:
                    os.unlink(path)
                except OSError:
                    pass

    def speak(self, text: str, speed: float = 1.0) -> None:
        with self._lock:
            self._cancelled = False
            engine = self._get_engine()
            engine.setProperty("rate", max(80, min(260, int(165 * speed))))
            engine.say(text)
            engine.runAndWait()
            if self._cancelled:
                engine.stop()

    def cancel(self) -> None:
        with self._lock:
            self._cancelled = True
            if self._engine is not None:
                self._engine.stop()


class PiperEngine:
    """Voz neuronal local (ONNX). Mucho mas natural y rapida que pyttsx3."""

    def __init__(self, model_path: Path) -> None:
        from piper import PiperVoice

        self._lock = threading.Lock()
        self._voice = PiperVoice.load(str(model_path))

    def synthesize(self, text: str, speed: float = 1.0) -> bytes:
        from piper.config import SynthesisConfig

        syn_config = SynthesisConfig(length_scale=1.0 / max(0.25, min(3.0, speed)))
        buffer = io.BytesIO()
        with self._lock, wave.open(buffer, "wb") as wav_file:
            self._voice.synthesize_wav(text, wav_file, syn_config=syn_config)
        return _pitch_shift_wav(buffer.getvalue(), PITCH_SHIFT_SEMITONES)


class TtsEngine:
    def __init__(self) -> None:
        self._fallback = PyttsxEngine()
        self._piper: PiperEngine | None = None
        self._piper_load_failed = False

    def _get_piper(self) -> PiperEngine | None:
        if self._piper is not None or self._piper_load_failed:
            return self._piper
        if not PIPER_MODEL.exists():
            self._piper_load_failed = True
            return None
        try:
            self._piper = PiperEngine(PIPER_MODEL)
        except Exception:
            self._piper_load_failed = True
            return None
        return self._piper

    def health(self) -> dict:
        piper = self._get_piper()
        return {
            "ok": True,
            "provider": "piper" if piper else "pyttsx3",
            "voice": PIPER_MODEL.stem if piper else "system-spanish",
            "streaming": False,
        }

    def synthesize(self, text: str, speed: float = 1.0) -> bytes:
        clean = text.strip()
        if not clean:
            return b""

        piper = self._get_piper()
        if piper is not None:
            try:
                return piper.synthesize(clean, speed)
            except Exception:
                pass
        return self._fallback.synthesize(clean, speed)

    def speak(self, text: str, speed: float = 1.0) -> None:
        """Reproduce por los altavoces del servidor. Solo para uso local (microphone_listener.py)."""
        self._fallback.speak(text.strip(), speed)

    def cancel(self) -> None:
        self._fallback.cancel()


tts_engine = TtsEngine()


def speak(text: str):
    tts_engine.speak(text)
