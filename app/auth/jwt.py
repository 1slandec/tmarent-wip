from datetime import datetime, timedelta, timezone

import jwt

from app.common.errors import BusinessError
from app.config import Settings


def unauthorized_error() -> BusinessError:
    return BusinessError(
        "UNAUTHORIZED",
        "Invalid or missing access token",
        status_code=401,
    )


def create_access_token(client_id: int, settings: Settings) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(
        minutes=settings.jwt_expire_minutes
    )
    payload = {
        "sub": str(client_id),
        "client_id": client_id,
        "exp": expires_at,
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def decode_access_token(token: str, settings: Settings) -> dict:
    try:
        return jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
        )
    except jwt.PyJWTError as exc:
        raise unauthorized_error() from exc


def extract_client_id(payload: dict) -> int:
    client_id = payload.get("client_id") or payload.get("sub")
    try:
        return int(client_id)
    except (TypeError, ValueError) as exc:
        raise unauthorized_error() from exc
