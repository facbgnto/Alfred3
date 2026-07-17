import { randomUUID } from 'node:crypto';
import { eventBus } from '../../../core/eventBus.js';
import { stateMachine } from '../../../core/stateMachine.js';
import type { VoiceMetrics, VoiceState } from '../../../types/voice.js';

export type VoiceSession = {
  sessionId: string;
  requestId: string;
  state: VoiceState;
  abortController: AbortController;
  startedAt: number;
  metrics: VoiceMetrics;
};

class VoiceSessionManager {
  private active: VoiceSession | null = null;

  start(sessionId = 'default'): VoiceSession {
    this.cancel('new-request');
    const session: VoiceSession = {
      sessionId,
      requestId: randomUUID(),
      state: 'processing',
      abortController: new AbortController(),
      startedAt: performance.now(),
      metrics: {},
    };
    this.active = session;
    this.setState(session.requestId, 'processing', 'voice-session-started');
    return session;
  }

  getActive() {
    return this.active;
  }

  isActive(requestId: string) {
    return this.active?.requestId === requestId && !this.active.abortController.signal.aborted;
  }

  setState(requestId: string, state: VoiceState, reason?: string) {
    if (!this.isActive(requestId) && state !== 'interrupted') return;
    if (this.active?.requestId === requestId) this.active.state = state;
    stateMachine.set(state, reason);
    eventBus.emit('voice.session.state', { requestId, state, reason });
  }

  markMetric(requestId: string, key: keyof VoiceMetrics, value: number) {
    if (!this.isActive(requestId) || !this.active) return;
    this.active.metrics[key] = Math.round(value);
    eventBus.emit('voice.metrics.updated', {
      requestId,
      metrics: this.active.metrics,
    });
  }

  complete(requestId: string) {
    if (!this.isActive(requestId) || !this.active) return;
    this.markMetric(requestId, 'totalResponseMs', performance.now() - this.active.startedAt);
    eventBus.emit('voice.completed', {
      requestId,
      sessionId: this.active.sessionId,
      metrics: this.active.metrics,
    });
    this.active = null;
    stateMachine.set('wake_listening', 'voice-session-completed');
  }

  cancel(reason = 'cancelled') {
    if (!this.active) return null;
    const cancelled = this.active;
    cancelled.abortController.abort(reason);
    eventBus.emit('voice.interrupted', {
      requestId: cancelled.requestId,
      sessionId: cancelled.sessionId,
      reason,
    });
    stateMachine.set('interrupted', reason);
    this.active = null;
    return cancelled;
  }
}

export const voiceSessionManager = new VoiceSessionManager();
