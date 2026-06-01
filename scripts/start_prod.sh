#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f ".env" ]; then
  set -a
  source ".env"
  set +a
  echo "[prod] 已加载 .env"
else
  echo "[prod] 未找到 .env，请先配置生产/试用环境变量"
  exit 1
fi

echo "[prod] 构建前端"
if [ -z "${NPM_BIN:-}" ]; then
  if [ -x "/opt/homebrew/bin/npm" ]; then
    NPM_BIN="/opt/homebrew/bin/npm"
  else
    NPM_BIN="npm"
  fi
fi
cd frontend
"${NPM_BIN}" run build
cd ..

echo "[prod] 启动后端: http://0.0.0.0:8000"
echo "[prod] APP_ENV=${APP_ENV:-PROD}"
echo "[prod] DATABASE_URL 已从环境变量读取"
.venv/bin/uvicorn main:app --host 0.0.0.0 --port 8000
