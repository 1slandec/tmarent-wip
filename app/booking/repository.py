from datetime import date, datetime
from decimal import Decimal

import asyncpg


class BookingRepository:
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

    async def get_car(
        self, connection: asyncpg.Connection, car_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT car_id, price_per_day, status::text AS status
            FROM car
            WHERE car_id = $1
            """,
            car_id,
        )

    async def get_car_for_update(
        self, connection: asyncpg.Connection, car_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT car_id, price_per_day, status::text AS status
            FROM car
            WHERE car_id = $1
            FOR UPDATE
            """,
            car_id,
        )

    async def find_conflicting_bookings(
        self,
        connection: asyncpg.Connection,
        car_id: int,
        start_date: date,
        end_date: date,
    ) -> list[asyncpg.Record]:
        return await connection.fetch(
            """
            SELECT booking_id
            FROM booking
            WHERE car_id = $1
              AND status IN ('pending'::booking_status, 'confirmed'::booking_status)
              AND start_date <= $3
              AND end_date >= $2
            ORDER BY booking_id
            """,
            car_id,
            start_date,
            end_date,
        )

    async def has_active_booking(
        self, connection: asyncpg.Connection, client_id: int
    ) -> bool:
        return await connection.fetchval(
            """
            SELECT EXISTS (
                SELECT 1
                FROM booking
                WHERE client_id = $1
                  AND status IN ('pending'::booking_status, 'confirmed'::booking_status)
            )
            """,
            client_id,
        )

    async def create_booking(
        self,
        connection: asyncpg.Connection,
        client_id: int,
        car_id: int,
        start_date: date,
        end_date: date,
        reserved_until: datetime,
        total_price: Decimal,
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            INSERT INTO booking (
                client_id,
                car_id,
                start_date,
                end_date,
                status,
                reserved_until,
                total_price,
                created_at,
                updated_at
            )
            VALUES (
                $1,
                $2,
                $3,
                $4,
                'pending'::booking_status,
                $5,
                $6,
                NOW(),
                NOW()
            )
            RETURNING
                booking_id,
                status::text AS status,
                reserved_until,
                total_price::float8 AS total_price
            """,
            client_id,
            car_id,
            start_date,
            end_date,
            reserved_until,
            total_price,
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

    async def get_booking_for_update(
        self, connection: asyncpg.Connection, booking_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT
                booking_id,
                client_id,
                car_id,
                status::text AS status,
                reserved_until
            FROM booking
            WHERE booking_id = $1
            FOR UPDATE
            """,
            booking_id,
        )

    async def get_booking_for_confirm(
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

    async def cancel_booking(
        self, connection: asyncpg.Connection, booking_id: int
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            UPDATE booking
            SET status = 'cancelled'::booking_status, updated_at = NOW()
            WHERE booking_id = $1
            RETURNING booking_id, status::text AS status
            """,
            booking_id,
        )

    async def update_booking_status(
        self, connection: asyncpg.Connection, booking_id: int, status: str
    ) -> asyncpg.Record:
        return await connection.fetchrow(
            """
            UPDATE booking
            SET status = $2::booking_status, updated_at = NOW()
            WHERE booking_id = $1
            RETURNING booking_id, status::text AS status
            """,
            booking_id,
            status,
        )

    async def release_car_if_possible(
        self, connection: asyncpg.Connection, car_id: int
    ) -> None:
        await connection.execute(
            """
            UPDATE car
            SET status = 'available'::car_status, updated_at = NOW()
            WHERE car_id = $1
              AND status = 'reserved'::car_status
              AND NOT EXISTS (
                  SELECT 1
                  FROM booking
                  WHERE car_id = $1
                    AND status IN ('pending'::booking_status, 'confirmed'::booking_status)
              )
            """,
            car_id,
        )

    async def get_active_booking(
        self, connection: asyncpg.Connection, client_id: int
    ) -> asyncpg.Record | None:
        return await connection.fetchrow(
            """
            SELECT
                b.booking_id,
                b.status::text AS status,
                b.start_date,
                b.end_date,
                b.reserved_until,
                b.total_price::float8 AS total_price,
                c.car_id,
                c.model,
                c.year,
                c.price_per_day::float8 AS price_per_day,
                c.status::text AS car_status,
                c.image_url,
                br.branch_id,
                br.address
            FROM booking b
            JOIN car c ON c.car_id = b.car_id
            JOIN branch br ON br.branch_id = c.branch_id
            WHERE b.client_id = $1
              AND b.status IN ('pending'::booking_status, 'confirmed'::booking_status)
            ORDER BY b.created_at DESC
            LIMIT 1
            """,
            client_id,
        )

    async def expire_pending_bookings(
        self, connection: asyncpg.Connection
    ) -> list[asyncpg.Record]:
        return await connection.fetch(
            """
            UPDATE booking
            SET status = 'expired'::booking_status, updated_at = NOW()
            WHERE reserved_until < NOW()
              AND status = 'pending'::booking_status
            RETURNING booking_id, car_id
            """
        )
