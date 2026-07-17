import { Activity, Brain, Mic, Volume2 } from 'lucide-react';
import type { ProviderHealth, VoiceDiagnostics } from '../types/voice';

const icons = {
  stt: Mic,
  tts: Volume2,
  ollama: Brain,
};

function ProviderRow({
  label,
  health,
  icon,
}: {
  label: string;
  health: ProviderHealth;
  icon: keyof typeof icons;
}) {
  const Icon = icons[icon];
  return (
    <div className={`provider ${health.status}`}>
      <Icon size={18} aria-hidden="true" />
      <div>
        <span>{label}</span>
        <strong>{health.provider}</strong>
        {health.model ? <small>{health.model}</small> : null}
        {health.error ? <small>{health.error}</small> : null}
      </div>
      <em>{health.latencyMs ? `${health.latencyMs} ms` : health.status}</em>
    </div>
  );
}

export function VoiceDiagnosticsPanel({
  diagnostics,
  loading,
}: {
  diagnostics: VoiceDiagnostics | null;
  loading: boolean;
}) {
  if (loading && !diagnostics) {
    return (
      <section className="panel diagnostics" aria-busy="true">
        <h2>DIAGNOSTICO</h2>
        <div className="skeleton" />
        <div className="skeleton" />
        <div className="skeleton" />
      </section>
    );
  }

  if (!diagnostics) {
    return (
      <section className="panel diagnostics">
        <h2>DIAGNOSTICO</h2>
        <div className="empty-state">Sin diagnostico disponible.</div>
      </section>
    );
  }

  return (
    <section className="panel diagnostics">
      <h2>DIAGNOSTICO</h2>
      <div className={`diagnostic-summary ${diagnostics.status}`}>
        <Activity size={18} aria-hidden="true" />
        <span>{diagnostics.status === 'ok' ? 'Pipeline estable' : 'Pipeline degradado'}</span>
      </div>
      <ProviderRow label="STT" health={diagnostics.services.stt} icon="stt" />
      <ProviderRow label="OLLAMA" health={diagnostics.services.ollama} icon="ollama" />
      <ProviderRow label="TTS" health={diagnostics.services.tts} icon="tts" />
      <div className="toggles">
        <span>Wake word: {diagnostics.config.wakeWordEnabled ? 'activo' : 'inactivo'}</span>
        <span>VAD: {diagnostics.config.vadEnabled ? 'activo' : 'inactivo'}</span>
        <span>Barge-in: {diagnostics.config.bargeInEnabled ? 'activo' : 'inactivo'}</span>
      </div>
    </section>
  );
}
