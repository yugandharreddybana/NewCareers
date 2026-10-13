#Requires -Version 5.1
# Diagnoses why CareerOps backend fails on a laptop. Exit 0 = ready; 1 = fix listed issues.
$ErrorActionPreference = "Continue"
$Root = Split-Path -Parent $PSScriptRoot
$fail = 0

function Ok($m) { Write-Host "[OK]  $m" -ForegroundColor Green }
function Bad($m) { Write-Host "[FAIL] $m" -ForegroundColor Red; $script:fail = 1 }
function Warn($m) { Write-Host "[WARN] $m" -ForegroundColor Yellow }

Write-Host "== CareerOps doctor (local H2 stack) ==" -ForegroundColor Cyan

# Java 21+
$java = Get-Command java -ErrorAction SilentlyContinue
if (-not $java) {
  Bad "Java not on PATH. Install JDK 21+ and reopen the terminal."
} else {
  $verText = (cmd /c "java -version 2>&1" | Out-String)
  if ($verText -match 'version\s+"(\d+)') {
    $major = [int]$Matches[1]
    if ($major -lt 21) { Bad "Java $major found; need 21+. $verText" } else { Ok "Java $major" }
  } else { Warn "Could not parse Java version: $verText" }
}

# Maven
if (-not (Get-Command mvn -ErrorAction SilentlyContinue)) {
  Bad "Maven (mvn) not on PATH."
} else { Ok "Maven present" }

# Node (middleware/frontend)
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Warn "Node not on PATH (needed for middleware/frontend)."
} else {
  $nv = (node -v)
  Ok "Node $nv"
}

# middleware .env
$mw = Join-Path $Root "middleware\.env"
if (-not (Test-Path $mw)) {
  Bad "middleware/.env missing. Run: .\scripts\bootstrap-local.ps1"
} else {
  $raw = Get-Content $mw -Raw
  if ($raw -notmatch 'JAVA_BACKEND_URL=http://localhost:8100') {
    Bad "middleware/.env JAVA_BACKEND_URL must be http://localhost:8100 for H2 local (not :8080)."
  } else { Ok "middleware JAVA_BACKEND_URL=:8100" }
  if ($raw -match '(?m)^APP_INTERNAL_SECRET=\s*$') {
    Bad "middleware/.env APP_INTERNAL_SECRET is blank. Run bootstrap or set the test secret from .env.example."
  } elseif ($raw -match 'APP_INTERNAL_SECRET=test-internal-trust-secret-minimum-32-characters-long') {
    Ok "middleware APP_INTERNAL_SECRET matches test default"
  } else {
    Warn "middleware APP_INTERNAL_SECRET is set but may not match Java test default."
  }
}

# Port 8100
$listen = Get-NetTCPConnection -LocalPort 8100 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listen) {
  try {
    $h = (Invoke-WebRequest -Uri "http://127.0.0.1:8100/api/health" -UseBasicParsing -TimeoutSec 3).Content
    Ok "Backend already up on :8100 ($h)"
  } catch {
    Warn "Port 8100 in use by PID $($listen.OwningProcess) but /api/health failed. Stop that process and retry."
  }
} else {
  Ok "Port 8100 free (backend not running yet)"
}

# H2 lock
$lock = Join-Path $env:USERPROFILE ".careerops\db\careerops.lock.db"
if (Test-Path $lock) {
  Warn "H2 lock file exists ($lock). If backend won't start, stop other Java processes or delete the lock after stopping Java."
}

# Root .env blank secret trap
$rootEnv = Join-Path $Root ".env"
if (Test-Path $rootEnv) {
  $blank = @()
  Get-Content $rootEnv | ForEach-Object {
    if ($_ -match '^\s*(APP_INTERNAL_SECRET|APP_MASTER_KEK|JWT_PRIVATE_KEY_PEM|JWT_PUBLIC_KEY_PEM)=\s*$') {
      $blank += $Matches[1]
    }
  }
  if ($blank.Count -gt 0) {
    Warn ("Root .env has blank: " + ($blank -join ", ") + " - OK for test profile (defaults fill in). Do NOT set SPRING_PROFILES_ACTIVE=dev without real values.")
  } else {
    Ok "Root .env present"
  }
} else {
  Ok "No root .env (fine for H2 test profile)"
}

Write-Host ""
if ($fail -ne 0) {
  Write-Host "Doctor found problems. Fix the [FAIL] lines, then:" -ForegroundColor Red
  Write-Host "  .\scripts\bootstrap-local.ps1"
  Write-Host "  .\scripts\start-backend.ps1"
  exit 1
}
Write-Host "Doctor passed. Start with: .\scripts\start-backend.ps1" -ForegroundColor Green
exit 0
