import asyncpg
from fastapi import APIRouter, Depends

from app.auth.dto import (
    TelegramAuthRequest,
    TelegramAuthResponse,
    UserMeResponse,
    UserProfileUpdateRequest,
    UserProfileUpdateResponse,
)
from app.auth.repository import AuthRepository
from app.auth.service import AuthService
from app.common.dependencies import get_current_client_id
from app.config import Settings, get_settings
from app.db.database import acquire_connection

router = APIRouter(tags=["auth"])


def get_auth_service(settings: Settings = Depends(get_settings)) -> AuthService:
    return AuthService(AuthRepository(), settings)


@router.post("/auth/telegram", response_model=TelegramAuthResponse)
async def auth_telegram(
    payload: TelegramAuthRequest,
    connection: asyncpg.Connection = Depends(acquire_connection),
    service: AuthService = Depends(get_auth_service),
) -> dict:
    return await service.auth_telegram(connection, payload.init_data)


@router.get("/user/me", response_model=UserMeResponse)
async def get_me(
    client_id: int = Depends(get_current_client_id),
    connection: asyncpg.Connection = Depends(acquire_connection),
    service: AuthService = Depends(get_auth_service),
) -> dict:
    return await service.get_me(connection, client_id)


@router.patch(
    "/user/me",
    response_model=UserProfileUpdateResponse,
    summary="Update current user profile",
)
async def update_me(
    payload: UserProfileUpdateRequest,
    client_id: int = Depends(get_current_client_id),
    connection: asyncpg.Connection = Depends(acquire_connection),
    service: AuthService = Depends(get_auth_service),
) -> dict:
    return await service.update_profile(
        connection,
        client_id,
        payload.full_name,
        payload.age,
        payload.license_no,
    )
