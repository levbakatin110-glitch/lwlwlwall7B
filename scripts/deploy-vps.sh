#!/usr/bin/env bash
# Деплой на VPS: tarball с GitHub (без git pull / логина) + webpack-сборка
set -euo pipefail
cd /var/www/maya

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

# Подтянуть переменные чата из .env.production если есть
if [ -f .env.production ]; then
  set -a
  # shellcheck disable=SC1091
  source .env.production
  set +a
fi

# Репозиторий закрытый для git pull — качаем публичный tarball ветки main
rm -rf /tmp/lwlwlwall7B-main /tmp/main.tar.gz
curl -fsSL -o /tmp/main.tar.gz https://github.com/levbakatin110-glitch/lwlwlwall7B/archive/refs/heads/main.tar.gz
tar xzf /tmp/main.tar.gz -C /tmp
rsync -a \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude 'data' \
  /tmp/lwlwlwall7B-main/ /var/www/maya/

npm install

pm2 stop maya 2>/dev/null || true
pm2 delete maya 2>/dev/null || true

rm -rf .next
npm run build

if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: build failed — нет .next/BUILD_ID"
  exit 1
fi

# Кластер: общая очередь/квота в SQLite (data/maya.db)
export CHAT_PM2_INSTANCES="${CHAT_PM2_INSTANCES:-2}"
export CHAT_MAX_CONCURRENT="${CHAT_MAX_CONCURRENT:-50}"
pm2 start ecosystem.config.cjs
pm2 save 2>/dev/null || true
pm2 flush maya 2>/dev/null || true

# Nginx таймауты для стрима чата (идемпотентно)
if [ -x scripts/apply-nginx-chat-timeouts.sh ]; then
  bash scripts/apply-nginx-chat-timeouts.sh || true
fi

echo "OK: BUILD_ID=$(cat .next/BUILD_ID) · pm2×${CHAT_PM2_INSTANCES}"
