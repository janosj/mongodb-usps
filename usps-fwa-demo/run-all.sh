#!/bin/bash
# Starts the backend, the mock scan feed, and the frontend. Ctrl+C stops all three.
cd "$(dirname "$0")"
if [ ! -f .env ]; then
  echo "Missing .env. Copy dot-env.EXAMPLE to .env and fill it in."
  exit 1
fi
pids=()
cleanup() { echo; echo "Stopping..."; kill "${pids[@]}" 2>/dev/null; exit 0; }
trap cleanup INT TERM

(cd backend && node server.js) & pids+=($!)
(cd mock-scan-feed && node scan_feed.js) & pids+=($!)
(cd frontend && npm run dev) & pids+=($!)

wait
