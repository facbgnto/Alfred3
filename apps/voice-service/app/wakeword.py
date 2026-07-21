"""Deteccion de palabra de activacion con openWakeWord sobre audio crudo.

Mucho mas liviano que el camino anterior (transcribir todo con Whisper y buscar
"alfred" en el texto): corre un modelo ONNX pequeno directamente sobre los frames
de audio, sin gastar CPU en STT mientras nadie ha dicho la palabra de activacion.

No existe un modelo oficial de openWakeWord para "alfred": la libreria distribuye
modelos genericos pre-entrenados (alexa, hey_jarvis, hey_mycroft, hey_rhasspy, timer,
weather). Por defecto se usa "hey_jarvis" (tematicamente el mas cercano a un asistente
tipo mayordomo) hasta que se entrene un modelo propio de "alfred" con el notebook
oficial (https://github.com/dscripka/openWakeWord#training-new-models) y se apunte
VOICE_WAKE_WORD_MODEL_PATH a ese archivo .onnx.

openWakeWord es una dependencia opcional (ver requirements-wakeword.txt): si no esta
instalada, o si falla la descarga del modelo (por ejemplo, sin internet en el primer
arranque), el detector queda "no disponible" y microphone_listener.py sigue con la
deteccion por transcripcion que ya funcionaba antes.
"""
from __future__ import annotations

import numpy as np

from .config import settings

_DEFAULT_MODEL = "hey_jarvis"


class WakeWordDetector:
    def __init__(self) -> None:
        self._model = None
        self._model_key: str | None = None

        if not settings.wake_word_enabled:
            return

        try:
            from openwakeword.model import Model
            from openwakeword.utils import download_models

            model_arg = settings.wake_word_model_path or _DEFAULT_MODEL
            if not settings.wake_word_model_path:
                # Descarga solo si no esta cacheado localmente (no-op en corridas siguientes).
                download_models(model_names=[_DEFAULT_MODEL])

            self._model = Model(wakeword_models=[model_arg], inference_framework="onnx")
            self._model_key = next(iter(self._model.models.keys()))
            print(f"openWakeWord activo con modelo '{self._model_key}'.")
        except Exception as exc:
            print(f"Aviso: openWakeWord no disponible ({exc}); wake word cae a deteccion por transcripcion.")
            self._model = None

    @property
    def available(self) -> bool:
        return self._model is not None

    def score(self, frame: bytes) -> float:
        """Puntaje 0-1 de que el frame contiene la palabra de activacion."""
        if self._model is None or self._model_key is None:
            return 0.0
        samples = np.frombuffer(frame, dtype=np.int16)
        predictions = self._model.predict(samples)
        return float(predictions.get(self._model_key, 0.0))

    def reset(self) -> None:
        if self._model is not None:
            self._model.reset()
