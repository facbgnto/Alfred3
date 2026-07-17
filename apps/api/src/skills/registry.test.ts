import { describe, expect, it } from 'vitest';
import { getSkills } from './registry.js';

describe('skills registry', () => {
  it('exposes skill manifests without executors', () => {
    const status = getSkills().find(skill => skill.name === 'system.status');

    expect(status).toMatchObject({
      risk: 'read',
      modes: ['on-demand', 'continuous'],
      permissions: ['system.read'],
      requiresConfirmation: false,
    });
    expect(status).not.toHaveProperty('execute');
  });
});
