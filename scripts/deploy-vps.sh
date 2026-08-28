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
rm -rf .next
npm run build
pm2 restart maya
pm2 flush maya || true
echo "OK: $(git log -1 --oneline)"
