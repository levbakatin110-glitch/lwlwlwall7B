#!/usr/bin/env bash
# Ежедневная копия данных Маи: SQLite (консистентный снимок) + data/ (бэкапы дневников, сообщества).
# Хранит KEEP_DAYS дней в BACKUP_DIR. Запуск: bash scripts/backup-data.sh
# ВАЖНО: копия лежит на том же сервере. От потери самого сервера защищает только копия в другом месте.
set -euo pipefail

APP="${APP_DIR:-/var/www/maya}"
OUT="${BACKUP_DIR:-/var/backups/maya}"
KEEP_DAYS="${KEEP_DAYS:-7}"
TS="$(date +%Y%m%d-%H%M)"

umask 077
mkdir -p "$OUT"
chmod 700 "$OUT"
WORK="$OUT/.work-$TS"
mkdir -p "$WORK"
trap 'rm -rf "$WORK"' EXIT

cd "$APP"

# VACUUM INTO даёт целый снимок БД даже во время записи (WAL)
node --no-warnings -e "
const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync('data/maya.db');
db.exec(\"VACUUM INTO '$WORK/maya.db'\");
db.close();
"

tar -czf "$OUT/maya-$TS.tar.gz" \
  --exclude='data/maya.db*' \
  -C "$WORK" maya.db \
  -C "$APP" data

chmod 600 "$OUT/maya-$TS.tar.gz"

# Проверяем, что архив читается
tar -tzf "$OUT/maya-$TS.tar.gz" >/dev/null

find "$OUT" -maxdepth 1 -name 'maya-*.tar.gz' -mtime +"$KEEP_DAYS" -delete

echo "backup ok: $OUT/maya-$TS.tar.gz ($(du -h "$OUT/maya-$TS.tar.gz" | cut -f1))"
