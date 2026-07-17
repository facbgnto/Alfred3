$ErrorActionPreference='Stop'
Copy-Item .env.example .env -ErrorAction SilentlyContinue
npm install
python -m venv apps/voice-service/.venv
& apps/voice-service/.venv/Scripts/pip install -r apps/voice-service/requirements.txt
Write-Host 'Instalación completa. Ejecute scripts/start-windows.ps1'
