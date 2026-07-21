import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));

const mimeByExtension: Record<string, string> = {
  '.wasm': 'application/wasm',
  '.onnx': 'application/octet-stream',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
};

/**
 * Sirve apps/web/public/vad/** en crudo, ANTES de que el middleware de transformacion
 * de modulos de Vite los vea. onnxruntime-web (usado por el VAD real de barge-in) hace
 * `import()` dinamico de su propio loader .mjs/.wasm; Vite rechaza eso quejandose de que
 * los archivos de public/ "solo se pueden referenciar via tags HTML, no importar como
 * modulo". Como este runtime lo importa por su cuenta (no es codigo fuente nuestro), la
 * unica forma de que funcione es responder la request antes de que Vite la intercepte.
 */
function serveVadAssetsRaw(): Plugin {
  const vadDir = path.resolve(dirname, 'public/vad');

  return {
    name: 'serve-vad-assets-raw',
    enforce: 'pre',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url || !req.url.startsWith('/vad/')) {
          next();
          return;
        }

        const cleanUrl = req.url.split('?')[0] ?? '';
        const relative = cleanUrl.replace(/^\/vad\//, '');
        const filePath = path.join(vadDir, relative);

        if (!filePath.startsWith(vadDir)) {
          next();
          return;
        }

        fs.readFile(filePath, (err, data) => {
          if (err) {
            next();
            return;
          }
          const mime = mimeByExtension[path.extname(filePath)] ?? 'application/octet-stream';
          res.setHeader('Content-Type', mime);
          res.end(data);
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), serveVadAssetsRaw()],
  server: {
    proxy: {
      '/api': 'http://localhost:34777',
      '/health': 'http://localhost:34777',
      '/ws': { target: 'ws://localhost:34777', ws: true },
    },
  },
});
