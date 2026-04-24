#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

if [ ! -x ".venv/bin/python" ]; then
  echo "Missing backend virtual environment at backend/.venv"
  echo "Run: python3 -m venv .venv && . .venv/bin/activate && pip install -r requirements.txt"
  exit 1
fi

.venv/bin/python -m app.main
