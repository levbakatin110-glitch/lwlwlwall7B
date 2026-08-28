#!/usr/bin/env bash
# Деплой на VPS: стабильный ключ + webpack-сборка (без turbopack)
set -euo pipefail
cd /var/www/maya

# Один и тот же ключ на всех сборках этого сервера
if [ -z "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-}" ]; then
  if [ -f .env.production ]; then
    # shellcheck disable=SC1091
    set -a
    source .env.production
    set +a
  fi
fi
if [ -z "${NEXT_SERVER_ACTIONS_ENCRYPTION_KEY:-}" ]; then
  export NEXT_SERVER_ACTIONS_ENCRYPTION_KEY='DPEZn35NF4GXiXF/tJrPE4tgrGS55JeVCSpLVZ39sWM='
fi

git checkout -- package-lock.json 2>/dev/null || true
git pull
npm install

# Не отдаём полусобранный .next — иначе 500 на /_next/static/chunks/*
pm2 stop maya 2>/dev/null || true

rm -rf .next
npm run build

if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: build failed — нет .next/BUILD_ID"
  exit 1
fi

pm2 restart maya 2>/dev/null || pm2 start npm --name maya -- start
pm2 save 2>/dev/null || true
pm2 flush maya 2>/dev/null || true
echo "OK: $(git log -1 --oneline) · BUILD_ID=$(cat .next/BUILD_ID)"
