from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

import asyncpg

from app.agreement.repository import AgreementRepository
from app.booking.repository import BookingRepository
from app.common.errors import BusinessError
from app.common.profile import ensure_profile_completed
from app.config import Settings
from app.payment.repository import PaymentRepository


class BookingService:
    def __init__(
        self,
        repository: BookingRepository,
        settings: Settings,
        agreement_repository: AgreementRepository | None = None,
        payment_repository: PaymentRepository | None = None,
    ) -> None:
        self.repository = repository
        self.settings = settings
        self.agreement_repository = agreement_repository or AgreementRepository()
        self.payment_repository = payment_repository or PaymentRepository()

    async def check_availability(
        self,
        connection: asyncpg.Connection,
        car_id: int,
        start_date: date,
        end_date: date,
    ) -> dict:
        self._validate_dates(start_date, end_date)

        car = await self.repository.get_car(connection, car_id)
        if car is None:
            raise BusinessError("car_not_found", "Автомобиль не найден", 404)

        if car["status"] == "maintenance":
            return {"is_available": False, "message": "Автомобиль на обслуживании"}

        conflicts = await self.repository.find_conflicting_bookings(
            connection, car_id, start_date, end_date
        )
        if conflicts:
            return {
                "is_available": False,
                "conflicting_bookings": [booking["booking_id"] for booking in conflicts],
                "message": "Автомобиль занят",
            }

        return {"is_available": True, "message": "Автомобиль доступен"}

    async def create_booking(
        self,
        pool: asyncpg.Pool,
        client_id: int,
        car_id: int,
        start_date: date,
        end_date: date,
    ) -> dict:
        self._validate_dates(start_date, end_date)
        async with pool.acquire() as connection:
            async with connection.transaction():
                await self.expire_pending_bookings(connection)

                client = await self.repository.get_client(connection, client_id)
                if client is None:
                    raise BusinessError("user_not_found", "Пользователь не найден", 404)
                ensure_profile_completed(client)

                car = await self.repository.get_car_for_update(connection, car_id)
                if car is None:
                    raise BusinessError("car_not_found", "Автомобиль не найден", 404)
                if car["status"] == "maintenance":
                    raise BusinessError("car_not_available", "Автомобиль на обслуживании")

                has_active_booking = await self.repository.has_active_booking(
                    connection, client_id
                )
                if has_active_booking:
                    raise BusinessError(
                        "user_has_active_booking",
                        "У пользователя уже есть активная бронь",
                    )

                conflicts = await self.repository.find_conflicting_bookings(
                    connection, car_id, start_date, end_date
                )
                if conflicts:
                    raise BusinessError("double_booking", "Автомобиль уже забронирован")

                days = Decimal((end_date - start_date).days + 1)
                total_price = Decimal(car["price_per_day"]) * days
                reserved_until = datetime.now(timezone.utc) + timedelta(
                    minutes=self.settings.booking_reservation_minutes
                )

                booking = await self.repository.create_booking(
                    connection,
                    client_id,
                    car_id,
                    start_date,
                    end_date,
                    reserved_until,
                    total_price,
                )
                await self.repository.update_car_status(connection, car_id, "reserved")

        return dict(booking)

    async def cancel_booking(
        self, pool: asyncpg.Pool, client_id: int, booking_id: int
    ) -> dict:
        async with pool.acquire() as connection:
            async with connection.transaction():
                booking = await self.repository.get_booking_for_update(
                    connection, booking_id
                )
                if booking is None:
                    raise BusinessError("booking_not_found", "Бронирование не найдено", 404)
                if booking["client_id"] != client_id:
                    raise BusinessError("user_mismatch", "Бронирование принадлежит другому клиенту", 403)
                if booking["status"] not in {"pending", "confirmed"}:
                    raise BusinessError(
                        "invalid_state_transition",
                        "Бронирование нельзя отменить в текущем статусе",
                    )

                cancelled = await self.repository.cancel_booking(connection, booking_id)
                await self.repository.release_car_if_possible(connection, booking["car_id"])

        return {
            "booking_id": cancelled["booking_id"],
            "status": cancelled["status"],
            "message": "Бронирование отменено",
        }

    async def confirm_booking(
        self,
        pool: asyncpg.Pool,
        client_id: int,
        booking_id: int,
        method: str,
    ) -> dict:
        async with pool.acquire() as connection:
            async with connection.transaction():
                booking = await self.repository.get_booking_for_confirm(
                    connection,
                    booking_id,
                )
                if booking is None:
                    raise BusinessError(
                        "BOOKING_NOT_FOUND",
                        "Booking not found",
                        status_code=404,
                    )
                if booking["client_id"] != client_id:
                    raise BusinessError(
                        "USER_MISMATCH",
                        "Booking belongs to another user",
                        status_code=403,
                    )
                if booking["status"] == "confirmed":
                    raise BusinessError(
                        "BOOKING_ALREADY_CONFIRMED",
                        "Booking already confirmed",
                    )
                if booking["status"] == "expired":
                    raise BusinessError("BOOKING_EXPIRED", "Booking expired")
                if booking["status"] != "pending":
                    raise BusinessError(
                        "INVALID_BOOKING_STATE",
                        "Booking must be pending",
                    )
                if booking["reserved_until"] <= datetime.now(timezone.utc):
                    raise BusinessError("BOOKING_EXPIRED", "Booking expired")

                agreement_exists = (
                    await self.agreement_repository.agreement_exists_for_booking(
                        connection,
                        booking_id,
                    )
                )
                if agreement_exists:
                    raise BusinessError(
                        "BOOKING_ALREADY_CONFIRMED",
                        "Booking already confirmed",
                    )

                active_agreement_exists = (
                    await self.agreement_repository.active_agreement_exists_for_car(
                        connection,
                        booking["car_id"],
                    )
                )
                if active_agreement_exists:
                    raise BusinessError(
                        "INVALID_BOOKING_STATE",
                        "Car already has active agreement",
                    )

                agreement = await self.agreement_repository.create_mock_agreement(
                    connection,
                    booking["client_id"],
                    booking["car_id"],
                    booking["booking_id"],
                    booking["total_price"],
                    booking["start_date"],
                    booking["end_date"],
                )
                payment = await self.payment_repository.create_paid_payment(
                    connection,
                    agreement["agreement_id"],
                    booking["total_price"],
                    method,
                )
                confirmed_booking = await self.repository.update_booking_status(
                    connection,
                    booking_id,
                    "confirmed",
                )
                await self.repository.update_car_status(
                    connection,
                    booking["car_id"],
                    "rented",
                )

        return {
            "booking_id": confirmed_booking["booking_id"],
            "booking_status": confirmed_booking["status"],
            "payment": {
                "payment_id": payment["payment_id"],
                "status": payment["status"],
                "amount": payment["amount"],
                "method": payment["method"],
            },
            "agreement": {
                "agreement_id": agreement["agreement_id"],
                "status": agreement["status"],
            },
            "message": "Бронь оплачена и подтверждена",
        }

    async def get_active_booking(
        self, connection: asyncpg.Connection, client_id: int
    ) -> dict:
        booking = await self.repository.get_active_booking(connection, client_id)
        if booking is None:
            return {"booking": None, "message": "Активная бронь отсутствует"}

        return {
            "booking_id": booking["booking_id"],
            "status": booking["status"],
            "start_date": booking["start_date"],
            "end_date": booking["end_date"],
            "reserved_until": booking["reserved_until"],
            "total_price": booking["total_price"],
            "car": {
                "car_id": booking["car_id"],
                "model": booking["model"],
                "year": booking["year"],
                "price_per_day": booking["price_per_day"],
                "status": booking["car_status"],
                "image_url": booking["image_url"],
            },
            "branch": {
                "branch_id": booking["branch_id"],
                "address": booking["address"],
            },
        }

    async def expire_pending_bookings(self, connection: asyncpg.Connection) -> int:
        expired = await self.repository.expire_pending_bookings(connection)
        for booking in expired:
            await self.repository.release_car_if_possible(connection, booking["car_id"])
        return len(expired)

    async def expire_pending_bookings_job(self, pool: asyncpg.Pool) -> int:
        async with pool.acquire() as connection:
            async with connection.transaction():
                return await self.expire_pending_bookings(connection)

    def _validate_dates(self, start_date: date, end_date: date) -> None:
        if start_date > end_date:
            raise BusinessError("invalid_dates", "Дата окончания должна быть позже даты начала")
        if start_date < datetime.now(timezone.utc).date():
            raise BusinessError("date_in_past", "Дата начала не может быть в прошлом")
