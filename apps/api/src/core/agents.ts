export type AgentMode = 'on-demand' | 'scheduled' | 'continuous';

export type AgentProfile = {
  id: string;
  name: string;
  description: string;
  mode: AgentMode;
  systemPrompt: string;
  allowedTools: string[];
  memoryEnabled: boolean;
};

const agents = new Map<string, AgentProfile>();

function registerAgent(agent: AgentProfile) {
  agents.set(agent.id, agent);
}

registerAgent({
  id: 'orchestrator',
  name: 'Orquestador',
  description: 'Agente principal para conversaciones y seleccion manual de herramientas.',
  mode: 'on-demand',
  systemPrompt: [
    'Eres ALFRED, un asistente local elegante, calmado, preciso y proactivo.',
    'Responde en espanol, de forma breve y util.',
    'No inventes acciones realizadas; si una herramienta no confirma una accion, dilo con claridad.',
  ].join(' '),
  allowedTools: ['system.status'],
  memoryEnabled: true,
});

registerAgent({
  id: 'voice_companion',
  name: 'Companion de voz',
  description: 'Agente breve y conversacional optimizado para turnos de voz.',
  mode: 'continuous',
  systemPrompt: [
    'Eres ALFRED en modo voz, un asistente local en espanol.',
    'Responde con frases cortas, tono calmado y sin listas largas salvo que el usuario lo pida.',
    'No afirmes haber ejecutado acciones si no hay una herramienta registrada que lo confirme.',
  ].join(' '),
  allowedTools: ['system.status'],
  memoryEnabled: true,
});

registerAgent({
  id: 'local_research',
  name: 'Investigador local',
  description: 'Agente para analisis mas cuidadoso usando memoria local disponible.',
  mode: 'on-demand',
  systemPrompt: [
    'Eres ALFRED en modo investigacion local.',
    'Separa hechos de inferencias, cita la memoria local cuando sea relevante y pide confirmacion antes de actuar.',
  ].join(' '),
  allowedTools: ['system.status'],
  memoryEnabled: true,
});

export function listAgents() {
  return Array.from(agents.values()).map(agent => ({
    id: agent.id,
    name: agent.name,
    description: agent.description,
    mode: agent.mode,
    allowedTools: agent.allowedTools,
    memoryEnabled: agent.memoryEnabled,
  }));
}

export function getAgent(id?: string, channel = 'desktop') {
  if (id) {
    const agent = agents.get(id);
    if (!agent) throw new Error(`Agente desconocido: ${id}`);
    return agent;
  }

  return channel === 'voice'
    ? agents.get('voice_companion')!
    : agents.get('orchestrator')!;
}
