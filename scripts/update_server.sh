#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/opt/semcorp-dorm-management}"
BRANCH="${BRANCH:-main}"

echo "== Semcorp Dorm Management Server Update =="

cd "$APP_DIR"

echo "== Current branch and commit =="
git branch --show-current
git rev-parse --short HEAD

echo "== Checking local changes =="
git status --short
if [ -n "$(git status --short)" ]; then
  echo "Local changes detected. Please commit, stash, or review them before updating."
  exit 1
fi

echo "== Pull latest code =="
git pull origin "$BRANCH"

echo "== Activate Python venv =="
source .venv/bin/activate

echo "== Install backend dependencies =="
pip install -r requirements.txt

echo "== Run database migrations =="
alembic upgrade head

echo "== Build frontend =="
cd frontend
npm install
npm run build
cd ..

echo "== New commit =="
git rev-parse --short HEAD

echo "== Update complete =="
echo "Restart the service manually:"
echo "  sudo systemctl restart semcorp-dorm"
echo "Or, if the server is running manually:"
echo "  scripts/start_prod.sh"
