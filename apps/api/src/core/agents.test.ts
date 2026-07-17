import { describe, expect, it } from 'vitest';
import { getAgent, listAgents } from './agents.js';

describe('agents registry', () => {
  it('lists local-first agent modes', () => {
    expect(listAgents()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'orchestrator', mode: 'on-demand' }),
      expect.objectContaining({ id: 'voice_companion', mode: 'continuous' }),
    ]));
  });

  it('selects the voice companion for voice channel by default', () => {
    expect(getAgent(undefined, 'voice').id).toBe('voice_companion');
  });

  it('rejects unknown agents', () => {
    expect(() => getAgent('missing')).toThrow('Agente desconocido');
  });
});
