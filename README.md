# Telegram Mini App Car Rental Backend

FastAPI MVP backend for a Telegram Mini App car rental service.

## Stack

- FastAPI
- PostgreSQL
- asyncpg
- Layered architecture: controller -> service -> repository -> db

## Setup

1. Create and activate a virtual environment.
2. Install dependencies:

```bash
pip install -r requirements.txt
```

3. Create PostgreSQL database using the schema described in `docs/database.md`.
4. Copy environment example:

```bash
cp .env.example .env
```

5. Set `DATABASE_URL` and replace `JWT_SECRET` in `.env`.

For local development and Swagger checks, `DEBUG=true` makes `POST /auth/telegram`
accept debug auth. You can send:

```json
{
  "init_data": "debug"
}
```

The backend authenticates as:

```json
{
  "telegram_id": 999999,
  "username": "debug_user"
}
```

For production, use `DEBUG=false` and set `TELEGRAM_BOT_TOKEN`. In this mode
`POST /auth/telegram` accepts only real Telegram WebApp init data with a valid
Telegram `hash`; arbitrary JSON is rejected. The frontend should send
`window.Telegram.WebApp.initData` as a string.

## Run

```bash
uvicorn app.main:app --reload
```

Swagger UI is available at:

```text
http://127.0.0.1:8000/docs
```

## Tests

Install dependencies, then run:

```bash
pytest
```

or:

```bash
pytest tests/
```

Tests use API-level requests against the FastAPI app and wrap database changes in a
transaction that is rolled back after each test. Set `TEST_DATABASE_URL` to point at a
separate test database when running outside local development.

## Auth Context

After `POST /auth/telegram`, use the returned JWT access token for protected actions:

```http
Authorization: Bearer <access_token>
```

`POST /auth/telegram` returns:

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

Protected endpoints:

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

Public endpoints:

- `POST /auth/telegram`
- `GET /branches`
- `GET /cars`
- `GET /cars?branch_id=`
- `POST /availability/check`

## Client Profile

Before creating a booking or agreement, the client profile must be completed.
The database field `client.profile_completed` is true only when all profile fields are
filled:

- `full_name`
- `age`
- `license_no`

Apply the migration before running this version:

```sql
\i app/db/migrations/001_add_client_profile_completed.sql
\i app/db/migrations/002_make_agreement_employee_nullable.sql
\i app/db/migrations/003_add_employee_client_id.sql
```

If the profile is incomplete, `POST /booking` and `POST /agreement` return:

```json
{
  "error_code": "PROFILE_INCOMPLETE",
  "message": "Complete profile before booking"
}
```

## Implemented Endpoints

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

## Admin Access

Admin endpoints use the same JWT bearer token as client endpoints. A user is an admin
only when the `employee` table has a row with:

```sql
employee.client_id = client.client_id
```

`GET /user/me` returns `is_admin: true` for this case, so the frontend can show
admin UI without probing `/admin/*` first.

Do not use `client_id = employee_id`. If the user has no employee row, `/admin/*`
returns:

```json
{
  "error_code": "FORBIDDEN",
  "message": "Admin access required"
}
```

## Booking Expiration

The app starts a background system task that periodically expires bookings where:

```sql
reserved_until < NOW()
AND status = 'pending'
```

Expired bookings are moved to `expired`, and cars in `reserved` status are released to
`available` when no active booking remains for the car.
