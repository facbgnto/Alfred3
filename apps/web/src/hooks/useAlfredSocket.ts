import { useEffect, useRef, useState } from 'react';
import type { VoiceState } from '../features/voice/types/voice';

type AlfredEvent = {
  type: string;
  timestamp: string;
  payload?: {
    state?: VoiceState;
    reason?: string;
    audioBase64?: string;
    mimeType?: string;
    [key: string]: unknown;
  };
};

export function useAlfredSocket() {
  const [connected, setConnected] = useState(false);
  const [state, setState] = useState<VoiceState>('offline');
  const [lastEvent, setLastEvent] = useState('Sin actividad');
  const [lastReason, setLastReason] = useState('');
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const maxRetries = 5;
  const retryDelay = 2000;

  const audioQueueRef = useRef<{ audioBase64: string; mimeType: string }[]>([]);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const playingRef = useRef(false);

  function stopPlayback() {
    audioQueueRef.current = [];
    playingRef.current = false;
    const audio = currentAudioRef.current;
    if (!audio) return;
    audio.pause();
    audio.src = '';
    currentAudioRef.current = null;
  }

  function playNext() {
    const next = audioQueueRef.current.shift();
    if (!next) {
      playingRef.current = false;
      return;
    }
    playingRef.current = true;
    const audio = new Audio(`data:${next.mimeType};base64,${next.audioBase64}`);
    currentAudioRef.current = audio;
    const advance = () => {
      currentAudioRef.current = null;
      playNext();
    };
    audio.onended = advance;
    audio.onerror = advance;
    void audio.play().catch(advance);
  }

  useEffect(() => {
    let disposed = false;
    let closeAfterOpen = false;

    const connect = () => {
      if (disposed) return;
      const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
      const ws = new WebSocket(`${protocol}://${location.host}/ws`);

      ws.onopen = () => {
        if (closeAfterOpen || disposed) {
          ws.close();
          return;
        }
        setConnected(true);
        retriesRef.current = 0;
      };

      ws.onmessage = event => {
        try {
          const payload = JSON.parse(event.data) as AlfredEvent;
          setLastEvent(payload.type);
          if (payload.type === 'voice.state.changed') {
            setState(payload.payload?.state ?? 'offline');
            setLastReason(payload.payload?.reason ?? '');
          } else if (payload.type === 'tts.audio' && payload.payload?.audioBase64) {
            audioQueueRef.current.push({
              audioBase64: payload.payload.audioBase64,
              mimeType: payload.payload.mimeType ?? 'audio/wav',
            });
            if (!playingRef.current) playNext();
          } else if (payload.type === 'voice.interrupted') {
            stopPlayback();
          }
        } catch {
          setLastEvent('Evento invalido');
        }
      };

      ws.onerror = () => {
        if (disposed) return;
        setConnected(false);
      };

      ws.onclose = () => {
        if (disposed) return;
        setConnected(false);
        setState('offline');
        if (retriesRef.current >= maxRetries) return;
        retriesRef.current += 1;
        reconnectTimeoutRef.current = setTimeout(connect, retryDelay);
      };

      wsRef.current = ws;
    };

    connect();

    return () => {
      disposed = true;
      stopPlayback();
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      const ws = wsRef.current;
      if (!ws) return;
      ws.onmessage = null;
      ws.onerror = null;
      ws.onclose = null;
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      } else if (ws.readyState === WebSocket.CONNECTING) {
        closeAfterOpen = true;
      }
    };
  }, []);

  return { connected, state, lastEvent, lastReason };
}
