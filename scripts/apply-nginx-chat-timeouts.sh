#!/usr/bin/env bash
# Ставит длинные таймауты nginx для стрима /api/chat — без 504 на длинных ответах.
# Идемпотентно: можно гонять много раз.
set -euo pipefail

SNIPPET_FILE="/etc/nginx/snippets/maya-chat-timeouts.conf"
SITE_CANDIDATES=(
  /etc/nginx/sites-enabled/hey-maya.ru
  /etc/nginx/sites-enabled/default
  /etc/nginx/conf.d/maya.conf
)

if [[ "$(id -u)" -ne 0 ]]; then
  if command -v sudo >/dev/null 2>&1; then
    exec sudo bash "$0" "$@"
  fi
  echo "Нужен root/sudo для правки nginx"
  exit 1
fi

mkdir -p /etc/nginx/snippets
cat >"$SNIPPET_FILE" <<'EOF'
# Maya chat streaming — do not buffer, long read timeout
proxy_http_version 1.1;
proxy_set_header Connection "";
proxy_buffering off;
proxy_cache off;
proxy_read_timeout 180s;
proxy_send_timeout 180s;
proxy_connect_timeout 15s;
EOF

INCLUDE_LINE="include /etc/nginx/snippets/maya-chat-timeouts.conf;"
patched=0

for site in "${SITE_CANDIDATES[@]}"; do
  [[ -f "$site" ]] || continue
  if grep -q "maya-chat-timeouts.conf" "$site"; then
    echo "OK already: $site"
    patched=1
    continue
  fi
  # Вставить include сразу после proxy_pass ...;
  if grep -q "proxy_pass" "$site"; then
    cp -a "$site" "${site}.bak.maya-$(date +%Y%m%d%H%M%S)"
    # awk: после первой строки с proxy_pass внутри location добавить include
    awk -v inc="$INCLUDE_LINE" '
      /proxy_pass/ && !done {
        print
        print "    " inc
        done=1
        next
      }
      { print }
    ' "$site" >"${site}.tmp" && mv "${site}.tmp" "$site"
    echo "patched: $site"
    patched=1
  fi
done

if [[ "$patched" -eq 0 ]]; then
  echo "WARN: не нашёл site-конфиг. Добавь вручную в location /:"
  echo "  include /etc/nginx/snippets/maya-chat-timeouts.conf;"
  echo "Фрагмент уже лежит в $SNIPPET_FILE"
  exit 0
fi

nginx -t
systemctl reload nginx
echo "OK: nginx reloaded with maya chat timeouts (180s, buffering off)"
