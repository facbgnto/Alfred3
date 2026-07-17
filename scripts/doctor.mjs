import { execFile } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';

const exec = promisify(execFile);

const checks = [];

function record(status, name, detail, fix) {
  checks.push({ status, name, detail, fix });
}

async function command(name, args, label, fix) {
  try {
    const { stdout, stderr } = await exec(name, args, { timeout: 5000 });
    record('OK', label, (stdout || stderr).trim(), fix);
  } catch (error) {
    record('ERROR', label, error.message, fix);
  }
}

async function http(url, label, fix) {
  const startedAt = performance.now();
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
    const latency = Math.round(performance.now() - startedAt);
    record(response.ok ? 'OK' : 'WARNING', label, `HTTP ${response.status} (${latency} ms)`, fix);
  } catch (error) {
    record('ERROR', label, error.message, fix);
  }
}

async function main() {
  await command('node', ['--version'], 'Node.js', 'Instale Node.js 22+.');
  if (process.platform === 'win32') {
    await command('cmd.exe', ['/d', '/s', '/c', 'npm --version'], 'npm', 'Reinstale Node.js/npm.');
  } else {
    await command('npm', ['--version'], 'npm', 'Reinstale Node.js/npm.');
  }
  await command('python', ['--version'], 'Python', 'Instale Python 3.11+ y agreguelo al PATH.');
  await command('ffmpeg', ['-version'], 'ffmpeg', 'Instale ffmpeg y agreguelo al PATH.');
  await command('ollama', ['--version'], 'Ollama CLI', 'Instale Ollama y ejecute ollama serve.');

  try {
    await readFile('.env', 'utf8');
    record('OK', '.env', 'Archivo presente.', 'Copie .env.example a .env.');
  } catch {
    record('WARNING', '.env', 'Archivo .env no encontrado.', 'Copie .env.example a .env.');
  }

  await http('http://127.0.0.1:11434/api/tags', 'Ollama API', 'Ejecute ollama serve y descargue el modelo configurado.');
  await http('http://127.0.0.1:34777/health', 'Alfred API', 'Ejecute npm run dev -w apps/api.');
  await http('http://127.0.0.1:8765/health', 'Voice/STT service', 'Ejecute apps/voice-service/.venv/Scripts/python apps/voice-service/run.py.');
  await http('http://127.0.0.1:34777/api/voice/diagnostics', 'Voice diagnostics', 'Inicie API y servicio de voz.');

  const width = Math.max(...checks.map(check => check.name.length), 10);
  for (const check of checks) {
    const line = `${check.status.padEnd(7)} ${check.name.padEnd(width)} ${check.detail}`;
    console.log(line);
    if (check.status !== 'OK') console.log(`        Fix: ${check.fix}`);
  }

  const hasError = checks.some(check => check.status === 'ERROR');
  process.exitCode = hasError ? 1 : 0;
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
