#!/bin/bash
set -euo pipefail

WORKSPACE="${WORKSPACE_ROOT:-/workspace}"

needs_seed=false
if [ ! -f "$WORKSPACE/package.json" ]; then
  needs_seed=true
elif [ ! -f "$WORKSPACE/.endian-seed-ready" ]; then
  needs_seed=true
fi

if [ "$needs_seed" = true ]; then
  echo "Seeding workspace from image scaffold..."
  find "$WORKSPACE" -mindepth 1 -maxdepth 1 ! -name 'lost+found' -exec rm -rf {} +
  cp -r /seed-scaffold/. "$WORKSPACE/"
  touch "$WORKSPACE/.endian-seed-ready"
fi

cd "$WORKSPACE"

if [ ! -f node_modules/vite/bin/vite.js ]; then
  echo "ERROR: pre-baked node_modules missing from workspace seed" >&2
  exit 1
fi

echo "Starting sandbox-server on :3002 and Vite dev on :5173..."
node /app/dist/server.js &
SANDBOX_PID=$!

node node_modules/vite/bin/vite.js --host 0.0.0.0 --port 5173 &
VITE_PID=$!

trap 'kill "$SANDBOX_PID" "$VITE_PID" 2>/dev/null; exit' TERM INT

# Bash wait -n: exit when either sidecar process stops.
wait -n "$SANDBOX_PID" "$VITE_PID" 2>/dev/null || wait -n
exit $?
