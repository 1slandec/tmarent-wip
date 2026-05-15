import asyncpg


class AuthRepository:
    async def get_client_by_telegram_id(
        self, connection: asyncpg.Connection, telegram_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT
                client_id,
                full_name,
                age,
                license_no,
                telegram_id,
                username,
                profile_completed
            FROM client
            WHERE telegram_id = $1
            """,
            telegram_id,
        )

    async def get_client_by_id(
        self, connection: asyncpg.Connection, client_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT
                client_id,
                full_name,
                age,
                license_no,
                telegram_id,
                username,
                profile_completed
            FROM client
            WHERE client_id = $1
            """,
            client_id,
        )

    async def client_has_employee(
        self, connection: asyncpg.Connection, client_id: int
    ) -> bool:
        return await connection.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM employee
                WHERE client_id = $1
            )
            """,
            client_id,
        )

    async def create_client(
        self,
        connection: asyncpg.Connection,
        telegram_id: int,
        username: str | None,
        full_name: str | None,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            INSERT INTO client (
                full_name,
                telegram_id,
                username,
                profile_completed,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                $2,
                $3,
                FALSE,
                NOW(),
                NOW()
            )
            RETURNING
                client_id,
                full_name,
                age,
                license_no,
                telegram_id,
                username,
                profile_completed
            """,
            full_name,
            telegram_id,
            username,
        )

    async def update_client_from_telegram(
        self,
        connection: asyncpg.Connection,
        telegram_id: int,
        username: str | None,
        full_name: str | None,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            UPDATE client
            SET
                username = $2,
                full_name = COALESCE($3, full_name),
                profile_completed = (
                    COALESCE($3, full_name) IS NOT NULL
                    AND age IS NOT NULL
                    AND license_no IS NOT NULL
                ),
                updated_at = NOW()
            WHERE telegram_id = $1
            RETURNING
                client_id,
                full_name,
                age,
                license_no,
                telegram_id,
                username,
                profile_completed
            """,
            telegram_id,
            username,
            full_name,
        )

    async def update_client_profile(
        self,
        connection: asyncpg.Connection,
        client_id: int,
        full_name: str,
        age: int,
        license_no: str,
        profile_completed: bool,
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            UPDATE client
            SET
                full_name = $2,
                age = $3,
                license_no = $4,
                profile_completed = $5,
                updated_at = NOW()
            WHERE client_id = $1
            RETURNING
                client_id,
                telegram_id,
                username,
                full_name,
                age,
                license_no,
                profile_completed
            """,
            client_id,
            full_name,
            age,
            license_no,
            profile_completed,
        )
