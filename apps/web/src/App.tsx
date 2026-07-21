import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Brain,
  Database,
  Mic,
  MicOff,
  Send,
  Shield,
  Square,
  Terminal,
  VolumeX,
} from 'lucide-react';
import { VoiceDiagnosticsPanel } from './features/voice/components/VoiceDiagnosticsPanel';
import { VoiceSettingsPanel } from './features/voice/components/VoiceSettingsPanel';
import { cancelVoice, clearMemory, fetchVoiceDiagnostics } from './features/voice/services/voiceApi';
import { useVoiceRecorder } from './features/voice/hooks/useVoiceRecorder';
import type { VoiceDiagnostics } from './features/voice/types/voice';
import { useAlfredSocket } from './hooks/useAlfredSocket';

type Msg = { role: 'user' | 'assistant'; text: string };

const stateLabels: Record<string, string> = {
  offline: 'Desconectado',
  idle: 'Inactivo',
  'waiting-wake-word': 'Esperando Alfred',
  wake_listening: 'Esperando Alfred',
  listening: 'Escuchando',
  processing: 'Procesando',
  transcribing: 'Transcribiendo',
  thinking: 'Pensando',
  executing: 'Ejecutando',
  speaking: 'Hablando',
  interrupted: 'Interrumpido',
  error: 'Error',
};

export default function App() {
  const { connected, state, lastEvent, lastReason, stopPlayback } = useAlfredSocket();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Msg[]>([
    { role: 'assistant', text: 'Todos los sistemas estan preparados, senor.' },
  ]);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [listeningEnabled, setListeningEnabled] = useState(false);
  const [bargeInEnabled, setBargeInEnabled] = useState(true);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [diagnostics, setDiagnostics] = useState<VoiceDiagnostics | null>(null);
  const [diagnosticsLoading, setDiagnosticsLoading] = useState(false);
  const chatRef = useRef<HTMLDivElement>(null);

  function handleBargeIn() {
    stopPlayback();
    void cancelVoice('barge-in');
  }

  const recorder = useVoiceRecorder(
    result => {
      if (result.text) setMessages(current => [...current, { role: 'user', text: result.text }]);
      if (result.response) setMessages(current => [...current, { role: 'assistant', text: result.response }]);
    },
    {
      continuous: listeningEnabled,
      alfredState: state,
      bargeInEnabled: listeningEnabled && bargeInEnabled,
      onBargeIn: handleBargeIn,
    },
  );

  useEffect(() => {
    let disposed = false;

    async function loadDiagnostics() {
      setDiagnosticsLoading(true);
      try {
        const next = await fetchVoiceDiagnostics();
        if (!disposed) setDiagnostics(next);
      } catch {
        if (!disposed) setDiagnostics(null);
      } finally {
        if (!disposed) setDiagnosticsLoading(false);
      }
    }

    loadDiagnostics();
    const interval = setInterval(loadDiagnostics, 10000);
    return () => {
      disposed = true;
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const node = chatRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages]);

  function toggleContinuousListening() {
    const next = !listeningEnabled;
    setListeningEnabled(next);
    if (next) void recorder.start();
  }

  async function send() {
    const text = input.trim();
    if (!text || busy) return;

    setMessages(current => [...current, { role: 'user', text }]);
    setInput('');
    setBusy(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message: text, channel: 'desktop' }),
      });
      const data = await response.json();
      setMessages(current => [
        ...current,
        { role: 'assistant', text: data.response || data.error || 'Sin respuesta' },
      ]);
    } catch {
      setMessages(current => [
        ...current,
        { role: 'assistant', text: 'No pude contactar el nucleo de ALFRED.' },
      ]);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="shell">
      <header>
        <div>
          <span className="eyebrow">WAYNE SYSTEMS / PERSONAL OPERATIONS</span>
          <h1>ALFRED <b>3.0</b></h1>
        </div>
        <div className={`online ${connected ? 'ok' : ''}`}>
          <i />
          {connected ? 'SYSTEM ONLINE' : 'SYSTEM OFFLINE'}
        </div>
      </header>

      <section className="grid">
        <aside className="panel systems">
          <h2>SISTEMAS</h2>
          {[
            [Brain, 'OLLAMA'],
            [Mic, 'VOICE ENGINE'],
            [Database, 'MEMORY'],
            [Shield, 'SECURITY'],
            [Terminal, 'SKILLS'],
          ].map(([Icon, name]) => (
            <div className="sys" key={String(name)}>
              <Icon size={18} aria-hidden="true" />
              <span>{String(name)}</span>
              <em>{connected ? 'ONLINE' : 'CHECK'}</em>
            </div>
          ))}
          <div className="event">
            <small>ULTIMO EVENTO</small>
            <strong>{lastEvent}</strong>
            {lastReason ? <p>{lastReason}</p> : null}
          </div>
        </aside>

        <section className="panel core">
          <div className="orb-wrap">
            <div className={`orb ${state}`} aria-hidden="true"><div /></div>
            <span>{stateLabels[state] ?? state}</span>
          </div>

          <div className="voice-controls" aria-label="Controles de voz">
            <button type="button" onClick={toggleContinuousListening}>
              {listeningEnabled ? <Mic size={17} /> : <MicOff size={17} />}
              {listeningEnabled ? 'Escucha continua' : 'Activar escucha'}
            </button>
            <button
              type="button"
              onClick={() => {
                if (recorder.recording) recorder.stop();
                else void recorder.start();
              }}
            >
              <Mic size={17} />
              {recorder.recording ? 'Finalizar ahora' : 'Probar microfono'}
            </button>
            <button type="button" onClick={() => setMuted(value => !value)}>
              <VolumeX size={17} />
              {muted ? 'Activar voz' : 'Silenciar'}
            </button>
            <button
              type="button"
              disabled={!busy && state !== 'speaking' && state !== 'thinking'}
              onClick={() => {
                stopPlayback();
                void cancelVoice('ui-stop');
              }}
            >
              <Square size={17} />
              Detener
            </button>
            <label className="barge-in-toggle">
              <input
                type="checkbox"
                checked={bargeInEnabled}
                onChange={event => setBargeInEnabled(event.target.checked)}
              />
              Permitir interrumpir a Alfred
            </label>
            <button type="button" onClick={() => setShowVoiceSettings(value => !value)}>
              {showVoiceSettings ? 'Ocultar ajustes de voz' : 'Ajustes de voz'}
            </button>
          </div>
          {showVoiceSettings ? <VoiceSettingsPanel /> : null}
          {recorder.error ? <div className="inline-error" role="alert">{recorder.error}</div> : null}
          <div className="listen-status" aria-live="polite">
            <span>
              {recorder.status === 'waiting-speech' && 'Esperando que hables...'}
              {recorder.status === 'recording' && 'Te estoy escuchando; corto al detectar silencio.'}
              {recorder.status === 'processing' && 'Procesando tu voz...'}
              {recorder.status === 'idle' && (listeningEnabled ? 'Listo para escuchar.' : 'Escucha pausada.')}
              {recorder.status === 'error' && 'Hay un problema con el microfono.'}
            </span>
            <meter min={0} max={1} value={recorder.audioLevel} aria-label="Nivel de audio" />
          </div>
          <div className="device-row">
            <label>
              Microfono
              <select
                value={recorder.selectedDeviceId}
                onChange={event => recorder.setSelectedDeviceId(event.target.value)}
              >
                {recorder.devices.length === 0 ? <option value="">Predeterminado</option> : null}
                {recorder.devices.map(device => (
                  <option key={device.deviceId} value={device.deviceId}>{device.label}</option>
                ))}
              </select>
            </label>
            <label>
              Modelo
              <select value={diagnostics?.config.ollamaVoiceModel ?? 'qwen3:4b'} disabled>
                <option>{diagnostics?.config.ollamaVoiceModel ?? 'qwen3:4b'}</option>
              </select>
            </label>
            <label>
              Voz
              <select value={diagnostics?.config.ttsProvider ?? 'pyttsx3'} disabled>
                <option>{diagnostics?.config.ttsProvider ?? 'pyttsx3'}</option>
              </select>
            </label>
          </div>

          <div className="chat" aria-live="polite" ref={chatRef}>
            {messages.map((message, index) => (
              <div key={`${message.role}-${index}`} className={`msg ${message.role}`}>
                <b>{message.role === 'assistant' ? 'ALFRED' : 'FELIPE'}</b>
                <p>{message.text}</p>
              </div>
            ))}
          </div>

          <div className="composer">
            <input
              value={input}
              onChange={event => setInput(event.target.value)}
              onKeyDown={event => {
                if (event.key === 'Enter') void send();
              }}
              placeholder="Escriba una instruccion..."
              aria-label="Mensaje para Alfred"
            />
            <button type="button" onClick={send} disabled={busy} aria-label="Enviar mensaje">
              <Send size={18} />
            </button>
          </div>
          <button
            className="text-action"
            type="button"
            onClick={() => {
              void clearMemory();
              setMessages([{ role: 'assistant', text: 'Memoria local limpiada.' }]);
            }}
          >
            Borrar memoria local
          </button>
        </section>

        <aside className="panel activity">
          <h2>ESTADO</h2>
          <div className="metric">
            <Activity />
            <span>NUCLEO</span>
            <b>{connected ? 'OPERATIVO' : 'DESCONECTADO'}</b>
          </div>
          <div className="metric">
            <Mic />
            <span>ESCUCHA</span>
            <b>{stateLabels[state] ?? state}</b>
          </div>
          <VoiceDiagnosticsPanel diagnostics={diagnostics} loading={diagnosticsLoading} />
        </aside>
      </section>
    </main>
  );
}
