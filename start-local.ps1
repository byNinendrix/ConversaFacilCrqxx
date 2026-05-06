param(
  [int]$FrontendPort = 3010,
  [int]$BackendPort = 8081,
  [switch]$RebuildBackend,
  [switch]$UseStaticFrontend
)

$ErrorActionPreference = "Stop"

$root = $PSScriptRoot
$backendDir = Join-Path $root "backend"
$frontendDir = Join-Path $root "frontend"
$pidDir = Join-Path $root ".local"
$backendPidFile = Join-Path $pidDir "backend.pid"
$frontendPidFile = Join-Path $pidDir "frontend.pid"

New-Item -Path $pidDir -ItemType Directory -Force | Out-Null

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

function Stop-ByPort {
  param([int]$Port)

  $processId = Get-ListeningPid -Port $Port
  if ($processId) {
    try {
      Stop-Process -Id $processId -Force -ErrorAction Stop
      Start-Sleep -Milliseconds 400
    } catch {
      Write-Host ("Nao consegui parar PID {0} na porta {1}: {2}" -f $processId, $Port, $_.Exception.Message)
    }
  }
}

function Wait-Port {
  param(
    [int]$Port,
    [int]$TimeoutSec = 25
  )

  $sw = [System.Diagnostics.Stopwatch]::StartNew()
  while ($sw.Elapsed.TotalSeconds -lt $TimeoutSec) {
    if (Get-ListeningPid -Port $Port) {
      return $true
    }
    Start-Sleep -Milliseconds 300
  }

  return $false
}

Stop-ByPort -Port $FrontendPort
Stop-ByPort -Port $BackendPort

if ($RebuildBackend -or -not (Test-Path (Join-Path $backendDir "dist\\server.js"))) {
  Push-Location $backendDir
  try {
    Write-Host "Compilando backend..."
    npm run build
  } finally {
    Pop-Location
  }
}

$backendProc = Start-Process -FilePath "node.exe" -ArgumentList "dist/server.js" -WorkingDirectory $backendDir -PassThru
Set-Content -Path $backendPidFile -Value $backendProc.Id -Encoding Ascii

$frontendCmd = "set PORT={0}&&npm start" -f $FrontendPort

if ($UseStaticFrontend) {
  $buildIndex = Join-Path $frontendDir "build\\index.html"
  if (-not (Test-Path $buildIndex)) {
    Write-Host "build/index.html nao encontrado. Gere o build ou rode sem -UseStaticFrontend."
    exit 1
  }
  $frontendCmd = "set PORT={0}&&node server.js" -f $FrontendPort
}

$frontendProc = Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $frontendCmd -WorkingDirectory $frontendDir -PassThru
Set-Content -Path $frontendPidFile -Value $frontendProc.Id -Encoding Ascii

$backendReady = Wait-Port -Port $BackendPort
$frontendReady = Wait-Port -Port $FrontendPort -TimeoutSec 60

Write-Host ("Backend PID: {0} | porta {1} | pronto: {2}" -f $backendProc.Id, $BackendPort, $backendReady)
Write-Host ("Frontend PID: {0} | porta {1} | pronto: {2}" -f $frontendProc.Id, $FrontendPort, $frontendReady)
Write-Host ("Frontend URL: http://localhost:{0}" -f $FrontendPort)
Write-Host ("Backend URL:  http://localhost:{0}" -f $BackendPort)

if (-not ($backendReady -and $frontendReady)) {
  Write-Host "Falha ao iniciar algum servico local."
  exit 1
}

exit 0
