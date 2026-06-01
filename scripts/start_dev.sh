#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [ -f ".env" ]; then
  set -a
  source ".env"
  set +a
  echo "[dev] 已加载 .env"
else
  echo "[dev] 未找到 .env，使用默认开发配置"
fi

echo "[dev] 启动后端: http://127.0.0.1:8000"
.venv/bin/uvicorn main:app --host 127.0.0.1 --port 8000 &
BACKEND_PID=$!

if [ -z "${NPM_BIN:-}" ]; then
  if [ -x "/opt/homebrew/bin/npm" ]; then
    NPM_BIN="/opt/homebrew/bin/npm"
  else
    NPM_BIN="npm"
  fi
fi

echo "[dev] 启动前端: http://127.0.0.1:5173/ui/"
cd frontend
"${NPM_BIN}" run dev -- --host 127.0.0.1

echo "[dev] 前端已退出，停止后端 PID ${BACKEND_PID}"
kill "${BACKEND_PID}" 2>/dev/null || true
