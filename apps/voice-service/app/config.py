from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

# El proceso arranca con cwd=apps/voice-service (ver scripts/start-alfred.sh), donde no
# hay .env, asi que un simple env_file=".env" nunca encontraba el .env real de la raiz
# del repo y todo el servicio corria en silencio con los defaults de abajo (el mismo bug
# que ya se habia encontrado y arreglado del lado Node en apps/api/src/config/env.ts).
_REPO_ROOT_ENV = Path(__file__).resolve().parent.parent.parent.parent / ".env"


class Settings(BaseSettings):
    api_url: str = "http://127.0.0.1:34777"
    model_size: str = Field("small", validation_alias="VOICE_STT_MODEL")
    device: str = Field("cpu", validation_alias="VOICE_STT_DEVICE")
    compute_type: str = Field("int8", validation_alias="VOICE_STT_COMPUTE_TYPE")
    language: str = Field("es", validation_alias="VOICE_STT_LANGUAGE")
    provider: str = Field("faster-whisper", validation_alias="VOICE_STT_PROVIDER")
    wake_words: str = Field("alfred,alfred", validation_alias="VOICE_WAKE_WORD")
    wake_word_enabled: bool = Field(True, validation_alias="VOICE_WAKE_WORD_ENABLED")
    wake_word_threshold: float = Field(0.5, validation_alias="VOICE_WAKE_WORD_THRESHOLD")
    # Vacio = usa el modelo generico "hey_jarvis" que trae openWakeWord (no existe un
    # modelo oficial para "alfred"; hay que entrenar uno propio para esa palabra exacta,
    # ver docs/VOICE_PROVIDERS.md). Si se entrena uno, apuntar aca al archivo .onnx.
    wake_word_model_path: str = Field("", validation_alias="VOICE_WAKE_WORD_MODEL_PATH")
    sample_rate: int = 16000
    silence_ms: int = Field(600, validation_alias="VOICE_VAD_SILENCE_MS")
    awake_timeout: int = 35
    max_audio_bytes: int = Field(25 * 1024 * 1024, validation_alias="VOICE_MAX_AUDIO_BYTES")

    min_rms: int = 200
    min_speech_ms: int = Field(250, validation_alias="VOICE_VAD_MIN_SPEECH_MS")
    max_utterance_seconds: int = 15
    post_tts_cooldown_ms: int = Field(900, validation_alias="VOICE_WAKE_WORD_COOLDOWN_MS")

    piper_model_path: str = Field("voices/es_ES-davefx-medium.onnx", validation_alias="VOICE_TTS_PIPER_MODEL")
    pitch_shift_semitones: float = Field(0.0, validation_alias="VOICE_TTS_PITCH_SHIFT")
    tts_speed: float = Field(1.0, validation_alias="VOICE_TTS_SPEED")

    model_config = SettingsConfigDict(
        env_file=(str(_REPO_ROOT_ENV), ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )


settings = Settings()
