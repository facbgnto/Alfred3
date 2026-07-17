export type SkillRisk = 'read' | 'write' | 'dangerous';
export type SkillMode = 'on-demand' | 'scheduled' | 'continuous';

export interface SkillManifest {
  name: string;
  description: string;
  risk: SkillRisk;
  modes: SkillMode[];
  permissions: string[];
  requiresConfirmation: boolean;
}

export interface Skill extends SkillManifest {
  execute(input: Record<string, unknown>): Promise<unknown>;
}

const skills = new Map<string, Skill>();

export function register(skill: Skill) {
  skills.set(skill.name, skill);
}

export function getSkills() {
  return [...skills.values()].map(({ execute, ...manifest }) => manifest);
}

export async function executeSkill(name: string, input: Record<string, unknown>) {
  const skill = skills.get(name);
  if (!skill) throw new Error(`Skill desconocida: ${name}`);
  if (skill.requiresConfirmation || skill.risk === 'dangerous') {
    throw new Error('Esta skill requiere confirmacion persistente');
  }
  return skill.execute(input);
}

register({
  name: 'system.status',
  description: 'Estado local de ALFRED',
  risk: 'read',
  modes: ['on-demand', 'continuous'],
  permissions: ['system.read'],
  requiresConfirmation: false,
  execute: async () => ({ status: 'online', time: new Date().toISOString() }),
});

register({
  name: 'tasks.list',
  description: 'Lista tareas locales',
  risk: 'read',
  modes: ['on-demand', 'scheduled'],
  permissions: ['tasks.read'],
  requiresConfirmation: false,
  execute: async () => [],
});
