import asyncpg


class PaymentRepository:
    async def get_agreement(
        self, connection: asyncpg.Connection, agreement_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT agreement_id, client_id
            FROM agreement
            WHERE agreement_id = $1
            """,
            agreement_id,
        )

    async def create_pending_payment(
        self,
        connection: asyncpg.Connection,
        agreement_id: int,
        amount,
        method: str,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            INSERT INTO payment (
                agreement_id,
                amount,
                method,
                status,
                created_at
            )
            VALUES ($1, $2, $3, 'pending'::payment_status, NOW())
            RETURNING payment_id, status::text AS status
            """,
            agreement_id,
            amount,
            method,
        )

    async def mark_payment_paid(
        self, connection: asyncpg.Connection, payment_id: int
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            UPDATE payment
            SET status = 'paid'::payment_status, payment_date = NOW()
            WHERE payment_id = $1
              AND status = 'pending'::payment_status
            RETURNING payment_id, status::text AS status, payment_date
            """,
            payment_id,
        )

    async def create_paid_payment(
        self,
        connection: asyncpg.Connection,
        agreement_id: int,
        amount,
        method: str,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            INSERT INTO payment (
                agreement_id,
                amount,
                method,
                status,
                created_at,
                payment_date
            )
            VALUES ($1, $2, $3, 'paid'::payment_status, NOW(), NOW())
            RETURNING
                payment_id,
                status::text AS status,
                amount::float8 AS amount,
                method
            """,
            agreement_id,
            amount,
            method,
        )
