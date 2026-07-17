$ErrorActionPreference = 'Continue'

$root = Split-Path -Parent $PSScriptRoot
$pidDir = Join-Path $root 'data/pids'

if (-not (Test-Path $pidDir)) {
  Write-Host 'No hay procesos registrados.'
  exit 0
}

function Stop-ProcessTree {
  param([int] $ProcessId)

  $children = Get-CimInstance Win32_Process -Filter "ParentProcessId=$ProcessId" -ErrorAction SilentlyContinue
  foreach ($child in $children) {
    Stop-ProcessTree -ProcessId $child.ProcessId
  }

  $process = Get-Process -Id $ProcessId -ErrorAction SilentlyContinue
  if ($process) {
    Stop-Process -Id $ProcessId -Force -ErrorAction SilentlyContinue
  }
}

Get-ChildItem -Path $pidDir -Filter '*.pid' | ForEach-Object {
  $name = $_.BaseName
  $pidValue = Get-Content -Path $_.FullName -ErrorAction SilentlyContinue
  if ($pidValue) {
    $process = Get-Process -Id ([int] $pidValue) -ErrorAction SilentlyContinue
    if ($process) {
      Stop-ProcessTree -ProcessId $process.Id
      Write-Host "$name detenido (PID $($process.Id))"
    } else {
      Write-Host "$name no estaba en ejecucion."
    }
  }
  Remove-Item -Path $_.FullName -Force -ErrorAction SilentlyContinue
}
