#!/usr/bin/env bash
# Supervises the FIREBROX static server: restarts it immediately if it ever exits.
cd "$(dirname "$0")/.." || exit 1
echo "[keep-alive] supervising FIREBROX on port ${PORT:-5173} — started $(date -u +%H:%M:%SZ)"
attempt=0
while true; do
  attempt=$((attempt + 1))
  echo "[keep-alive] launch #$attempt $(date -u +%H:%M:%SZ)"
  node server.mjs
  code=$?
  echo "[keep-alive] server exited (code $code) — restarting in 1s"
  sleep 1
done
