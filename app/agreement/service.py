from datetime import datetime, timezone

import asyncpg

from app.agreement.repository import AgreementRepository
from app.common.errors import BusinessError
from app.common.profile import ensure_profile_completed


class AgreementService:
    def __init__(self, repository: AgreementRepository) -> None:
        self.repository = repository

    async def create_agreement(
        self,
        pool: asyncpg.Pool,
        client_id: int,
        booking_id: int,
        employee_id: int,
        insurance: str,
        terms: str,
    ) -> dict:
        async with pool.acquire() as connection:
            async with connection.transaction():
                client = await self.repository.get_client(connection, client_id)
                if client is None:
                    raise BusinessError("user_not_found", "Пользователь не найден", 404)
                ensure_profile_completed(client)

                booking = await self.repository.get_booking_for_update(
                    connection, booking_id
                )
                if booking is None:
                    raise BusinessError("booking_not_found", "Бронирование не найдено", 404)
                if booking["client_id"] != client_id:
                    raise BusinessError("user_mismatch", "Бронирование принадлежит другому клиенту", 403)
                if booking["status"] != "pending":
                    raise BusinessError(
                        "invalid_state_transition",
                        "Договор можно создать только из pending бронирования",
                    )
                if booking["reserved_until"] <= datetime.now(timezone.utc):
                    await self.repository.update_booking_status(
                        connection, booking_id, "expired"
                    )
                    raise BusinessError("booking_expired", "Срок удержания брони истек")

                employee_exists = await self.repository.employee_exists(
                    connection, employee_id
                )
                if not employee_exists:
                    raise BusinessError("employee_not_found", "Сотрудник не найден", 404)

                booking_used = await self.repository.agreement_exists_for_booking(
                    connection, booking_id
                )
                if booking_used:
                    raise BusinessError("booking_already_used", "По бронированию уже создан договор")

                car_has_active_agreement = (
                    await self.repository.active_agreement_exists_for_car(
                        connection, booking["car_id"]
                    )
                )
                if car_has_active_agreement:
                    raise BusinessError("invalid_state_transition", "Автомобиль уже в аренде")

                agreement = await self.repository.create_agreement(
                    connection,
                    booking["client_id"],
                    booking["car_id"],
                    employee_id,
                    booking_id,
                    booking["total_price"],
                    insurance,
                    terms,
                    booking["start_date"],
                    booking["end_date"],
                )
                await self.repository.update_booking_status(
                    connection, booking_id, "confirmed"
                )
                await self.repository.update_car_status(
                    connection, booking["car_id"], "rented"
                )

        return dict(agreement)

    async def complete_agreement(
        self, pool: asyncpg.Pool, client_id: int, agreement_id: int
    ) -> dict:
        async with pool.acquire() as connection:
            async with connection.transaction():
                agreement = await self.repository.get_agreement_for_update(
                    connection, agreement_id
                )
                if agreement is None:
                    raise BusinessError("agreement_not_found", "Договор не найден", 404)
                if agreement["client_id"] != client_id:
                    raise BusinessError("user_mismatch", "Договор принадлежит другому клиенту", 403)
                if agreement["status"] != "active":
                    raise BusinessError(
                        "invalid_state_transition",
                        "Договор нельзя завершить в текущем статусе",
                    )

                completed = await self.repository.complete_agreement(
                    connection, agreement_id
                )
                await self.repository.update_car_status(
                    connection, agreement["car_id"], "available"
                )

        return {
            "agreement_id": completed["agreement_id"],
            "status": completed["status"],
            "message": "Аренда завершена",
        }

    async def get_history(
        self, connection: asyncpg.Connection, client_id: int
    ) -> dict:
        rows = await self.repository.list_history(connection, client_id)
        history = []
        for row in rows:
            payment = None
            if row["payment_id"] is not None:
                payment = {
                    "payment_id": row["payment_id"],
                    "status": row["payment_status"],
                    "amount": row["payment_amount"],
                    "method": row["payment_method"],
                }

            history.append(
                {
                    "agreement_id": row["agreement_id"],
                    "status": row["status"],
                    "start_date": row["start_date"],
                    "end_date": row["end_date"],
                    "cost": row["cost"],
                    "car": {
                        "car_id": row["car_id"],
                        "model": row["model"],
                        "year": row["year"],
                        "image_url": row["image_url"],
                    },
                    "branch": {
                        "branch_id": row["branch_id"],
                        "address": row["address"],
                    },
                    "payment": payment,
                }
            )

        return {"history": history}
