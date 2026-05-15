import asyncpg

from app.car.repository import CarRepository
from app.common.errors import BusinessError


class CarService:
    def __init__(self, repository: CarRepository) -> None:
        self.repository = repository

    async def list_branches(self, connection: asyncpg.Connection) -> dict:
        branches = await self.repository.list_branches(connection)
        return {"branches": [dict(branch) for branch in branches]}

    async def list_cars(
        self,
        connection: asyncpg.Connection,
        branch_id: int | None,
    ) -> dict:
        if branch_id is None:
            cars = await self.repository.list_cars(connection)
            return {"cars": [dict(car) for car in cars]}

        branch = await self.repository.get_branch(connection, branch_id)
        if branch is None:
            raise BusinessError("branch_not_found", "Филиал не найден", 404)

        cars = await self.repository.list_cars_by_branch(connection, branch_id)
        return {"cars": [dict(car) for car in cars]}
