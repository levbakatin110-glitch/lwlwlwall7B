# Как деплоить Маю (hey-maya.ru)

Код живёт на GitHub. Сайт крутится на VPS. Деплой = **push в `main`** + **скрипт на сервере**.

## Цепочка

```
ПК (mom-ai)  →  git push origin main  →  GitHub
                                         ↓
VPS: bash scripts/deploy-vps.sh  ← качает tarball main, npm install, build, pm2
                                         ↓
                               https://hey-maya.ru
```

Репозиторий: `https://github.com/levbakatin110-glitch/lwlwlwall7B`  
На сервере каталог: `/var/www/maya`  
Скрипт: `scripts/deploy-vps.sh`

## С ПК (агент / разработчик)

1. Правки в `C:\Users\Глеб и Лев\Desktop\mom-ai`
2. `npm run check` (тесты + сборка), если меняли TS/TSX
3. `git add` нужные файлы → `git commit` → `git push origin main`
4. **Секреты и `.env*` не коммитить**

После пуша сайт сам не обновится — нужен шаг на VPS.

## На VPS (один раз после каждого push)

```bash
cd /var/www/maya
bash scripts/deploy-vps.sh
```

Скрипт:

- качает свежий `main` с GitHub (без `git pull`)
- не затирает `.env.production` и `data/`
- делает `npm install` + `npm run build`
- перезапускает `pm2` (`maya`)

Успех: строка `OK: BUILD_ID=...`

## Проверка после деплоя (2 минуты)

1. https://hey-maya.ru открывается
2. https://hey-maya.ru/api/version → `ok:true`, новый `buildId`
3. Вход / чат / форма фидбека

Подробнее: `.cursor/rules/smoke-after-deploy.mdc`

## Чего агент на Windows часто не может

| Действие | Почему |
|----------|--------|
| Собрать `.ipa` / App Store | Нужен Mac + Xcode |
| Зайти на VPS по SSH | Нужен рабочий ключ/пароль на этом ПК |
| Обновить сайт без push | Скрипт на VPS берёт код только с GitHub |

iOS-оболочка: `docs/IOS_APP_STORE.md`.  
Правки сайта (чат, офлайн, юридические страницы) → обычный деплой выше, **без** новой сборки iOS.

## Если сборка на VPS упала

```bash
pm2 logs maya --lines 80
```

Частая причина: файл только на сервере (не в GitHub), на который ссылается код.  
`rsync` в скрипте **не** удаляет лишние файлы (`--delete` нет) — мусор на сервере может ломать `next build`.
