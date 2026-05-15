import asyncio
from contextlib import asynccontextmanager
from contextlib import suppress

from fastapi import FastAPI

from app.admin.controller import router as admin_router
from app.agreement.controller import router as agreement_router
from app.auth.controller import router as auth_router
from app.booking.controller import router as booking_router
from app.booking.repository import BookingRepository
from app.booking.service import BookingService
from app.car.controller import router as car_router
from app.common.errors import register_error_handlers
from app.config import get_settings
from app.db.database import create_pool
from app.payment.controller import router as payment_router


async def expire_bookings_loop(app: FastAPI) -> None:
    settings = app.state.settings
    service = BookingService(BookingRepository(), settings)
    while True:
        try:
            await service.expire_pending_bookings_job(app.state.db_pool)
        except Exception:
            pass
        await asyncio.sleep(settings.booking_expiration_interval_seconds)


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    app.state.settings = settings
    app.state.db_pool = await create_pool(settings)
    app.state.booking_expiration_task = asyncio.create_task(expire_bookings_loop(app))

    try:
        yield
    finally:
        app.state.booking_expiration_task.cancel()
        with suppress(asyncio.CancelledError):
            await app.state.booking_expiration_task
        await app.state.db_pool.close()


app = FastAPI(
    title="TMARent",
    version="0.1.0",
    lifespan=lifespan,
)

register_error_handlers(app)

app.include_router(auth_router)
app.include_router(car_router)
app.include_router(booking_router)
app.include_router(agreement_router)
app.include_router(payment_router)
app.include_router(admin_router)
