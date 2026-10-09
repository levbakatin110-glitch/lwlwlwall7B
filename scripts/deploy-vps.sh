#!/usr/bin/env bash
# Деплой на VPS: tarball с GitHub (без git pull / логина) + webpack-сборка
set -euo pipefail
cd /var/www/maya

# .env — не bash: скобки/кавычки в секретах ломают `source`.
load_dotenv() {
  local file="$1"
  [ -f "$file" ] || return 0
  local line key val
  while IFS= read -r line || [ -n "$line" ]; do
    line="${line%$'\r'}"
    case "$line" in
      ""|\#*) continue ;;
    esac
    [[ "$line" == *=* ]] || continue
    key="${line%%=*}"
    val="${line#*=}"
    key="${key%"${key##*[![:space:]]}"}"
    key="${key#"${key%%[![:space:]]*}"}"
    [[ "$key" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]] || continue
    if [[ "$val" == \"*\" && "$val" == *\" ]]; then
      val="${val#\"}"
      val="${val%\"}"
    elif [[ "$val" == \'*\' && "$val" == *\' ]]; then
      val="${val#\'}"
      val="${val%\'}"
    fi
    printf -v "$key" '%s' "$val"
    export "$key"
  done < "$file"
}

touch .env.production
load_dotenv .env.production

# Этот ключ раньше лежал в публичном репозитории: если он (или пустота) в .env.production — заменяем случайным.
LEAKED_KEY='DPEZn35NF4GXiXF/tJrPE4tgrGS55JeVCSpLVZ39sWM='
ensure_secret() {
  local name="$1"
  local cur="${!name:-}"
  if [ -z "$cur" ] || [ "$cur" = "$LEAKED_KEY" ]; then
    sed -i "/^${name}=/d" .env.production
    local val
    val="$(openssl rand -base64 32)"
    printf '%s=%s\n' "$name" "$val" >> .env.production
    export "$name=$val"
    echo "Новый $name записан в .env.production"
  fi
}
ensure_secret AUTH_SECRET
ensure_secret NEXT_SERVER_ACTIONS_ENCRYPTION_KEY

# Репозиторий публичный — качаем tarball ветки main без логина
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

# Сайт не гасим до успешной сборки — иначе nginx отдаёт 502 на всё время build.
npm run build

if [ ! -f .next/BUILD_ID ]; then
  echo "ERROR: build failed — нет .next/BUILD_ID"
  exit 1
fi

# Кластер: общая очередь/квота в SQLite (data/maya.db)
export CHAT_PM2_INSTANCES="${CHAT_PM2_INSTANCES:-2}"
export CHAT_MAX_CONCURRENT="${CHAT_MAX_CONCURRENT:-50}"
pm2 reload maya --update-env 2>/dev/null \
  || pm2 restart maya --update-env 2>/dev/null \
  || pm2 start ecosystem.config.cjs
pm2 save 2>/dev/null || true
pm2 flush maya 2>/dev/null || true

# Nginx таймауты для стрима чата (идемпотентно)
if [ -x scripts/apply-nginx-chat-timeouts.sh ]; then
  bash scripts/apply-nginx-chat-timeouts.sh || true
fi

echo "OK: BUILD_ID=$(cat .next/BUILD_ID) · pm2×${CHAT_PM2_INSTANCES}"
