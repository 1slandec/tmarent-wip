import asyncpg


class CarRepository:
    async def list_branches(self, connection: asyncpg.Connection) -> list[asyncpg.Record]:
        return await connection.fetch(
            """
            SELECT
                branch_id,
                address,
                capacity,
                latitude::float8 AS latitude,
                longitude::float8 AS longitude
            FROM branch
            ORDER BY branch_id
            """
        )

    async def get_branch(
        self, connection: asyncpg.Connection, branch_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT branch_id
            FROM branch
            WHERE branch_id = $1
            """,
            branch_id,
        )

    async def list_cars_by_branch(
        self, connection: asyncpg.Connection, branch_id: int
    ) -> list[asyncpg.Record]:
        return await connection.fetch(
            """
            SELECT
                car_id,
                model,
                year,
                branch_id,
                price_per_day::float8 AS price_per_day,
                status::text AS status,
                image_url
            FROM car
            WHERE branch_id = $1
            ORDER BY car_id
            """,
            branch_id,
        )

    async def list_cars(
        self, connection: asyncpg.Connection
    ) -> list[asyncpg.Record]:
        return await connection.fetch(
            """
            SELECT
                car_id,
                model,
                year,
                branch_id,
                price_per_day::float8 AS price_per_day,
                status::text AS status,
                image_url
            FROM car
            ORDER BY car_id
            """
        )
