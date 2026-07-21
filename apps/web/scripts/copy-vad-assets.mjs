// Copia los assets binarios de @ricky0123/vad-web (modelo Silero ONNX + worklet)
// y de onnxruntime-web (runtime WASM) a public/vad/, para que el VAD real corra
// 100% local (sin depender de un CDN) y funcione offline. No se comitean al repo
// (son binarios de varios MB regenerables desde node_modules), por eso corre en
// postinstall en vez de vivir en git.
import { copyFileSync, existsSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const webRoot = join(here, '..');
const publicVadDir = join(webRoot, 'public', 'vad');
const publicOrtDir = join(publicVadDir, 'ort');

function findNodeModules(pkg) {
  const candidates = [
    join(webRoot, 'node_modules', pkg),
    join(webRoot, '..', '..', 'node_modules', pkg), // workspaces hoisted a la raiz
  ];
  return candidates.find(existsSync);
}

function copyIfExists(sourceDir, targetDir, filenames) {
  if (!sourceDir) return 0;
  mkdirSync(targetDir, { recursive: true });
  let copied = 0;
  for (const file of filenames) {
    const from = join(sourceDir, file);
    if (existsSync(from)) {
      copyFileSync(from, join(targetDir, file));
      copied += 1;
    }
  }
  return copied;
}

const vadWebDist = findNodeModules('@ricky0123/vad-web');
const ortDist = findNodeModules('onnxruntime-web');

if (!vadWebDist || !ortDist) {
  console.warn('[copy-vad-assets] @ricky0123/vad-web u onnxruntime-web no estan instalados; VAD real quedara indisponible (fallback a deteccion por energia).');
  process.exit(0);
}

const vadCopied = copyIfExists(join(vadWebDist, 'dist'), publicVadDir, [
  'silero_vad_legacy.onnx',
  'silero_vad_v5.onnx',
  'vad.worklet.bundle.min.js',
]);

const ortSourceDir = join(ortDist, 'dist');
const ortFiles = existsSync(ortSourceDir)
  ? readdirSync(ortSourceDir).filter(name => name.endsWith('.wasm') || name.endsWith('.mjs'))
  : [];
const ortCopied = copyIfExists(ortSourceDir, publicOrtDir, ortFiles);

console.log(`[copy-vad-assets] vad-web: ${vadCopied} archivos, onnxruntime-web: ${ortCopied} archivos -> apps/web/public/vad`);
