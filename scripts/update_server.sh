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

echo "== Load .env (DATABASE_URL etc.) =="
# Without this, alembic falls back to the default SQLite file and the real
# (e.g. MySQL) database silently never gets migrated.
if [ -f ".env" ]; then
  set -a
  source ".env"
  set +a
  echo "loaded .env"
else
  echo "WARNING: no .env found — alembic will use the default SQLite database"
fi

echo "== Run database migrations =="
alembic upgrade head
echo "migrated database: ${DATABASE_URL:-sqlite:///./dorm_commute.db (default)}" | sed 's#://[^:]*:[^@]*@#://***:***@#'

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
