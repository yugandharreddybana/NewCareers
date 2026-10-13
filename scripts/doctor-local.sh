#!/usr/bin/env bash
# Diagnoses CareerOps local backend readiness. Exit 0 = ready.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
fail=0
ok() { echo "[OK]  $*"; }
bad() { echo "[FAIL] $*"; fail=1; }
warn() { echo "[WARN] $*"; }

echo "== CareerOps doctor (local H2 stack) =="

if ! command -v java >/dev/null 2>&1; then
  bad "Java not on PATH. Install JDK 21+."
else
  ok "Java $(java -version 2>&1 | head -n1)"
fi

if ! command -v mvn >/dev/null 2>&1; then
  bad "Maven (mvn) not on PATH."
else
  ok "Maven present"
fi

if ! command -v node >/dev/null 2>&1; then
  warn "Node not on PATH (needed for middleware/frontend)."
else
  ok "Node $(node -v)"
fi

MW="$ROOT/middleware/.env"
if [[ ! -f "$MW" ]]; then
  bad "middleware/.env missing. Run: ./scripts/bootstrap-local.sh"
else
  if grep -q 'JAVA_BACKEND_URL=http://localhost:8100' "$MW"; then
    ok "middleware JAVA_BACKEND_URL=:8100"
  else
    bad "middleware/.env JAVA_BACKEND_URL must be http://localhost:8100 for H2 local."
  fi
  if grep -Eq '^APP_INTERNAL_SECRET=\s*$' "$MW"; then
    bad "middleware/.env APP_INTERNAL_SECRET is blank."
  else
    ok "middleware APP_INTERNAL_SECRET is set"
  fi
fi

if curl -fsS "http://127.0.0.1:8100/api/health" >/dev/null 2>&1; then
  ok "Backend already up on :8100"
else
  ok "Backend not running yet (expected before start-backend)"
fi

echo ""
if [[ "$fail" -ne 0 ]]; then
  echo "Doctor found problems. Fix [FAIL] lines, then ./scripts/bootstrap-local.sh && ./scripts/start-backend.sh"
  exit 1
fi
echo "Doctor passed. Start with: ./scripts/start-backend.sh"
exit 0
