import asyncpg


class AgreementRepository:
    async def get_client(
        self, connection: asyncpg.Connection, client_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT client_id, full_name, age, license_no, profile_completed
            FROM client
            WHERE client_id = $1
            """,
            client_id,
        )

    async def get_booking_for_update(
        self, connection: asyncpg.Connection, booking_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT
                booking_id,
                client_id,
                car_id,
                start_date,
                end_date,
                status::text AS status,
                reserved_until,
                total_price
            FROM booking
            WHERE booking_id = $1
            FOR UPDATE
            """,
            booking_id,
        )

    async def employee_exists(
        self, connection: asyncpg.Connection, employee_id: int
    ) -> bool:
        return await connection.fetchval(
            "SELECT EXISTS (SELECT 1 FROM employee WHERE employee_id = $1)",
            employee_id,
        )

    async def agreement_exists_for_booking(
        self, connection: asyncpg.Connection, booking_id: int
    ) -> bool:
        return await connection.fetchval(
            "SELECT EXISTS (SELECT 1 FROM agreement WHERE booking_id = $1)",
            booking_id,
        )

    async def active_agreement_exists_for_car(
        self, connection: asyncpg.Connection, car_id: int
    ) -> bool:
        return await connection.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM agreement
                WHERE car_id = $1
                  AND status = 'active'::agreement_status
            )
            """,
            car_id,
        )

    async def create_agreement(
        self,
        connection: asyncpg.Connection,
        client_id: int,
        car_id: int,
        employee_id: int,
        booking_id: int,
        cost,
        insurance: str,
        terms: str,
        start_date,
        end_date,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            INSERT INTO agreement (
                client_id,
                car_id,
                employee_id,
                booking_id,
                cost,
                insurance,
                terms,
                status,
                start_date,
                end_date,
                created_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                $5,
                $6,
                $7,
                'active'::agreement_status,
                $8,
                $9,
                NOW()
            )
            RETURNING
                agreement_id,
                status::text AS status,
                car_id,
                client_id,
                cost::float8 AS cost
            """,
            client_id,
            car_id,
            employee_id,
            booking_id,
            cost,
            insurance,
            terms,
            start_date,
            end_date,
        )

    async def create_mock_agreement(
        self,
        connection: asyncpg.Connection,
        client_id: int,
        car_id: int,
        booking_id: int,
        cost,
        start_date,
        end_date,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            INSERT INTO agreement (
                client_id,
                car_id,
                booking_id,
                cost,
                status,
                start_date,
                end_date,
                created_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                'active'::agreement_status,
                $5,
                $6,
                NOW()
            )
            RETURNING agreement_id, status::text AS status
            """,
            client_id,
            car_id,
            booking_id,
            cost,
            start_date,
            end_date,
        )

    async def update_booking_status(
        self, connection: asyncpg.Connection, booking_id: int, status: str
    ) -> None:
        await connection.execute(
            """
            UPDATE booking
            SET status = $2::booking_status, updated_at = NOW()
            WHERE booking_id = $1
            """,
            booking_id,
            status,
        )

    async def update_car_status(
        self, connection: asyncpg.Connection, car_id: int, status: str
    ) -> None:
        await connection.execute(
            """
            UPDATE car
            SET status = $2::car_status, updated_at = NOW()
            WHERE car_id = $1
            """,
            car_id,
            status,
        )

    async def get_agreement_for_update(
        self, connection: asyncpg.Connection, agreement_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT agreement_id, client_id, car_id, status::text AS status
            FROM agreement
            WHERE agreement_id = $1
            FOR UPDATE
            """,
            agreement_id,
        )

    async def complete_agreement(
        self, connection: asyncpg.Connection, agreement_id: int
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            UPDATE agreement
            SET status = 'completed'::agreement_status
            WHERE agreement_id = $1
            RETURNING agreement_id, status::text AS status
            """,
            agreement_id,
        )

    async def list_history(
        self, connection: asyncpg.Connection, client_id: int
    ) -> list[asyncpg.Record]:
        return await connection.fetch(
            """
            SELECT
                a.agreement_id,
                a.status::text AS status,
                a.start_date,
                a.end_date,
                a.cost::float8 AS cost,
                c.car_id,
                c.model,
                c.year,
                c.image_url,
                br.branch_id,
                br.address,
                p.payment_id,
                p.status::text AS payment_status,
                p.amount::float8 AS payment_amount,
                p.method AS payment_method
            FROM agreement a
            JOIN car c ON c.car_id = a.car_id
            JOIN branch br ON br.branch_id = c.branch_id
            LEFT JOIN LATERAL (
                SELECT payment_id, status, amount, method
                FROM payment
                WHERE agreement_id = a.agreement_id
                ORDER BY created_at DESC
                LIMIT 1
            ) p ON TRUE
            WHERE a.client_id = $1
            ORDER BY a.created_at DESC
            """,
            client_id,
        )
