from pathlib import Path
from tempfile import NamedTemporaryFile
import base64
import os
import time

import httpx
from pydantic import BaseModel, Field
from fastapi import FastAPI, File, HTTPException, UploadFile

from .config import settings
from .transcriber import get_transcriber
from .tts import tts_engine

app = FastAPI(title="ALFRED Voice Service", version="3.0.0")


class SpeakRequest(BaseModel):
    text: str = Field(min_length=1, max_length=2000)
    voice: str | None = None
    speed: float = Field(default=1.0, gt=0, le=3)


class CancelRequest(BaseModel):
    requestId: str | None = None


@app.get("/health")
def health():
    return {
        "ok": True,
        "provider": settings.provider,
        "model": settings.model_size,
        "device": settings.device,
        "computeType": settings.compute_type,
        "language": settings.language,
    }


@app.post("/transcribe")
async def transcribe(file: UploadFile = File(...)):
    suffix = Path(file.filename or "audio.wav").suffix or ".wav"
    size = 0
    started_at = time.perf_counter()

    with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
        while chunk := await file.read(1024 * 1024):
            size += len(chunk)
            if size > settings.max_audio_bytes:
                tmp.close()
                os.unlink(tmp.name)
                raise HTTPException(status_code=413, detail="Audio demasiado grande")
            tmp.write(chunk)
        path = tmp.name

    try:
        text = get_transcriber().transcribe(path)
        return {
            "text": text,
            "provider": settings.provider,
            "latencyMs": round((time.perf_counter() - started_at) * 1000),
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"STT no disponible: {exc}") from exc
    finally:
        try:
            os.unlink(path)
        except OSError:
            pass


@app.post("/process")
async def process(file: UploadFile = File(...)):
    result = await transcribe(file)
    text = result["text"]
    if not text:
        return {"text": "", "response": ""}

    async with httpx.AsyncClient(timeout=120) as client:
        response = await client.post(
            f"{settings.api_url}/api/voice/transcript",
            json={"text": text},
        )

    if not response.is_success:
        raise HTTPException(response.status_code, response.text)

    answer = response.json()["response"]
    audio = tts_engine.synthesize(answer)
    return {
        "text": text,
        "response": answer,
        "audioBase64": base64.b64encode(audio).decode("ascii") if audio else None,
        "audioMimeType": "audio/wav",
    }


@app.get("/tts/health")
def tts_health():
    return tts_engine.health()


@app.post("/tts/speak")
def tts_speak(payload: SpeakRequest):
    try:
        audio = tts_engine.synthesize(payload.text, payload.speed)
        return {
            "ok": True,
            "provider": "pyttsx3",
            "audioBase64": base64.b64encode(audio).decode("ascii") if audio else None,
            "audioMimeType": "audio/wav",
        }
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"TTS no disponible: {exc}") from exc


@app.post("/tts/cancel")
def tts_cancel(payload: CancelRequest):
    tts_engine.cancel()
    return {"ok": True, "requestId": payload.requestId}
