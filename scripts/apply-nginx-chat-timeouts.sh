#!/usr/bin/env bash
# Таймауты чата уже прописаны в /etc/nginx/sites-enabled/hey-maya.ru.
# Сниппет оставляем пустым: повторный include иначе валит nginx (duplicate directive).
set -euo pipefail

SNIPPET_FILE="/etc/nginx/snippets/maya-chat-timeouts.conf"

if [[ "$(id -u)" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo bash "$0" "$@"
  fi
  echo "Нужен root/sudo"
  exit 1
fi

mkdir -p /etc/nginx/snippets
cat >"$SNIPPET_FILE" <<'EOF'
# Пусто специально. Те же директивы уже в hey-maya.ru —
# дубли ломают nginx (proxy_http_version / proxy_buffering).
EOF

echo "OK: snippet emptied (no duplicate nginx directives)"
if systemctl is-active --quiet nginx; then
  nginx -t && systemctl reload nginx
else
  nginx -t && systemctl start nginx
fi
