#!/bin/bash
# One-time: install dependencies for every component.
set -e
cd "$(dirname "$0")"
for d in backend mock-scan-feed frontend; do
  echo "== npm install in $d =="
  (cd "$d" && npm install)
done
echo
echo "Next: cp dot-env.EXAMPLE .env (or copy your existing .env), edit it, then:"
echo "  cd backend && npm run setup     # one time: indexes and Atlas search indexes"
echo "  ./run-all.sh                    # start everything"
