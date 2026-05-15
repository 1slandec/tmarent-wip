import hashlib
import hmac
import json
from urllib.parse import urlencode

import pytest

from app.config import Settings, get_settings
from app.main import app
from tests.conftest import unique_int

pytestmark = pytest.mark.asyncio


def override_settings(settings: Settings) -> None:
    app.dependency_overrides[get_settings] = lambda: settings


def build_init_data(bot_token: str, user: dict) -> str:
    pairs = {
        "auth_date": "1710000000",
        "query_id": "test-query",
        "user": json.dumps(user, separators=(",", ":")),
    }
    data_check_string = "\n".join(
        f"{key}={value}" for key, value in sorted(pairs.items())
    )
    secret_key = hmac.new(
        b"WebAppData",
        bot_token.encode(),
        hashlib.sha256,
    ).digest()
    pairs["hash"] = hmac.new(
        secret_key,
        data_check_string.encode(),
        hashlib.sha256,
    ).hexdigest()
    return urlencode(pairs)


async def test_debug_auth_accepts_debug_init_data(api_client):
    override_settings(
        Settings(
            debug=True,
            telegram_bot_token=None,
            jwt_secret="test-secret",
        )
    )

    response = await api_client.post(
        "/auth/telegram",
        json={"init_data": "debug"},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["token_type"] == "bearer"
    assert body["client"]["telegram_id"] == 999999
    assert body["client"]["username"] == "debug_user"
    assert body["status"] == "success"


async def test_production_rejects_unverified_init_data(api_client):
    cases = [
        (
            Settings(
                debug=False,
                telegram_bot_token="test-bot-token",
                jwt_secret="test-secret",
            ),
            '{"id":999999}',
            "Invalid Telegram init data",
        ),
        (
            Settings(
                debug=False,
                telegram_bot_token="test-bot-token",
                jwt_secret="test-secret",
            ),
            urlencode({"user": json.dumps({"id": 999999})}),
            "Telegram hash is required",
        ),
        (
            Settings(
                debug=False,
                telegram_bot_token=None,
                jwt_secret="test-secret",
            ),
            urlencode({"user": json.dumps({"id": 999999}), "hash": "fake"}),
            "Telegram bot token is not configured",
        ),
    ]

    for settings, init_data, expected_message in cases:
        override_settings(settings)
        response = await api_client.post(
            "/auth/telegram",
            json={"init_data": init_data},
        )

        assert response.status_code == 401
        assert response.json() == {
            "error_code": "auth_failed",
            "message": expected_message,
        }


async def test_valid_telegram_init_data_success(api_client):
    bot_token = "test-bot-token"
    telegram_id = 9_000_000_000_000 + unique_int()
    override_settings(
        Settings(
            debug=False,
            telegram_bot_token=bot_token,
            jwt_secret="test-secret",
        )
    )
    init_data = build_init_data(
        bot_token,
        {
            "id": telegram_id,
            "username": "verified_user",
            "first_name": "Verified",
            "last_name": "User",
        },
    )

    response = await api_client.post(
        "/auth/telegram",
        json={"init_data": init_data},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["client"]["telegram_id"] == telegram_id
    assert body["client"]["username"] == "verified_user"
    assert body["status"] == "success"
