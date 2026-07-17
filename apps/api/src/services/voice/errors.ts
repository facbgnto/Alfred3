export type VoiceErrorCode =
  | 'AUDIO_TOO_LARGE'
  | 'INVALID_AUDIO'
  | 'STT_UNAVAILABLE'
  | 'STT_TIMEOUT'
  | 'TTS_UNAVAILABLE'
  | 'OLLAMA_UNAVAILABLE'
  | 'PROVIDER_UNAVAILABLE';

export class VoiceError extends Error {
  constructor(
    public readonly code: VoiceErrorCode,
    message: string,
    public readonly retryable = true,
    public readonly statusCode = 503,
  ) {
    super(message);
    this.name = 'VoiceError';
  }
}

export class SttError extends VoiceError {
  constructor(code: VoiceErrorCode, message: string, retryable = true) {
    super(code, message, retryable, code === 'INVALID_AUDIO' || code === 'AUDIO_TOO_LARGE' ? 400 : 503);
    this.name = 'SttError';
  }
}

export class OllamaError extends VoiceError {
  constructor(message: string, retryable = true) {
    super('OLLAMA_UNAVAILABLE', message, retryable, 503);
    this.name = 'OllamaError';
  }
}

export class TtsError extends VoiceError {
  constructor(message: string, retryable = true) {
    super('TTS_UNAVAILABLE', message, retryable, 503);
    this.name = 'TtsError';
  }
}

export function voiceErrorResponse(error: unknown) {
  if (error instanceof VoiceError) {
    return {
      statusCode: error.statusCode,
      body: {
        success: false,
        error: {
          code: error.code,
          message: error.message,
          retryable: error.retryable,
        },
      },
    };
  }

  return {
    statusCode: 500,
    body: {
      success: false,
      error: {
        code: 'VOICE_ERROR',
        message: error instanceof Error ? error.message : 'Error desconocido',
        retryable: true,
      },
    },
  };
}
