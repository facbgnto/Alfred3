$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$pidDir = Join-Path $root 'data/pids'
$logDir = Join-Path $root 'data/logs'
New-Item -ItemType Directory -Force $pidDir, $logDir | Out-Null

function Start-AlfredProcess {
  param(
    [string] $Name,
    [string] $Command,
    [string] $WorkingDirectory
  )

  $logPath = Join-Path $logDir "$Name.log"
  $childCommand = "Set-Location -LiteralPath '$WorkingDirectory'; $Command *> '$logPath'"
  $process = Start-Process `
    -FilePath 'powershell.exe' `
    -ArgumentList @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command', $childCommand) `
    -WorkingDirectory $WorkingDirectory `
    -PassThru `
    -WindowStyle Hidden

  Set-Content -Path (Join-Path $pidDir "$Name.pid") -Value $process.Id
  Write-Host "$Name iniciado (PID $($process.Id), log $logPath)"
}

Start-AlfredProcess -Name 'api' -Command 'npm.cmd run dev -w apps/api' -WorkingDirectory $root
Start-AlfredProcess -Name 'web' -Command 'npm.cmd run dev -w apps/web' -WorkingDirectory $root
Start-AlfredProcess -Name 'voice' -Command '.\.venv\Scripts\python.exe run.py' -WorkingDirectory (Join-Path $root 'apps/voice-service')

Start-Sleep -Seconds 4
node (Join-Path $root 'scripts/doctor.mjs')

Write-Host 'ALFRED iniciado.'
Write-Host 'UI:    http://localhost:5174'
Write-Host 'API:   http://localhost:34777'
Write-Host 'Voice: http://127.0.0.1:8765'
