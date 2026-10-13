#Requires -Version 5.1
# Prepares a laptop for CareerOps local run (H2 test profile + middleware).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
if (-not (Test-Path (Join-Path $Root "backend\pom.xml"))) {
  throw "Run from repo: .\scripts\bootstrap-local.ps1"
}

Write-Host "== CareerOps local bootstrap ==" -ForegroundColor Cyan
Write-Host "Repo: $Root"

$java = Get-Command java -ErrorAction SilentlyContinue
if (-not $java) { throw "Java not found on PATH. Install JDK 21+." }
# java -version writes to stderr; do not treat that as a terminating error
$verText = (cmd /c "java -version 2>&1" | Out-String)
if ($verText -match 'version\s+"(\d+)') {
  $major = [int]$Matches[1]
  if ($major -lt 21) { throw "Java $major found; need JDK 21+." }
  Write-Host "OK Java $major"
} else {
  Write-Warning "Could not parse Java version: $verText"
}

$mvn = Get-Command mvn -ErrorAction SilentlyContinue
if (-not $mvn) { throw "Maven (mvn) not found on PATH. Install Maven 3.9+." }
Write-Host "OK Maven"

$mwEnv = Join-Path $Root "middleware\.env"
$mwExample = Join-Path $Root "middleware\.env.example"
if (-not (Test-Path $mwEnv)) {
  Copy-Item $mwExample $mwEnv
  Write-Host "Created middleware/.env from .env.example"
} else {
  $raw = Get-Content $mwEnv -Raw
  $changed = $false
  if ($raw -match 'JAVA_BACKEND_URL=http://localhost:8080') {
    $raw = $raw -replace 'JAVA_BACKEND_URL=http://localhost:8080', 'JAVA_BACKEND_URL=http://localhost:8100'
    $changed = $true
    Write-Host "Updated middleware/.env JAVA_BACKEND_URL -> :8100"
  }
  if ($raw -match '(?m)^APP_INTERNAL_SECRET=\s*$') {
    $raw = $raw -replace '(?m)^APP_INTERNAL_SECRET=\s*$', 'APP_INTERNAL_SECRET=test-internal-trust-secret-minimum-32-characters-long'
    $changed = $true
    Write-Host "Filled blank APP_INTERNAL_SECRET in middleware/.env"
  }
  if ($changed) { Set-Content -Path $mwEnv -Value $raw -NoNewline }
}

$dbDir = Join-Path $env:USERPROFILE ".careerops\db"
New-Item -ItemType Directory -Force -Path $dbDir | Out-Null
Write-Host "OK H2 dir $dbDir"

$scraper = Join-Path $Root "scraper"
$venvPy = Join-Path $scraper ".venv\Scripts\python.exe"
if (-not (Test-Path $venvPy)) {
  $py = $null
  $candidates = @(
    "$env:LOCALAPPDATA\Programs\Python\Python311\python.exe",
    "$env:LOCALAPPDATA\Programs\Python\Python312\python.exe"
  )
  $py311 = Get-Command python3.11 -ErrorAction SilentlyContinue
  if ($py311) { $candidates += $py311.Source }
  $pyLauncher = Get-Command py -ErrorAction SilentlyContinue
  if ($pyLauncher) { $candidates += $pyLauncher.Source }
  foreach ($c in $candidates) {
    if ($c -and (Test-Path $c)) { $py = $c; break }
  }
  if ($py) {
    Write-Host "Installing scraper venv (optional)..."
    Push-Location $scraper
    try {
      & $py -m venv .venv
      & ".\.venv\Scripts\python.exe" -m pip install -q -r requirements.txt
      & ".\.venv\Scripts\python.exe" -m playwright install chromium
      Write-Host "OK scraper venv"
    } catch {
      Write-Warning "Scraper install skipped: $_"
    } finally { Pop-Location }
  } else {
    Write-Warning "No Python - scraper skipped (other job sources still work)."
  }
} else {
  Write-Host "OK scraper venv present"
}

Write-Host ""
Write-Host "Bootstrap done. Next:" -ForegroundColor Green
Write-Host "  .\scripts\start-backend.ps1"
Write-Host "  cd middleware; npm install; npm run dev"
Write-Host "  cd frontend;  npm install; npm run dev"
Write-Host "Login: dev@careerops.ie / password"
