#!/usr/bin/env bash
# Сторож Маи: запускается cron каждые 2 минуты.
# 1) сайт не отвечает 2 раза подряд, перезапускает pm2 (или nginx) и пишет об этом;
# 2) раз в сутки: диск >= 85%, свежесть бэкапа, срок сертификата.
# Сообщения: всегда в /var/log/maya-health.log, и в Telegram, если есть /etc/maya-alerts.env:
#   TELEGRAM_BOT_TOKEN=...   TELEGRAM_CHAT_ID=...
set -u

SITE="${SITE_URL:-https://hey-maya.ru/api/version}"
LOCAL="${LOCAL_URL:-http://127.0.0.1:3000/api/version}"
STATE="${STATE_DIR:-/var/lib/maya-health}"
LOG="${HEALTH_LOG:-/var/log/maya-health.log}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/maya}"

mkdir -p "$STATE"
# shellcheck disable=SC1091
[ -f /etc/maya-alerts.env ] && . /etc/maya-alerts.env

log() { echo "$(date '+%F %T') $*" >> "$LOG"; }

notify() {
  log "$*"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -m 15 "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=Мая (сервер): $*" >/dev/null 2>&1 || true
  fi
}

# Раз в сутки на один и тот же ключ
once_a_day() {
  local key="$1" today
  today="$(date +%F)"
  [ "$(cat "$STATE/$key" 2>/dev/null)" = "$today" ] && return 1
  echo "$today" > "$STATE/$key"
  return 0
}

ok_url() { curl -fsS -m 10 -o /dev/null "$1" 2>/dev/null; }

# ---- доступность ----
FAILS_FILE="$STATE/fails"
if ok_url "$SITE"; then
  if [ -f "$STATE/down" ]; then
    rm -f "$STATE/down"
    notify "сайт снова отвечает"
  fi
  echo 0 > "$FAILS_FILE"
else
  n=$(( $(cat "$FAILS_FILE" 2>/dev/null || echo 0) + 1 ))
  echo "$n" > "$FAILS_FILE"
  log "проверка сайта не прошла (подряд: $n)"
  if [ "$n" -ge 2 ]; then
    if ok_url "$LOCAL"; then
      # приложение живо, значит проблема в nginx
      if nginx -t >/dev/null 2>&1; then systemctl restart nginx; fi
      notify "сайт не открывался снаружи, приложение живо; перезапустил nginx"
    else
      pm2 restart maya >/dev/null 2>&1
      sleep 25
      if ok_url "$LOCAL"; then
        notify "приложение не отвечало, перезапустил pm2, теперь работает"
      else
        touch "$STATE/down"
        notify "ВНИМАНИЕ: приложение не отвечает даже после перезапуска, нужна проверка"
      fi
    fi
    echo 0 > "$FAILS_FILE"
  fi
fi

# ---- раз в сутки ----
if once_a_day daily; then
  used="$(df / | awk 'NR==2 {gsub("%","",$5); print $5}')"
  if [ "${used:-0}" -ge 85 ]; then
    notify "диск заполнен на ${used}%"
  fi

  newest="$(find "$BACKUP_DIR" -maxdepth 1 -name 'maya-*.tar.gz' -mmin -1560 2>/dev/null | head -1)"
  if [ -z "$newest" ]; then
    notify "нет свежей копии данных за последние 26 часов (проверьте /var/backups/maya)"
  fi

  end="$(echo | openssl s_client -connect 127.0.0.1:443 -servername hey-maya.ru 2>/dev/null \
    | openssl x509 -noout -enddate 2>/dev/null | cut -d= -f2)"
  if [ -n "$end" ]; then
    days=$(( ( $(date -d "$end" +%s) - $(date +%s) ) / 86400 ))
    if [ "$days" -lt 14 ]; then
      notify "сертификат сайта истекает через ${days} дн."
    fi
  fi
fi
