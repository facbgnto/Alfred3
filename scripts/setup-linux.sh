#!/usr/bin/env bash
set -e
cp -n .env.example .env || true
npm install
python3 -m venv apps/voice-service/.venv
apps/voice-service/.venv/bin/pip install -r apps/voice-service/requirements.txt
echo 'Instalación completa.'
