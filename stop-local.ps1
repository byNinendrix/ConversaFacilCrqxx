param(
  [int]$FrontendPort = 3010,
  [int]$BackendPort = 8081
)

$ErrorActionPreference = "Continue"

$root = $PSScriptRoot
$pidDir = Join-Path $root ".local"
$backendPidFile = Join-Path $pidDir "backend.pid"
$frontendPidFile = Join-Path $pidDir "frontend.pid"

function Get-ListeningPid {
  param([int]$Port)

  $lines = netstat -ano | Select-String "LISTENING"
  foreach ($line in $lines) {
    $value = ($line.Line -replace "\s+", " ").Trim()
    if ($value -match (":{0}\s" -f $Port)) {
      $parts = $value.Split(" ")
      return [int]$parts[-1]
    }
  }

  return $null
}

function Stop-ByPidFile {
  param([string]$PidFile)

  if (-not (Test-Path $PidFile)) {
    return
  }

  $raw = Get-Content $PidFile -ErrorAction SilentlyContinue
  $processId = 0
  if ([int]::TryParse(($raw -join "").Trim(), [ref]$processId)) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host ("Parado PID {0}" -f $processId)
    } catch {
    }
  }

  Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

function Stop-ByPort {
  param([int]$Port)

  $processId = Get-ListeningPid -Port $Port
  if ($processId) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Write-Host ("Parado PID {0} na porta {1}" -f $processId, $Port)
    } catch {
    }
  }
}

Stop-ByPidFile -PidFile $backendPidFile
Stop-ByPidFile -PidFile $frontendPidFile
Stop-ByPort -Port $BackendPort
Stop-ByPort -Port $FrontendPort

Write-Host "Servicos locais finalizados."
