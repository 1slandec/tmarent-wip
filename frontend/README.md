# Frontend Telegram Mini App

Vanilla HTML/CSS/JavaScript MVP для Telegram Mini App сервиса аренды автомобилей.

## Запуск

1. Запустите backend FastAPI на `http://127.0.0.1:8000`.
2. Поднимите frontend dev server с прокси к реальному backend:

```powershell
node frontend/dev-server.mjs --port 5173 --api http://127.0.0.1:8000
```

3. Откройте `http://127.0.0.1:5173`.

Если backend уже настроен на CORS для origin frontend, можно отдать файлы обычным static server:

```powershell
python -m http.server 5173 -d frontend
```

В Telegram Mini App авторизация использует `window.Telegram.WebApp.initData`. При локальной разработке вне Telegram frontend всё равно вызывает реальный `POST /auth/telegram`; если backend работает с `DEBUG=true`, backend примет debug auth.

## API URL

Базовый URL по умолчанию: `http://127.0.0.1:8000`.

Для быстрой смены без сборщика можно выполнить в консоли браузера:

```js
localStorage.setItem("API_BASE_URL", "http://127.0.0.1:8000");
```

`.env.example` оставлен для деплоя/документации окружения.

## Структура

- `index.html` - shell приложения.
- `css/styles.css` - mobile-first стили.
- `js/api/*` - axios services и endpoint-контракты.
- `js/auth.js` - Telegram auth + JWT storage.
- `js/router.js` - SPA navigation.
- `components/*` - переиспользуемые UI-функции.
- `pages/*` - экраны Mini App.

Backend DTO не переписываются, mock backend не используется.
