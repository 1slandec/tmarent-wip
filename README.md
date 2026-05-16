# Бэкенд аренды автомобилей для Telegram Mini App

MVP-бэкенд на FastAPI для сервиса аренды автомобилей в Telegram Mini App.

## Стек

- FastAPI
- PostgreSQL
- asyncpg
- Слоистая архитектура: контроллер -> сервис -> репозиторий -> база данных

## Настройка

1. Создайте и активируйте виртуальное окружение.
2. Установите зависимости:

```bash
pip install -r requirements.txt
```

3. Создайте базу PostgreSQL по схеме из `docs/database.md`.
4. Скопируйте пример окружения:

```bash
cp .env.example .env
```

5. Укажите `DATABASE_URL` и замените `JWT_SECRET` в `.env`.

Для локальной разработки и проверки Swagger можно включить `DEBUG=true`.
В этом режиме `POST /auth/telegram` принимает debug-авторизацию:

```json
{
  "init_data": "debug"
}
```

Бэкенд авторизует пользователя как:

```json
{
  "telegram_id": 999999,
  "username": "debug_user"
}
```

Для продакшена используйте `DEBUG=false` и задайте `TELEGRAM_BOT_TOKEN`.
В этом режиме `POST /auth/telegram` принимает только настоящие Telegram WebApp
init data с валидным Telegram `hash`; произвольный JSON будет отклонён.
Фронтенд должен отправлять `window.Telegram.WebApp.initData` строкой.

## CORS

Фронтенд и бэкенд могут работать на разных доменах, например фронтенд на Vercel,
а API на Render. Разрешённые origins фронтенда задаются в `.env`:

```env
CORS_ORIGINS=http://localhost:5173,http://127.0.0.1:5173,https://frontend.vercel.app
```

В продакшене оставляйте только реальный домен фронтенда. Бэкенд разрешает заголовок
`Authorization: Bearer <JWT>` и автоматически обрабатывает браузерные preflight-запросы `OPTIONS`.

## Запуск

```bash
uvicorn app.main:app --reload
```

Swagger UI доступен по адресу:

```text
http://127.0.0.1:8000/docs
```

## Тесты

Установите зависимости, затем запустите:

```bash
pytest
```

или:

```bash
pytest tests/
```

Тесты отправляют API-запросы к FastAPI-приложению и оборачивают изменения базы данных
в транзакцию, которая откатывается после каждого теста. При запуске вне локальной
разработки задайте `TEST_DATABASE_URL`, чтобы использовать отдельную тестовую базу.

## Контекст авторизации

После `POST /auth/telegram` используйте возвращённый JWT access token для
защищённых действий:

```http
Authorization: Bearer <access_token>
```

`POST /auth/telegram` возвращает:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "client": {
    "client_id": 1,
    "telegram_id": 123456789,
    "username": "misha",
    "is_new_user": false
  },
  "status": "success"
}
```

Защищённые эндпоинты:

- `GET /user/me`
- `PATCH /user/me`
- `POST /booking`
- `POST /booking/cancel`
- `POST /booking/confirm`
- `GET /booking/active`
- `POST /agreement`
- `POST /agreement/complete`
- `GET /agreement/history`
- `POST /payment`
- `POST /admin/branches`
- `PATCH /admin/branches/{branch_id}`
- `DELETE /admin/branches/{branch_id}`
- `POST /admin/cars`
- `PATCH /admin/cars/{car_id}`
- `DELETE /admin/cars/{car_id}`

Публичные эндпоинты:

- `POST /auth/telegram`
- `GET /branches`
- `GET /cars`
- `GET /cars?branch_id=`
- `POST /availability/check`

## Профиль клиента

Перед созданием бронирования или договора профиль клиента должен быть заполнен.
Поле базы `client.profile_completed` равно `true` только когда заполнены все
поля профиля:

- `full_name`
- `age`
- `license_no`

Перед запуском этой версии примените миграции:

```sql
\i app/db/migrations/001_add_client_profile_completed.sql
\i app/db/migrations/002_make_agreement_employee_nullable.sql
\i app/db/migrations/003_add_employee_client_id.sql
```

Если профиль не заполнен, `POST /booking` и `POST /agreement` возвращают:

```json
{
  "error_code": "PROFILE_INCOMPLETE",
  "message": "Complete profile before booking"
}
```

## Реализованные эндпоинты

- `POST /auth/telegram`
- `GET /user/me`
- `PATCH /user/me`
- `GET /branches`
- `GET /cars`
- `GET /cars?branch_id=`
- `POST /availability/check`
- `POST /booking`
- `POST /booking/cancel`
- `POST /booking/confirm`
- `GET /booking/active`
- `POST /agreement`
- `POST /agreement/complete`
- `GET /agreement/history`
- `POST /payment`
- `POST /admin/branches`
- `PATCH /admin/branches/{branch_id}`
- `DELETE /admin/branches/{branch_id}`
- `POST /admin/cars`
- `PATCH /admin/cars/{car_id}`
- `DELETE /admin/cars/{car_id}`

## Доступ администратора

Административные эндпоинты используют тот же JWT bearer token, что и клиентские эндпоинты.
Пользователь считается администратором только если в таблице `employee` есть строка:

```sql
employee.client_id = client.client_id
```

В этом случае `GET /user/me` возвращает `is_admin: true`, и фронтенд может
показать admin UI без пробного обращения к `/admin/*`.

Не используйте `client_id = employee_id`. Если у пользователя нет строки
`employee`, `/admin/*` возвращает:

```json
{
  "error_code": "FORBIDDEN",
  "message": "Admin access required"
}
```

## Истечение бронирований

Приложение запускает фоновую системную задачу, которая периодически истекает
бронирования по условию:

```sql
reserved_until < NOW()
AND status = 'pending'
```

Истёкшие бронирования переводятся в `expired`, а автомобили в статусе `reserved`
освобождаются в `available`, если для автомобиля больше нет активной брони.
