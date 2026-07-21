import { useEffect, useState } from 'react';
import {
  fetchVoiceProviders,
  fetchVoiceSettings,
  fetchVoiceVoices,
  previewVoice,
  updateVoiceSettings,
} from '../services/voiceApi';
import type { VoiceMode, VoiceProvidersResponse, VoiceSettings, VoiceVoicesResponse } from '../types/voice';

const modeLabels: Record<VoiceMode, string> = {
  normal: 'Normal',
  conversation: 'Conversacion',
  programming: 'Programacion',
  explanation: 'Explicacion',
  navigation: 'Navegacion',
  reminder: 'Recordatorio',
  alarm: 'Alarma',
  music: 'Musica',
  error: 'Error',
  celebration: 'Celebracion',
};

function playBase64Audio(audioBase64: string, mimeType: string) {
  const audio = new Audio(`data:${mimeType};base64,${audioBase64}`);
  void audio.play().catch(() => undefined);
}

export function VoiceSettingsPanel() {
  const [settings, setSettings] = useState<VoiceSettings | null>(null);
  const [providers, setProviders] = useState<VoiceProvidersResponse | null>(null);
  const [voices, setVoices] = useState<VoiceVoicesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let disposed = false;
    async function load() {
      setLoading(true);
      try {
        const [nextSettings, nextProviders, nextVoices] = await Promise.all([
          fetchVoiceSettings(),
          fetchVoiceProviders(),
          fetchVoiceVoices(),
        ]);
        if (disposed) return;
        setSettings(nextSettings);
        setProviders(nextProviders);
        setVoices(nextVoices);
        setError('');
      } catch (err) {
        if (!disposed) setError(err instanceof Error ? err.message : 'No pude cargar los ajustes de voz.');
      } finally {
        if (!disposed) setLoading(false);
      }
    }
    void load();
    return () => {
      disposed = true;
    };
  }, []);

  async function applyChange(partial: Partial<VoiceSettings>) {
    if (!settings) return;
    const previous = settings;
    setSettings({ ...settings, ...partial });
    setSaving(true);
    try {
      const updated = await updateVoiceSettings(partial);
      setSettings(updated);
      setError('');
    } catch (err) {
      setSettings(previous);
      setError(err instanceof Error ? err.message : 'No pude guardar el cambio.');
    } finally {
      setSaving(false);
    }
  }

  async function handleTestVoice() {
    setTesting(true);
    setError('');
    try {
      const result = await previewVoice();
      playBase64Audio(result.audioBase64, result.audioMimeType);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude probar la voz.');
    } finally {
      setTesting(false);
    }
  }

  async function handleReset() {
    setSaving(true);
    try {
      const updated = await updateVoiceSettings({
        ttsProvider: 'piper',
        ttsFallbackProvider: 'pyttsx3',
        ttsSpeed: 0.96,
        mode: 'conversation',
        cacheEnabled: true,
        bargeInEnabled: true,
        continuousConversation: false,
        volume: 1,
      });
      setSettings(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No pude restablecer los ajustes.');
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="voice-settings loading">Cargando ajustes de voz...</div>;
  if (!settings) return <div className="voice-settings error">{error || 'Ajustes de voz no disponibles.'}</div>;

  const ttsProviders = providers?.tts.providers ?? [];
  const activeVoices = (voices?.[settings.ttsProvider] as Array<{ id: string; label: string }> | undefined) ?? [];

  return (
    <div className="voice-settings panel">
      <h2>Ajustes de voz</h2>

      <label className="row">
        <span>Voz activada</span>
        <input
          type="checkbox"
          checked={settings.enabled}
          onChange={event => void applyChange({ enabled: event.target.checked })}
        />
      </label>

      <label className="row">
        <span>Proveedor TTS</span>
        <select
          value={settings.ttsProvider}
          onChange={event => void applyChange({ ttsProvider: event.target.value as VoiceSettings['ttsProvider'] })}
        >
          {ttsProviders.map(provider => (
            <option key={provider.name} value={provider.name} disabled={!provider.configured && provider.name !== 'piper'}>
              {provider.name}{provider.configured ? '' : ' (sin configurar)'}
            </option>
          ))}
        </select>
      </label>

      <label className="row">
        <span>Proveedor de respaldo</span>
        <select
          value={settings.ttsFallbackProvider}
          onChange={event => void applyChange({ ttsFallbackProvider: event.target.value as VoiceSettings['ttsFallbackProvider'] })}
        >
          {ttsProviders.map(provider => (
            <option key={provider.name} value={provider.name}>{provider.name}</option>
          ))}
          <option value="pyttsx3">pyttsx3</option>
        </select>
      </label>

      <label className="row">
        <span>Voz</span>
        <select value={settings.ttsVoice} onChange={event => void applyChange({ ttsVoice: event.target.value })}>
          {activeVoices.length === 0 ? <option value={settings.ttsVoice}>{settings.ttsVoice}</option> : null}
          {activeVoices.map(voice => (
            <option key={voice.id} value={voice.id}>{voice.label}</option>
          ))}
        </select>
      </label>

      <label className="row">
        <span>Modo de voz</span>
        <select value={settings.mode} onChange={event => void applyChange({ mode: event.target.value as VoiceMode })}>
          {Object.entries(modeLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>

      <label className="row">
        <span>Velocidad ({settings.ttsSpeed.toFixed(2)}x)</span>
        <input
          type="range"
          min={0.5}
          max={2}
          step={0.02}
          value={settings.ttsSpeed}
          onChange={event => void applyChange({ ttsSpeed: Number(event.target.value) })}
        />
      </label>

      <label className="row">
        <span>Volumen ({Math.round(settings.volume * 100)}%)</span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.05}
          value={settings.volume}
          onChange={event => void applyChange({ volume: Number(event.target.value) })}
        />
      </label>

      <label className="row">
        <span>Conversacion continua</span>
        <input
          type="checkbox"
          checked={settings.continuousConversation}
          onChange={event => void applyChange({ continuousConversation: event.target.checked })}
        />
      </label>

      <label className="row">
        <span>Permitir interrupciones (barge-in)</span>
        <input
          type="checkbox"
          checked={settings.bargeInEnabled}
          onChange={event => void applyChange({ bargeInEnabled: event.target.checked })}
        />
      </label>

      <label className="row">
        <span>Cache de audio</span>
        <input
          type="checkbox"
          checked={settings.cacheEnabled}
          onChange={event => void applyChange({ cacheEnabled: event.target.checked })}
        />
      </label>

      {error ? <div className="inline-error" role="alert">{error}</div> : null}
      {saving ? <div className="voice-settings-saving">Guardando...</div> : null}

      <div className="voice-settings-actions">
        <button type="button" onClick={() => void handleTestVoice()} disabled={testing}>
          {testing ? 'Probando...' : 'Probar voz de Alfred'}
        </button>
        <button type="button" onClick={() => void handleReset()} disabled={saving}>
          Restablecer valores predeterminados
        </button>
      </div>
    </div>
  );
}
