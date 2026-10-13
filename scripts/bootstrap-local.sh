#!/usr/bin/env bash
# Prepares any laptop for CareerOps local run (H2 test profile + middleware).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== CareerOps local bootstrap =="
echo "Repo: $ROOT"

if ! command -v java >/dev/null 2>&1; then
  echo "FATAL: Java not on PATH. Install JDK 21+." >&2
  exit 1
fi
JAVA_VER="$(java -version 2>&1 | head -n1)"
echo "OK $JAVA_VER"

if ! command -v mvn >/dev/null 2>&1; then
  echo "FATAL: Maven (mvn) not on PATH." >&2
  exit 1
fi
echo "OK Maven"

MW_ENV="$ROOT/middleware/.env"
MW_EX="$ROOT/middleware/.env.example"
if [[ ! -f "$MW_ENV" ]]; then
  cp "$MW_EX" "$MW_ENV"
  echo "Created middleware/.env from .env.example"
else
  if grep -q 'JAVA_BACKEND_URL=http://localhost:8080' "$MW_ENV"; then
    sed -i.bak 's|JAVA_BACKEND_URL=http://localhost:8080|JAVA_BACKEND_URL=http://localhost:8100|' "$MW_ENV"
    rm -f "$MW_ENV.bak"
    echo "Updated middleware/.env JAVA_BACKEND_URL -> :8100"
  fi
  if grep -Eq '^APP_INTERNAL_SECRET=\s*$' "$MW_ENV"; then
    sed -i.bak 's|^APP_INTERNAL_SECRET=\s*$|APP_INTERNAL_SECRET=test-internal-trust-secret-minimum-32-characters-long|' "$MW_ENV"
    rm -f "$MW_ENV.bak"
    echo "Filled blank APP_INTERNAL_SECRET in middleware/.env"
  fi
fi

mkdir -p "${HOME}/.careerops/db"
echo "OK H2 dir ${HOME}/.careerops/db"

VENV_PY="$ROOT/scraper/.venv/bin/python"
if [[ ! -x "$VENV_PY" ]]; then
  if command -v python3 >/dev/null 2>&1; then
    echo "Installing scraper venv (optional)..."
    (
      cd "$ROOT/scraper"
      python3 -m venv .venv
      .venv/bin/python -m pip install -q -r requirements.txt
      .venv/bin/python -m playwright install chromium
    ) && echo "OK scraper venv" || echo "WARN: scraper install skipped"
  else
    echo "WARN: No Python - scraper skipped (other job sources still work)."
  fi
else
  echo "OK scraper venv present"
fi

echo ""
echo "Bootstrap done. Next:"
echo "  ./scripts/start-backend.sh"
echo "  cd middleware && npm install && npm run dev"
echo "  cd frontend  && npm install && npm run dev"
echo "Login: dev@careerops.ie / password"
