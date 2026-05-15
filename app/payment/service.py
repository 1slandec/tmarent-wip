from decimal import Decimal

import asyncpg

from app.common.errors import BusinessError
from app.payment.repository import PaymentRepository


class PaymentService:
    def __init__(self, repository: PaymentRepository) -> None:
        self.repository = repository

    async def create_payment(
        self,
        pool: asyncpg.Pool,
        client_id: int,
        agreement_id: int,
        amount: float,
        method: str,
    ) -> dict:
        async with pool.acquire() as connection:
            async with connection.transaction():
                agreement = await self.repository.get_agreement(connection, agreement_id)
                if agreement is None:
                    raise BusinessError("agreement_not_found", "Договор не найден", 404)
                if agreement["client_id"] != client_id:
                    raise BusinessError("user_mismatch", "Договор принадлежит другому клиенту", 403)

                payment = await self.repository.create_pending_payment(
                    connection,
                    agreement_id,
                    Decimal(str(amount)),
                    method,
                )
                paid_payment = await self.repository.mark_payment_paid(
                    connection, payment["payment_id"]
                )
                if paid_payment is None:
                    raise BusinessError(
                        "invalid_state_transition",
                        "Платеж нельзя подтвердить в текущем статусе",
                    )

        return dict(paid_payment)
