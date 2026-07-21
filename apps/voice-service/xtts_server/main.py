"""Servidor FastAPI propio para XTTS v2 (clonado de voz local).

No usamos el paquete `xtts-api-server` de PyPI: su version publicada fija
`coqui-tts==0.24.1`, que no instala en Python nuevos (ver requirements-xtts.txt para el
detalle). En su lugar, este archivo es un wrapper minimo y propio sobre `coqui-tts`
directamente, expuesto con el mismo contrato HTTP que ya espera
`apps/api/src/services/voice/providers/XTTSVoiceProvider.ts` (`/tts_to_audio/` y
`/speakers_list`), asi que no hace falta tocar el lado Node.

Licencia: el modelo XTTS v2 de Coqui es CPML (uso no comercial gratis; uso comercial
requiere licencia paga a Coqui). Al arrancar este servidor se acepta esa licencia de
forma no interactiva (COQUI_TOS_AGREED=1) asumiendo un uso personal/no comercial de
Alfred. No usar en un contexto comercial sin licencia de Coqui.

Solo se puede clonar una muestra de voz ya autorizada y colocada de antemano en
XTTS_SAMPLES_DIR (por defecto apps/voice-service/xtts-samples/); el cliente nunca manda
audio crudo ni una ruta arbitraria, solo un identificador de archivo que se resuelve y
sanitiza server-side. Esto evita path traversal y clonacion de voces de terceros sin
autorizacion.
"""
from __future__ import annotations

import os
import re
import tempfile
import threading
from pathlib import Path

os.environ.setdefault("COQUI_TOS_AGREED", "1")

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

SAMPLES_DIR = Path(os.environ.get("XTTS_SAMPLES_DIR", Path(__file__).resolve().parent.parent / "xtts-samples"))
MODEL_NAME = "tts_models/multilingual/multi-dataset/xtts_v2"
_SAFE_ID = re.compile(r"^[a-zA-Z0-9_-]+$")

app = FastAPI(title="ALFRED XTTS Server", version="1.0.0")

_model = None
_model_lock = threading.Lock()


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    speaker_wav: str = Field(min_length=1, max_length=128)
    language: str = "es"


def _resolve_sample(speaker_id: str) -> Path:
    """Resuelve un identificador de muestra a un archivo dentro de SAMPLES_DIR, sin
    permitir salir de ese directorio (sin '..', sin rutas absolutas, sin barras)."""
    if not _SAFE_ID.match(speaker_id):
        raise HTTPException(status_code=400, detail="speaker_wav invalido: solo letras, numeros, guion y guion bajo.")

    for extension in (".wav", ".mp3", ".flac", ".ogg"):
        candidate = (SAMPLES_DIR / f"{speaker_id}{extension}").resolve()
        if candidate.is_relative_to(SAMPLES_DIR.resolve()) and candidate.is_file():
            return candidate

    raise HTTPException(status_code=404, detail=f"No hay una muestra autorizada llamada '{speaker_id}' en {SAMPLES_DIR}.")


def _get_model():
    global _model
    if _model is None:
        with _model_lock:
            if _model is None:
                from TTS.api import TTS

                _model = TTS(MODEL_NAME, progress_bar=False).to("cpu")
    return _model


@app.on_event("startup")
def _warm_up() -> None:
    SAMPLES_DIR.mkdir(parents=True, exist_ok=True)
    # Carga el modelo al arrancar (tarda ~1-2 min la primera vez, con el modelo ya
    # descargado y en cache baja bastante) para que el primer POST /tts_to_audio/ no
    # se coma el timeout del cliente (45s en XTTSVoiceProvider.ts).
    _get_model()


@app.get("/speakers_list")
def speakers_list() -> list[str]:
    if not SAMPLES_DIR.exists():
        return []
    return sorted(p.stem for p in SAMPLES_DIR.iterdir() if p.suffix.lower() in {".wav", ".mp3", ".flac", ".ogg"})


@app.post("/tts_to_audio/")
def tts_to_audio(payload: SpeakRequest):
    sample_path = _resolve_sample(payload.speaker_wav)
    model = _get_model()

    fd, tmp_path = tempfile.mkstemp(suffix=".wav")
    os.close(fd)
    try:
        model.tts_to_file(
            text=payload.text,
            speaker_wav=str(sample_path),
            language=payload.language,
            file_path=tmp_path,
        )
        audio_bytes = Path(tmp_path).read_bytes()
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"XTTS no disponible: {exc}") from exc
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass

    from fastapi.responses import Response
    return Response(content=audio_bytes, media_type="audio/wav")
