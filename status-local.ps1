param(
  [int]$FrontendPort = 3010,
  [int]$BackendPort = 8081
)

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

$frontendProcessId = Get-ListeningPid -Port $FrontendPort
$backendProcessId = Get-ListeningPid -Port $BackendPort

Write-Host ("Frontend {0}: {1}" -f $FrontendPort, $(if ($frontendProcessId) { "ON (PID $frontendProcessId)" } else { "OFF" }))
Write-Host ("Backend  {0}: {1}" -f $BackendPort, $(if ($backendProcessId) { "ON (PID $backendProcessId)" } else { "OFF" }))

if ($frontendProcessId) {
  Write-Host ("Frontend URL: http://localhost:{0}" -f $FrontendPort)
}
if ($backendProcessId) {
  Write-Host ("Backend URL:  http://localhost:{0}" -f $BackendPort)
}
