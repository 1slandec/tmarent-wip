import asyncpg
from fastapi import APIRouter, Depends

from app.admin.dependencies import require_admin
from app.admin.dto import (
    AdminBranchCreateRequest,
    AdminBranchDeleteResponse,
    AdminBranchResponse,
    AdminBranchUpdateRequest,
    AdminCarCreateRequest,
    AdminCarDeleteResponse,
    AdminCarResponse,
    AdminCarUpdateRequest,
)
from app.admin.repository import AdminRepository
from app.admin.service import AdminService
from app.db.database import get_pool

router = APIRouter(prefix="/admin", tags=["Admin"])


def get_admin_service() -> AdminService:
    return AdminService(AdminRepository())


@router.post("/cars", response_model=AdminCarResponse)
async def create_car(
    payload: AdminCarCreateRequest,
    _employee_id: int = Depends(require_admin),
    pool: asyncpg.Pool = Depends(get_pool),
    service: AdminService = Depends(get_admin_service),
) -> dict:
    return await service.create_car(
        pool,
        payload.model,
        payload.year,
        payload.branch_id,
        payload.price_per_day,
        payload.status,
        payload.image_url,
    )


@router.patch("/cars/{car_id}", response_model=AdminCarResponse)
async def update_car(
    car_id: int,
    payload: AdminCarUpdateRequest,
    _employee_id: int = Depends(require_admin),
    pool: asyncpg.Pool = Depends(get_pool),
    service: AdminService = Depends(get_admin_service),
) -> dict:
    return await service.update_car(
        pool,
        car_id,
        payload.model_dump(exclude_unset=True),
    )


@router.delete("/cars/{car_id}", response_model=AdminCarDeleteResponse)
async def delete_car(
    car_id: int,
    _employee_id: int = Depends(require_admin),
    pool: asyncpg.Pool = Depends(get_pool),
    service: AdminService = Depends(get_admin_service),
) -> dict:
    return await service.delete_car(pool, car_id)


@router.post("/branches", response_model=AdminBranchResponse)
async def create_branch(
    payload: AdminBranchCreateRequest,
    _employee_id: int = Depends(require_admin),
    pool: asyncpg.Pool = Depends(get_pool),
    service: AdminService = Depends(get_admin_service),
) -> dict:
    return await service.create_branch(
        pool,
        payload.address,
        payload.capacity,
        payload.latitude,
        payload.longitude,
    )


@router.patch("/branches/{branch_id}", response_model=AdminBranchResponse)
async def update_branch(
    branch_id: int,
    payload: AdminBranchUpdateRequest,
    _employee_id: int = Depends(require_admin),
    pool: asyncpg.Pool = Depends(get_pool),
    service: AdminService = Depends(get_admin_service),
) -> dict:
    return await service.update_branch(
        pool,
        branch_id,
        payload.model_dump(exclude_unset=True),
    )


@router.delete("/branches/{branch_id}", response_model=AdminBranchDeleteResponse)
async def delete_branch(
    branch_id: int,
    _employee_id: int = Depends(require_admin),
    pool: asyncpg.Pool = Depends(get_pool),
    service: AdminService = Depends(get_admin_service),
) -> dict:
    return await service.delete_branch(pool, branch_id)
