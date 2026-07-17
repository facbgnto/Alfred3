import type { VoiceDiagnostics } from '../types/voice';

export async function fetchVoiceDiagnostics(): Promise<VoiceDiagnostics> {
  const response = await fetch('/api/voice/diagnostics');
  if (!response.ok) {
    throw new Error(`Diagnostico de voz respondio ${response.status}`);
  }
  return response.json();
}

export async function cancelVoice(reason = 'ui-cancel') {
  const response = await fetch('/api/voice/cancel', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
  if (!response.ok) throw new Error(`Cancel respondio ${response.status}`);
  return response.json();
}

export async function clearMemory() {
  const response = await fetch('/api/memory', { method: 'DELETE' });
  if (!response.ok) throw new Error(`Memory clear respondio ${response.status}`);
  return response.json();
}

export async function processVoiceAudio(blob: Blob) {
  const response = await fetch('/api/voice/process', {
    method: 'POST',
    headers: { 'content-type': blob.type || 'audio/webm' },
    body: blob,
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? `Voice process respondio ${response.status}`);
  }
  return response.json() as Promise<{ text: string; response: string }>;
}
