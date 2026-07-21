import Fastify, { type FastifyInstance } from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';
import rateLimit from '@fastify/rate-limit';
import { env } from './config/env.js';
import { httpRoutes } from './routes/http.js';
import { eventBus } from './core/eventBus.js';
import { stateMachine } from './core/stateMachine.js';

export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    logger: process.env.NODE_ENV !== 'test',
    bodyLimit: env.VOICE_MAX_AUDIO_BYTES,
  });
  await app.register(cors, { origin: env.WEB_ORIGIN });
  await app.register(websocket);
  // Limite general: se puede ajustar por ruta con `config.rateLimit` (ver rutas de voz
  // en routes/http.ts, que reciben limites mas estrictos por ser costosas en CPU/red).
  await app.register(rateLimit, {
    global: true,
    max: 120,
    timeWindow: '1 minute',
  });

  app.addContentTypeParser(/^audio\/.+$/, { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  app.addContentTypeParser('application/octet-stream', { parseAs: 'buffer' }, (_req, body, done) => {
    done(null, body);
  });

  app.get('/ws', { websocket: true }, socket => {
    const unsubscribe = eventBus.subscribe(event => {
      if (socket.readyState === 1) socket.send(JSON.stringify(event));
    });

    socket.send(JSON.stringify({
      type: 'system.connected',
      timestamp: new Date().toISOString(),
      payload: { version: '3.0.0' },
    }));

    socket.send(JSON.stringify({
      type: 'voice.state.changed',
      timestamp: new Date().toISOString(),
      payload: { state: stateMachine.get(), reason: 'initial-sync' },
    }));

    socket.on('close', unsubscribe);
  });

  await app.register(httpRoutes);
  return app;
}
