from typing import Any

import asyncpg


class AdminRepository:
    async def get_employee_by_client_id(
        self, connection: asyncpg.Connection, client_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT employee_id
            FROM employee
            WHERE client_id = $1
            """,
            client_id,
        )

    async def branch_exists(
        self, connection: asyncpg.Connection, branch_id: int
    ) -> bool:
        return await connection.fetchval(
            "SELECT EXISTS (SELECT 1 FROM branch WHERE branch_id = $1)",
            branch_id,
        )

    async def get_branch(
        self, connection: asyncpg.Connection, branch_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT
                branch_id,
                address,
                capacity,
                latitude::float8 AS latitude,
                longitude::float8 AS longitude
            FROM branch
            WHERE branch_id = $1
            """,
            branch_id,
        )

    async def create_branch(
        self,
        connection: asyncpg.Connection,
        address: str,
        capacity: int,
        latitude: float | None,
        longitude: float | None,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            INSERT INTO branch (address, capacity, latitude, longitude, created_at)
            VALUES ($1, $2, $3, $4, NOW())
            RETURNING
                branch_id,
                address,
                capacity,
                latitude::float8 AS latitude,
                longitude::float8 AS longitude
            """,
            address,
            capacity,
            latitude,
            longitude,
        )

    async def update_branch(
        self,
        connection: asyncpg.Connection,
        branch_id: int,
        fields: dict[str, Any],
    ) -> asyncpg.Record | None:
        assignments = []
        values: list[Any] = [branch_id]
        columns = {
            "address": "address",
            "capacity": "capacity",
            "latitude": "latitude",
            "longitude": "longitude",
        }
        for field, value in fields.items():
            values.append(value)
            assignments.append(f"{columns[field]} = ${len(values)}")

        return await connection.fetchrow(
            f"""
            UPDATE branch
            SET {", ".join(assignments)}
            WHERE branch_id = $1
            RETURNING
                branch_id,
                address,
                capacity,
                latitude::float8 AS latitude,
                longitude::float8 AS longitude
            """,
            *values,
        )

    async def branch_has_cars(
        self, connection: asyncpg.Connection, branch_id: int
    ) -> bool:
        return await connection.fetchval(
            "SELECT EXISTS (SELECT 1 FROM car WHERE branch_id = $1)",
            branch_id,
        )

    async def delete_branch(
        self, connection: asyncpg.Connection, branch_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            DELETE FROM branch
            WHERE branch_id = $1
            RETURNING branch_id
            """,
            branch_id,
        )

    async def get_car(
        self, connection: asyncpg.Connection, car_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
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
            WHERE car_id = $1
            """,
            car_id,
        )

    async def create_car(
        self,
        connection: asyncpg.Connection,
        model: str,
        year: int,
        branch_id: int,
        price_per_day: float,
        status: str,
        image_url: str | None,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            INSERT INTO car (
                model,
                year,
                branch_id,
                price_per_day,
                status,
                image_url,
                created_at,
                updated_at
            )
            VALUES ($1, $2, $3, $4, $5::car_status, $6, NOW(), NOW())
            RETURNING
                car_id,
                model,
                year,
                branch_id,
                price_per_day::float8 AS price_per_day,
                status::text AS status,
                image_url
            """,
            model,
            year,
            branch_id,
            price_per_day,
            status,
            image_url,
        )

    async def update_car(
        self,
        connection: asyncpg.Connection,
        car_id: int,
        fields: dict[str, Any],
    ) -> asyncpg.Record | None:
        assignments = []
        values: list[Any] = [car_id]
        columns = {
            "model": "model",
            "year": "year",
            "branch_id": "branch_id",
            "price_per_day": "price_per_day",
            "status": "status",
            "image_url": "image_url",
        }
        for field, value in fields.items():
            values.append(value)
            placeholder = f"${len(values)}"
            if field == "status":
                placeholder = f"{placeholder}::car_status"
            assignments.append(f"{columns[field]} = {placeholder}")

        return await connection.fetchrow(
            f"""
            UPDATE car
            SET {", ".join(assignments)}, updated_at = NOW()
            WHERE car_id = $1
            RETURNING
                car_id,
                model,
                year,
                branch_id,
                price_per_day::float8 AS price_per_day,
                status::text AS status,
                image_url
            """,
            *values,
        )

    async def car_has_active_rentals(
        self, connection: asyncpg.Connection, car_id: int
    ) -> bool:
        return await connection.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM booking
                WHERE car_id = $1
                  AND status IN ('pending'::booking_status, 'confirmed'::booking_status)
            )
            OR EXISTS (
                SELECT 1
                FROM agreement
                WHERE car_id = $1
                  AND status = 'active'::agreement_status
            )
            """,
            car_id,
        )

    async def delete_car(
        self, connection: asyncpg.Connection, car_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            DELETE FROM car
            WHERE car_id = $1
            RETURNING car_id
            """,
            car_id,
        )
