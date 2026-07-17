#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/data/pids"
LOG_DIR="$ROOT/data/logs"
mkdir -p "$PID_DIR" "$LOG_DIR"

start_service() {
  local name="$1"
  local command="$2"
  local workdir="$3"
  (
    cd "$workdir"
    bash -lc "$command"
  ) >"$LOG_DIR/$name.log" 2>&1 &
  echo "$!" >"$PID_DIR/$name.pid"
  echo "$name iniciado (PID $!)"
}

start_service api "npm run dev -w apps/api" "$ROOT"
start_service web "npm run dev -w apps/web" "$ROOT"
start_service voice "./.venv/bin/python run.py" "$ROOT/apps/voice-service"

sleep 4
node "$ROOT/scripts/doctor.mjs" || true

echo "ALFRED iniciado."
echo "UI:    http://localhost:5174"
echo "API:   http://localhost:34777"
echo "Voice: http://127.0.0.1:8765"
