# Фронтенд для Telegram Mini App

MVP на чистых HTML/CSS/JavaScript для Telegram Mini App сервиса аренды автомобилей.

## Запуск

1. Запустите FastAPI-бэкенд на `http://127.0.0.1:8000`.
2. Поднимите dev server фронтенда с прокси к реальному бэкенду:

```powershell
node frontend/dev-server.mjs --port 5173 --api http://127.0.0.1:8000
```

3. Откройте `http://127.0.0.1:5173`.

Если бэкенд уже настроен на CORS для origin фронтенда, можно отдать файлы обычным static server:

```powershell
python -m http.server 5173 -d frontend
```

В Telegram Mini App авторизация использует `window.Telegram.WebApp.initData`. При локальной разработке вне Telegram фронтенд всё равно вызывает реальный `POST /auth/telegram`; если бэкенд работает с `DEBUG=true`, он примет debug-авторизацию.

## API URL

Базовый URL по умолчанию: `http://127.0.0.1:8000`.

Для быстрой смены URL без сборщика можно выполнить в консоли браузера:

```js
localStorage.setItem("API_BASE_URL", "http://127.0.0.1:8000");
```

`.env.example` оставлен для деплоя и документации окружения.

## Структура

- `index.html` - оболочка приложения.
- `css/styles.css` - стили с подходом mobile-first.
- `js/api/*` - axios-сервисы и контракты эндпоинтов.
- `js/auth.js` - Telegram-авторизация и хранение JWT.
- `js/router.js` - навигация SPA.
- `components/*` - переиспользуемые UI-функции.
- `pages/*` - экраны Mini App.

DTO бэкенда не переписываются, имитационный бэкенд не используется.
