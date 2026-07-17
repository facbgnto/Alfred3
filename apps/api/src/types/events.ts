export type AlfredState =
  | 'offline'
  | 'idle'
  | 'waiting-wake-word'
  | 'wake_listening'
  | 'listening'
  | 'processing'
  | 'transcribing'
  | 'thinking'
  | 'executing'
  | 'speaking'
  | 'interrupted'
  | 'error';

export type AlfredEvent = {
  type: string;
  timestamp: string;
  payload?: unknown;
};
