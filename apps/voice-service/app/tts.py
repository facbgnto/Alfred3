import threading

import pyttsx3


class TtsEngine:
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

    def health(self) -> dict:
        return {
            "ok": True,
            "provider": "pyttsx3",
            "voice": "system-spanish",
            "streaming": False,
        }

    def speak(self, text: str, speed: float = 1.0) -> None:
        clean = text.strip()
        if not clean:
            return

        with self._lock:
            self._cancelled = False
            engine = self._get_engine()
            engine.setProperty("rate", max(80, min(260, int(165 * speed))))
            engine.say(clean)
            engine.runAndWait()
            if self._cancelled:
                engine.stop()

    def cancel(self) -> None:
        with self._lock:
            self._cancelled = True
            if self._engine is not None:
                self._engine.stop()


tts_engine = TtsEngine()


def speak(text: str):
    tts_engine.speak(text)
