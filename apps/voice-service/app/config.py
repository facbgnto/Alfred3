from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    api_url: str = "http://127.0.0.1:34777"
    model_size: str = Field("small", validation_alias="VOICE_STT_MODEL")
    device: str = Field("cpu", validation_alias="VOICE_STT_DEVICE")
    compute_type: str = Field("int8", validation_alias="VOICE_STT_COMPUTE_TYPE")
    language: str = Field("es", validation_alias="VOICE_STT_LANGUAGE")
    provider: str = Field("faster-whisper", validation_alias="VOICE_STT_PROVIDER")
    wake_words: str = Field("alfred,alfred", validation_alias="VOICE_WAKE_WORD")
    sample_rate: int = 16000
    silence_ms: int = Field(600, validation_alias="VOICE_VAD_SILENCE_MS")
    awake_timeout: int = 35
    max_audio_bytes: int = Field(25 * 1024 * 1024, validation_alias="VOICE_MAX_AUDIO_BYTES")

    min_rms: int = 200
    min_speech_ms: int = Field(250, validation_alias="VOICE_VAD_MIN_SPEECH_MS")
    max_utterance_seconds: int = 15
    post_tts_cooldown_ms: int = Field(900, validation_alias="VOICE_WAKE_WORD_COOLDOWN_MS")

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
        populate_by_name=True,
    )


settings = Settings()
