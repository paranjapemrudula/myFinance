#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV_DIR="${ROOT_DIR}/.venv"
BACKEND_DIR="${ROOT_DIR}/backend"
FRONTEND_DIR="${ROOT_DIR}/frontend"

echo "[1/6] Checking Python virtual environment"
if [ ! -d "${VENV_DIR}" ]; then
  python3 -m venv "${VENV_DIR}"
fi

echo "[2/6] Installing backend dependencies"
"${VENV_DIR}/bin/pip" install --upgrade pip
"${VENV_DIR}/bin/pip" install -r "${BACKEND_DIR}/requirements.txt"

echo "[3/6] Applying Django migrations"
cd "${BACKEND_DIR}"
"${VENV_DIR}/bin/python" manage.py migrate

echo "[4/6] Collecting Django static files"
"${VENV_DIR}/bin/python" manage.py collectstatic --noinput

echo "[5/6] Installing frontend dependencies and building"
cd "${FRONTEND_DIR}"
npm install
npm run build

echo "[6/6] Restarting services"
sudo systemctl restart my_finance
sudo systemctl reload nginx

echo "Deployment completed successfully."
