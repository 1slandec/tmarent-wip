import asyncpg
from fastapi import APIRouter, Depends

from app.booking.dto import (
    ActiveBookingResponse,
    AvailabilityCheckRequest,
    AvailabilityCheckResponse,
    BookingCancelRequest,
    BookingCancelResponse,
    BookingConfirmRequest,
    BookingConfirmResponse,
    BookingCreateRequest,
    BookingCreateResponse,
    NoActiveBookingResponse,
)
from app.booking.repository import BookingRepository
from app.booking.service import BookingService
from app.common.dependencies import get_current_client_id
from app.config import Settings, get_settings
from app.db.database import acquire_connection, get_pool

router = APIRouter(tags=["booking"])


def get_booking_service(settings: Settings = Depends(get_settings)) -> BookingService:
    return BookingService(BookingRepository(), settings)


@router.post(
    "/availability/check",
    response_model=AvailabilityCheckResponse,
    response_model_exclude_none=True,
)
async def check_availability(
    payload: AvailabilityCheckRequest,
    connection: asyncpg.Connection = Depends(acquire_connection),
    service: BookingService = Depends(get_booking_service),
) -> dict:
    return await service.check_availability(
        connection,
        payload.car_id,
        payload.start_date,
        payload.end_date,
    )


@router.post("/booking", response_model=BookingCreateResponse)
async def create_booking(
    payload: BookingCreateRequest,
    client_id: int = Depends(get_current_client_id),
    pool: asyncpg.Pool = Depends(get_pool),
    service: BookingService = Depends(get_booking_service),
) -> dict:
    return await service.create_booking(
        pool,
        client_id,
        payload.car_id,
        payload.start_date,
        payload.end_date,
    )


@router.post("/booking/cancel", response_model=BookingCancelResponse)
async def cancel_booking(
    payload: BookingCancelRequest,
    client_id: int = Depends(get_current_client_id),
    pool: asyncpg.Pool = Depends(get_pool),
    service: BookingService = Depends(get_booking_service),
) -> dict:
    return await service.cancel_booking(pool, client_id, payload.booking_id)


@router.post("/booking/confirm", response_model=BookingConfirmResponse)
async def confirm_booking(
    payload: BookingConfirmRequest,
    client_id: int = Depends(get_current_client_id),
    pool: asyncpg.Pool = Depends(get_pool),
    service: BookingService = Depends(get_booking_service),
) -> dict:
    return await service.confirm_booking(
        pool,
        client_id,
        payload.booking_id,
        payload.method,
    )


@router.get("/booking/active", response_model=ActiveBookingResponse | NoActiveBookingResponse)
async def get_active_booking(
    client_id: int = Depends(get_current_client_id),
    connection: asyncpg.Connection = Depends(acquire_connection),
    service: BookingService = Depends(get_booking_service),
) -> dict:
    return await service.get_active_booking(connection, client_id)
