import hashlib
import hmac
import json
from urllib.parse import parse_qsl

import asyncpg

from app.auth.jwt import create_access_token
from app.auth.repository import AuthRepository
from app.common.errors import BusinessError
from app.config import Settings


class AuthService:
    def __init__(self, repository: AuthRepository, settings: Settings) -> None:
        self.repository = repository
        self.settings = settings

    async def auth_telegram(
        self, connection: asyncpg.Connection, init_data: str
    ) -> dict:
        telegram_user = self._parse_init_data(init_data)
        telegram_id = telegram_user.get("id")
        if telegram_id is None:
            raise BusinessError("auth_failed", "Telegram user id is required", 401)

        username = telegram_user.get("username")
        full_name = self._build_full_name(telegram_user)

        existing = await self.repository.get_client_by_telegram_id(
            connection, int(telegram_id)
        )
        if existing is None:
            client = await self.repository.create_client(
                connection, int(telegram_id), username, full_name
            )
            is_new_user = True
        else:
            client = await self.repository.update_client_from_telegram(
                connection, int(telegram_id), username, full_name
            )
            is_new_user = False

        access_token = create_access_token(client["client_id"], self.settings)

        return {
            "access_token": access_token,
            "token_type": "bearer",
            "client": {
                "client_id": client["client_id"],
                "telegram_id": client["telegram_id"],
                "username": client["username"],
                "is_new_user": is_new_user,
            },
            "status": "success",
        }

    async def get_me(self, connection: asyncpg.Connection, client_id: int) -> dict:
        client = await self.repository.get_client_by_id(connection, client_id)
        if client is None:
            raise BusinessError("user_not_found", "Пользователь не найден", 404)
        user = dict(client)
        user["is_admin"] = await self.repository.client_has_employee(
            connection,
            client_id,
        )
        return user

    async def update_profile(
        self,
        connection: asyncpg.Connection,
        client_id: int,
        full_name: str,
        age: int,
        license_no: str,
    ) -> dict:
        full_name = self._validate_required_text(
            full_name,
            "INVALID_FULL_NAME",
            "full_name must not be empty",
        )
        license_no = self._validate_required_text(
            license_no,
            "INVALID_LICENSE_NO",
            "license_no must not be empty",
        )
        if age < 18:
            raise BusinessError("INVALID_AGE", "age must be at least 18")

        profile_completed = self._is_profile_completed(full_name, age, license_no)
        client = await self.repository.update_client_profile(
            connection,
            client_id,
            full_name,
            age,
            license_no,
            profile_completed,
        )
        if client is None:
            raise BusinessError("user_not_found", "Пользователь не найден", 404)
        return dict(client)

    def _parse_init_data(self, init_data: str) -> dict:
        if self.settings.debug:
            return {
                "id": 999999,
                "username": "debug_user",
            }

        if not self.settings.telegram_bot_token:
            raise BusinessError(
                "auth_failed",
                "Telegram bot token is not configured",
                401,
            )

        if not init_data or "=" not in init_data:
            raise BusinessError("auth_failed", "Invalid Telegram init data", 401)

        pairs = dict(parse_qsl(init_data, keep_blank_values=True))
        if not pairs:
            raise BusinessError("auth_failed", "Invalid Telegram init data", 401)

        if "hash" not in pairs:
            raise BusinessError("auth_failed", "Telegram hash is required", 401)

        self._validate_telegram_hash(pairs)

        user_raw = pairs.get("user")
        if not user_raw:
            raise BusinessError("auth_failed", "Telegram user data is required", 401)

        try:
            user = json.loads(user_raw)
        except json.JSONDecodeError as exc:
            raise BusinessError("auth_failed", "Invalid Telegram user data", 401) from exc
        if not isinstance(user, dict):
            raise BusinessError("auth_failed", "Invalid Telegram user data", 401)
        if user.get("id") is None:
            raise BusinessError("auth_failed", "Telegram user id is required", 401)

        return user

    def _validate_telegram_hash(self, pairs: dict[str, str]) -> None:
        received_hash = pairs.get("hash")
        if not received_hash:
            raise BusinessError("auth_failed", "Telegram hash is required", 401)

        data_check_string = "\n".join(
            f"{key}={value}" for key, value in sorted(pairs.items()) if key != "hash"
        )
        secret_key = hmac.new(
            b"WebAppData",
            self.settings.telegram_bot_token.encode(),
            hashlib.sha256,
        ).digest()
        calculated_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(calculated_hash, received_hash):
            raise BusinessError("auth_failed", "Invalid Telegram init data hash", 401)

    def _build_full_name(self, telegram_user: dict) -> str | None:
        parts = [
            telegram_user.get("first_name"),
            telegram_user.get("last_name"),
        ]
        full_name = " ".join(part for part in parts if part)
        return full_name or None

    def _validate_required_text(
        self, value: str, error_code: str, message: str
    ) -> str:
        value = value.strip()
        if not value:
            raise BusinessError(error_code, message)
        return value

    def _is_profile_completed(
        self, full_name: str | None, age: int | None, license_no: str | None
    ) -> bool:
        return full_name is not None and age is not None and license_no is not None
