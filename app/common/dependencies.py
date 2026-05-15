from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.auth.jwt import decode_access_token, extract_client_id, unauthorized_error
from app.config import Settings, get_settings

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_client_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    settings: Settings = Depends(get_settings),
) -> int:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized_error()

    payload = decode_access_token(credentials.credentials, settings)
    return extract_client_id(payload)
