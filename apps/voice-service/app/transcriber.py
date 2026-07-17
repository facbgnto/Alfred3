from faster_whisper import WhisperModel

from .config import settings


class Transcriber:
    def __init__(self) -> None:
        self.model = WhisperModel(
            settings.model_size,
            device=settings.device,
            compute_type=settings.compute_type,
        )

    def transcribe(self, path: str) -> str:
        segments, info = self.model.transcribe(
            path,
            language=settings.language,
            vad_filter=True,
            vad_parameters={
                "min_speech_duration_ms": settings.min_speech_ms,
                "min_silence_duration_ms": 500,
            },
            beam_size=3,
            temperature=0.0,
            condition_on_previous_text=False,
            # No forzar nombres: en ruido Whisper puede inventar el contenido del prompt.
            initial_prompt=None,
            no_speech_threshold=0.6,
            log_prob_threshold=-1.0,
            compression_ratio_threshold=2.4,
        )

        text_parts: list[str] = []
        for segment in segments:
            text = segment.text.strip()
            if not text:
                continue
            # Descarta segmentos con alta probabilidad de no contener voz real.
            if getattr(segment, "no_speech_prob", 0.0) > 0.65:
                continue
            text_parts.append(text)

        return " ".join(text_parts).strip()


transcriber: Transcriber | None = None


def get_transcriber() -> Transcriber:
    global transcriber
    if transcriber is None:
        transcriber = Transcriber()
    return transcriber
