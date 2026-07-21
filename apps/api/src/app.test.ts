import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from './app.js';
import { eventBus } from './core/eventBus.js';
import { voiceSessionManager } from './services/voice/session/voiceSessionManager.js';

type TestSocket = {
  socket: WebSocket;
  next: () => Promise<Record<string, unknown>>;
  close: () => void;
};

describe('WebSocket integration', () => {
  let app: FastifyInstance;
  let baseUrl: string;

  beforeEach(async () => {
    app = await buildApp();
    await app.listen({ port: 0, host: '127.0.0.1' });
    const address = app.server.address();
    if (!address || typeof address === 'string') throw new Error('No pude obtener el puerto del servidor de prueba.');
    baseUrl = `127.0.0.1:${address.port}`;
  });

  afterEach(async () => {
    await app.close();
  });

  function connect(): Promise<TestSocket> {
    return new Promise((resolve, reject) => {
      const socket = new WebSocket(`ws://${baseUrl}/ws`);
      const queue: Record<string, unknown>[] = [];
      const waiters: Array<(msg: Record<string, unknown>) => void> = [];

      // El listener de mensajes se registra ANTES de esperar 'open': el servidor
      // manda system.connected/voice.state.changed apenas acepta la conexion, y si
      // esperaramos a 'open' para recien engancharlo esos mensajes se perderian.
      socket.addEventListener('message', event => {
        const data = JSON.parse(event.data as string) as Record<string, unknown>;
        const waiter = waiters.shift();
        if (waiter) waiter(data);
        else queue.push(data);
      });

      socket.addEventListener('open', () => {
        resolve({
          socket,
          next: () => new Promise(res => {
            const queued = queue.shift();
            if (queued) res(queued);
            else waiters.push(res);
          }),
          close: () => socket.close(),
        });
      }, { once: true });

      socket.addEventListener('error', () => reject(new Error('WS connection failed')), { once: true });
    });
  }

  it('sends system.connected and an initial voice.state.changed on connect', async () => {
    const { next, close } = await connect();
    try {
      const first = await next();
      expect(first.type).toBe('system.connected');

      const second = await next();
      expect(second.type).toBe('voice.state.changed');
      expect((second.payload as { reason: string }).reason).toBe('initial-sync');
    } finally {
      close();
    }
  });

  it('relays eventBus events to connected clients in real time', async () => {
    const { next, close } = await connect();
    try {
      await next(); // system.connected
      await next(); // initial voice.state.changed

      const received = next();
      eventBus.emit('llm.token', { requestId: 'test-request', token: 'hola' });
      const event = await received;

      expect(event.type).toBe('llm.token');
      expect((event.payload as { token: string }).token).toBe('hola');
    } finally {
      close();
    }
  });

  it('broadcasts session start/cancel transitions from voiceSessionManager to the socket', async () => {
    const { next, close } = await connect();
    try {
      await next(); // system.connected
      await next(); // initial voice.state.changed

      // start() dispara dos eventos por el cambio de estado: primero el generico
      // stateMachine 'voice.state.changed', despues el especifico de sesion.
      const stateChangedEvent = next();
      const sessionStateEvent = next();
      const session = voiceSessionManager.start('test-session');
      expect((await stateChangedEvent).type).toBe('voice.state.changed');
      const processing = await sessionStateEvent;
      expect(processing.type).toBe('voice.session.state');
      expect((processing.payload as { state: string }).state).toBe('processing');

      const interruptedEvent = next();
      voiceSessionManager.cancel('test-cancel');
      const interrupted = await interruptedEvent;
      expect(interrupted.type).toBe('voice.interrupted');
      expect((interrupted.payload as { requestId: string }).requestId).toBe(session.requestId);
    } finally {
      close();
    }
  });

  it('stops broadcasting to a socket after it closes', async () => {
    const { next, close, socket } = await connect();
    await next(); // system.connected
    await next(); // initial voice.state.changed

    let gotMessageAfterClose = false;
    socket.addEventListener('message', () => {
      gotMessageAfterClose = true;
    });

    close();
    await new Promise(resolve => socket.addEventListener('close', resolve, { once: true }));

    eventBus.emit('llm.token', { requestId: 'after-close', token: 'x' });
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(gotMessageAfterClose).toBe(false);
  });
});

describe('rate limiting', () => {
  let app: FastifyInstance;

  beforeEach(async () => {
    app = await buildApp();
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 429 after exceeding the per-route limit on an expensive voice endpoint', async () => {
    const responses = [];
    for (let i = 0; i < 21; i += 1) {
      responses.push(await app.inject({ method: 'POST', url: '/api/voice/preview', payload: {} }));
    }
    const statuses = responses.map(response => response.statusCode);
    expect(statuses.slice(0, 20).every(status => status !== 429)).toBe(true);
    expect(statuses[20]).toBe(429);
  });
});
