#Requires -Version 5.1
# Starts the Java backend on the portable H2 test profile (:8100).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$Backend = Join-Path $Root "backend"
if (-not (Test-Path (Join-Path $Backend "pom.xml"))) {
  throw "backend/pom.xml not found"
}

& (Join-Path $PSScriptRoot "bootstrap-local.ps1")

$env:SPRING_PROFILES_ACTIVE = "test"
$venvPy = Join-Path $Root "scraper\.venv\Scripts\python.exe"
if (Test-Path $venvPy) {
  $env:SCRAPER_PYTHON_COMMAND = $venvPy
}

# Only export non-blank keys from root .env (blank must not override test defaults)
$rootEnv = Join-Path $Root ".env"
if (Test-Path $rootEnv) {
  Get-Content $rootEnv | ForEach-Object {
    if ($_ -match '^\s*([^#=]+)=(.*)$') {
      $k = $matches[1].Trim()
      $v = $matches[2].Trim()
      if ($v -ne "") {
        Set-Item -Path "Env:$k" -Value $v
      }
    }
  }
}

# Free port 8100 / leftover Java holding the H2 file lock
$listen = Get-NetTCPConnection -LocalPort 8100 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listen) {
  Stop-Process -Id $listen.OwningProcess -Force -ErrorAction SilentlyContinue
  Start-Sleep -Seconds 2
  Write-Host "Stopped previous process on :8100"
}

Write-Host "Starting backend (profile=test, port 8100)..." -ForegroundColor Cyan
Set-Location $Backend
& mvn spring-boot:run "-Dspring-boot.run.profiles=test"
