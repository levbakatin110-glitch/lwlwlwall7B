# Мая — ИИ для мам

Веб-приложение (и PWA): чат с памятью о ребёнке, дневники, гардероб и советы «что надеть».

## Запуск локально

```bash
cd mom-ai
npm install
cp .env.example .env.local
# впишите OPENAI_API_KEY в .env.local
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000).

## Выложить на свой хостинг

Это **не** чистый HTML-сайт. Нужен хостинг с **Node.js 20+** (VPS или «Node-приложение»).  
Обычный «только PHP / статическая папка» — не подойдёт без доработки.

### 1. На компьютере

```bash
cd mom-ai
npm install
npm run build
```

После сборки готовый сервер лежит в:

`mom-ai/.next/standalone/`

Туда же нужны статика и папка public:

```bash
# из папки mom-ai (PowerShell)
Copy-Item -Recurse public .next\standalone\public
Copy-Item -Recurse .next\static .next\standalone\.next\static
```

На хостинг заливай содержимое `.next/standalone/` (или весь проект и собирай уже на сервере).

### 2. На сервере — переменные окружения

Создай файл `.env` рядом с `server.js` (или в панели хостинга):

```
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4.1-mini
OPENAI_VISION_MODEL=gpt-4o-mini
PORT=3000
HOSTNAME=0.0.0.0
```

### 3. Запуск

```bash
node server.js
```

Или через pm2:

```bash
npm install -g pm2
pm2 start server.js --name maya
pm2 save
```

Перед сайтом поставь **Nginx/HTTPS** (Let's Encrypt) и прокси на `localhost:3000`.

### Важно про OpenAI

Если сервер в **России**, OpenAI снова может ответить `403` — как у тебя локально без VPN.  
Тогда нужен: сервер в EU/US, либо прокси/VPN на сервере, либо другой API-доступ.

### Что взять с собой на хостинг

- папка проекта `mom-ai` **или** собранный `.next/standalone`
- ключ `OPENAI_API_KEY` (не свети в git)
- домен + HTTPS

## Что внутри (MVP)

- Чат с Маей, голос, погода, гардероб с фото
- Дневники, моменты + фильм-воспоминание
- Данные в браузере пользователя (localStorage)
- PWA: иконка на рабочий стол
