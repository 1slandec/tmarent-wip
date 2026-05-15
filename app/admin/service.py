from typing import Any

import asyncpg

from app.admin.repository import AdminRepository
from app.common.errors import BusinessError


ALLOWED_CAR_STATUSES = {"available", "reserved", "rented", "maintenance"}


class AdminService:
    def __init__(self, repository: AdminRepository) -> None:
        self.repository = repository

    async def create_car(
        self,
        pool: asyncpg.Pool,
        model: str,
        year: int,
        branch_id: int,
        price_per_day: float,
        status: str,
        image_url: str | None,
    ) -> dict:
        model = self._validate_required_text(
            model,
            "INVALID_CAR_DATA",
            "Invalid car data",
        )
        self._validate_car_year(year)
        self._validate_price(price_per_day)
        self._validate_car_status(status)

        async with pool.acquire() as connection:
            async with connection.transaction():
                await self._ensure_branch_exists(connection, branch_id)
                car = await self.repository.create_car(
                    connection,
                    model,
                    year,
                    branch_id,
                    price_per_day,
                    status,
                    image_url,
                )

        return dict(car)

    async def update_car(
        self,
        pool: asyncpg.Pool,
        car_id: int,
        fields: dict[str, Any],
    ) -> dict:
        self._validate_car_update_fields(fields)

        async with pool.acquire() as connection:
            async with connection.transaction():
                car = await self.repository.get_car(connection, car_id)
                if car is None:
                    raise BusinessError("CAR_NOT_FOUND", "Автомобиль не найден", 404)

                if "branch_id" in fields:
                    await self._ensure_branch_exists(connection, fields["branch_id"])

                updated_car = await self.repository.update_car(
                    connection,
                    car_id,
                    fields,
                )

        return dict(updated_car)

    async def delete_car(self, pool: asyncpg.Pool, car_id: int) -> dict:
        async with pool.acquire() as connection:
            async with connection.transaction():
                car = await self.repository.get_car(connection, car_id)
                if car is None:
                    raise BusinessError("CAR_NOT_FOUND", "Автомобиль не найден", 404)

                has_active_rentals = await self.repository.car_has_active_rentals(
                    connection,
                    car_id,
                )
                if has_active_rentals:
                    raise BusinessError(
                        "CAR_HAS_ACTIVE_RENTALS",
                        "Нельзя удалить автомобиль с активными бронированиями или арендой",
                    )

                try:
                    deleted_car = await self.repository.delete_car(connection, car_id)
                except asyncpg.ForeignKeyViolationError as exc:
                    raise BusinessError(
                        "CAR_HAS_ACTIVE_RENTALS",
                        "Нельзя удалить автомобиль с активными бронированиями или арендой",
                    ) from exc

        return {
            "car_id": deleted_car["car_id"],
            "message": "Автомобиль удалён",
        }

    async def create_branch(
        self,
        pool: asyncpg.Pool,
        address: str,
        capacity: int,
        latitude: float | None,
        longitude: float | None,
    ) -> dict:
        address = self._validate_required_text(
            address,
            "INVALID_BRANCH_DATA",
            "Invalid branch data",
        )
        self._validate_capacity(capacity)

        async with pool.acquire() as connection:
            async with connection.transaction():
                branch = await self.repository.create_branch(
                    connection,
                    address,
                    capacity,
                    latitude,
                    longitude,
                )

        return dict(branch)

    async def update_branch(
        self,
        pool: asyncpg.Pool,
        branch_id: int,
        fields: dict[str, Any],
    ) -> dict:
        self._validate_branch_update_fields(fields)

        async with pool.acquire() as connection:
            async with connection.transaction():
                branch = await self.repository.get_branch(connection, branch_id)
                if branch is None:
                    raise BusinessError("BRANCH_NOT_FOUND", "Филиал не найден", 404)

                updated_branch = await self.repository.update_branch(
                    connection,
                    branch_id,
                    fields,
                )

        return dict(updated_branch)

    async def delete_branch(self, pool: asyncpg.Pool, branch_id: int) -> dict:
        async with pool.acquire() as connection:
            async with connection.transaction():
                branch = await self.repository.get_branch(connection, branch_id)
                if branch is None:
                    raise BusinessError("BRANCH_NOT_FOUND", "Филиал не найден", 404)

                has_cars = await self.repository.branch_has_cars(connection, branch_id)
                if has_cars:
                    raise BusinessError(
                        "BRANCH_HAS_CARS",
                        "Нельзя удалить филиал, пока в нём есть автомобили",
                    )

                try:
                    deleted_branch = await self.repository.delete_branch(
                        connection,
                        branch_id,
                    )
                except asyncpg.ForeignKeyViolationError as exc:
                    raise BusinessError(
                        "BRANCH_HAS_CARS",
                        "Нельзя удалить филиал, пока в нём есть автомобили",
                    ) from exc

        return {
            "branch_id": deleted_branch["branch_id"],
            "message": "Филиал удалён",
        }

    async def _ensure_branch_exists(
        self,
        connection: asyncpg.Connection,
        branch_id: int,
    ) -> None:
        branch_exists = await self.repository.branch_exists(connection, branch_id)
        if not branch_exists:
            raise BusinessError("BRANCH_NOT_FOUND", "Филиал не найден", 404)

    def _validate_car_update_fields(self, fields: dict[str, Any]) -> None:
        if not fields:
            raise BusinessError("INVALID_CAR_DATA", "Invalid car data")
        if "model" in fields:
            fields["model"] = self._validate_required_text(
                fields["model"],
                "INVALID_CAR_DATA",
                "Invalid car data",
            )
        if "year" in fields:
            self._validate_car_year(fields["year"])
        if "branch_id" in fields and fields["branch_id"] is None:
            raise BusinessError("INVALID_CAR_DATA", "Invalid car data")
        if "price_per_day" in fields:
            self._validate_price(fields["price_per_day"])
        if "status" in fields:
            self._validate_car_status(fields["status"])

    def _validate_branch_update_fields(self, fields: dict[str, Any]) -> None:
        if not fields:
            raise BusinessError("INVALID_BRANCH_DATA", "Invalid branch data")
        if "address" in fields:
            fields["address"] = self._validate_required_text(
                fields["address"],
                "INVALID_BRANCH_DATA",
                "Invalid branch data",
            )
        if "capacity" in fields:
            self._validate_capacity(fields["capacity"])

    def _validate_required_text(
        self,
        value: str | None,
        error_code: str,
        message: str,
    ) -> str:
        if value is None or not value.strip():
            raise BusinessError(error_code, message)
        return value.strip()

    def _validate_car_year(self, year: int | None) -> None:
        if year is None or year < 1990:
            raise BusinessError("INVALID_CAR_DATA", "Invalid car data")

    def _validate_price(self, price_per_day: float | None) -> None:
        if price_per_day is None or price_per_day < 0:
            raise BusinessError("INVALID_CAR_DATA", "Invalid car data")

    def _validate_car_status(self, status: str | None) -> None:
        if status not in ALLOWED_CAR_STATUSES:
            raise BusinessError("INVALID_CAR_DATA", "Invalid car data")

    def _validate_capacity(self, capacity: int | None) -> None:
        if capacity is None or capacity < 0:
            raise BusinessError("INVALID_BRANCH_DATA", "Invalid branch data")
