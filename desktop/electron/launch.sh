#!/usr/bin/env bash
# Launch the local Electron shell from a checked-out spark-comfyui repository.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
ELECTRON="$ROOT/desktop/electron/node_modules/electron/dist/electron"

if [[ ! -x "$ELECTRON" ]]; then
  printf 'Electron dependencies are missing. Run:\n  cd %q && npm ci\n' "$ROOT/desktop/electron" >&2
  exit 1
fi

exec "$ELECTRON" "$ROOT/desktop/electron" "$@"
