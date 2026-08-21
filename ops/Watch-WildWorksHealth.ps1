param(
  [string[]]$Urls = @(
    'http://127.0.0.1:3020/pages/Home',
    'https://mission-control.tail00dfe0.ts.net:8443/pages/Home'
  ),
  [int]$FailureThreshold = 3,
  [switch]$NoSend
)

$ErrorActionPreference = 'Stop'
$stateRoot = Join-Path $env:LOCALAPPDATA 'WildWorksOperationalAlerts'
$statePath = Join-Path $stateRoot 'health-state.json'
New-Item -ItemType Directory -Force -Path $stateRoot | Out-Null

$state = @{}
if (Test-Path -LiteralPath $statePath) {
  try {
    $saved = Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    foreach ($property in $saved.PSObject.Properties) { $state[$property.Name] = $property.Value }
  } catch { $state = @{} }
}

function Get-CorrelationId([string]$Value) {
  $sha = [Security.Cryptography.SHA256]::Create()
  try {
    $bytes = [Text.Encoding]::UTF8.GetBytes($Value)
    $hash = ([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-', '').ToLowerInvariant()
    return "ww-$($hash.Substring(0, 12))"
  } finally { $sha.Dispose() }
}

function Send-HealthAlert([string]$Category, [string]$Component, [string]$Route, [string]$Summary, [string]$Correlation) {
  if ($NoSend) { return }
  try {
    $configScript = Join-Path $PSScriptRoot 'Get-WildWorksTelegramAlertConfig.ps1'
    $config = (& $configScript | ConvertFrom-Json)
    $text = @(
      'WildWorks operational failure'
      "time: $([DateTime]::UtcNow.ToString('o'))"
      "category: $Category"
      "component: $Component"
      "route: $Route"
      "correlation: $Correlation"
      "summary: $Summary"
    ) -join "`n"
    $body = @{ chat_id = $config.chatId; text = $text } | ConvertTo-Json -Compress
    Invoke-RestMethod -Method Post -Uri "https://api.telegram.org/bot$($config.token)/sendMessage" -ContentType 'application/json' -Body $body -TimeoutSec 5 | Out-Null
  } catch {
    # Alerting is intentionally best-effort and must never affect the preview.
  }
}

$now = [DateTime]::UtcNow
foreach ($url in $Urls) {
  $key = Get-CorrelationId $url
  $entry = $state[$key]
  $failures = if ($entry) { [int]$entry.failures } else { 0 }
  $lastAlertUtc = if ($entry -and $entry.lastAlertUtc) { [DateTime]::Parse($entry.lastAlertUtc).ToUniversalTime() } else { [DateTime]::MinValue }
  $healthy = $false
  $status = 'connection failed'
  try {
    $response = Invoke-WebRequest -Uri $url -Method Get -MaximumRedirection 2 -TimeoutSec 12 -UseBasicParsing
    $healthy = $response.StatusCode -ge 200 -and $response.StatusCode -lt 400
    $status = "HTTP $($response.StatusCode)"
  } catch {
    if ($_.Exception.Response -and $_.Exception.Response.StatusCode) {
      $status = "HTTP $([int]$_.Exception.Response.StatusCode)"
    }
  }

  if ($healthy) {
    $state[$key] = @{ failures = 0; lastAlertUtc = if ($entry) { $entry.lastAlertUtc } else { $null }; url = $url }
    continue
  }

  $failures++
  $canRepeat = ($now - $lastAlertUtc).TotalMinutes -ge 60
  if ($failures -ge $FailureThreshold -and $canRepeat) {
    $uri = [Uri]$url
    $component = if ($uri.Host -eq '127.0.0.1') { 'protected preview listener' } else { 'canonical Tailnet preview' }
    Send-HealthAlert 'runtime_unavailable' $component $uri.AbsolutePath $status $key
    $lastAlertUtc = $now
  }
  $state[$key] = @{ failures = $failures; lastAlertUtc = if ($lastAlertUtc -eq [DateTime]::MinValue) { $null } else { $lastAlertUtc.ToString('o') }; url = $url }
}

$state | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $statePath -Encoding utf8
