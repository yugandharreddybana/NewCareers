#!/usr/bin/env bash
# Starts Java backend on portable H2 test profile (:8100).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
"$ROOT/scripts/bootstrap-local.sh"

export SPRING_PROFILES_ACTIVE=test
if [[ -x "$ROOT/scraper/.venv/bin/python" ]]; then
  export SCRAPER_PYTHON_COMMAND="$ROOT/scraper/.venv/bin/python"
fi

# Load non-blank keys only from repo .env (blank values must not override test defaults)
if [[ -f "$ROOT/.env" ]]; then
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ "$line" =~ ^[[:space:]]*$ ]] && continue
    if [[ "$line" =~ ^([^=]+)=(.*)$ ]]; then
      key="${BASH_REMATCH[1]}"
      val="${BASH_REMATCH[2]}"
      key="$(echo "$key" | xargs)"
      if [[ -n "$val" ]]; then
        export "$key=$val"
      fi
    fi
  done < "$ROOT/.env"
fi

echo "Starting backend (profile=test, port 8100)..."
cd "$ROOT/backend"
exec mvn spring-boot:run -Dspring-boot.run.profiles=test
