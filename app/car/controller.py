import asyncpg
from fastapi import APIRouter, Depends, Query

from app.car.dto import BranchesResponse, CarsResponse
from app.car.repository import CarRepository
from app.car.service import CarService
from app.db.database import acquire_connection

router = APIRouter(tags=["car"])


def get_car_service() -> CarService:
    return CarService(CarRepository())


@router.get("/branches", response_model=BranchesResponse)
async def list_branches(
    connection: asyncpg.Connection = Depends(acquire_connection),
    service: CarService = Depends(get_car_service),
) -> dict:
    return await service.list_branches(connection)


@router.get("/cars", response_model=CarsResponse)
async def list_cars(
    branch_id: int | None = Query(None),
    connection: asyncpg.Connection = Depends(acquire_connection),
    service: CarService = Depends(get_car_service),
) -> dict:
    return await service.list_cars(connection, branch_id)
