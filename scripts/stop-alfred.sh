#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_DIR="$ROOT/data/pids"

if [[ ! -d "$PID_DIR" ]]; then
  echo "No hay procesos registrados."
  exit 0
fi

for pid_file in "$PID_DIR"/*.pid; do
  [[ -e "$pid_file" ]] || continue
  name="$(basename "$pid_file" .pid)"
  pid="$(cat "$pid_file")"
  if kill -0 "$pid" >/dev/null 2>&1; then
    kill "$pid"
    echo "$name detenido (PID $pid)"
  else
    echo "$name no estaba en ejecucion."
  fi
  rm -f "$pid_file"
done
