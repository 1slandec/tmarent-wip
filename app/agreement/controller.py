import asyncpg
from fastapi import APIRouter, Depends

from app.agreement.dto import (
    AgreementCompleteRequest,
    AgreementCompleteResponse,
    AgreementCreateRequest,
    AgreementCreateResponse,
    AgreementHistoryResponse,
)
from app.agreement.repository import AgreementRepository
from app.agreement.service import AgreementService
from app.common.dependencies import get_current_client_id
from app.db.database import acquire_connection, get_pool

router = APIRouter(tags=["agreement"])


def get_agreement_service() -> AgreementService:
    return AgreementService(AgreementRepository())


@router.post("/agreement", response_model=AgreementCreateResponse)
async def create_agreement(
    payload: AgreementCreateRequest,
    client_id: int = Depends(get_current_client_id),
    pool: asyncpg.Pool = Depends(get_pool),
    service: AgreementService = Depends(get_agreement_service),
) -> dict:
    return await service.create_agreement(
        pool,
        client_id,
        payload.booking_id,
        payload.employee_id,
        payload.insurance,
        payload.terms,
    )


@router.post("/agreement/complete", response_model=AgreementCompleteResponse)
async def complete_agreement(
    payload: AgreementCompleteRequest,
    client_id: int = Depends(get_current_client_id),
    pool: asyncpg.Pool = Depends(get_pool),
    service: AgreementService = Depends(get_agreement_service),
) -> dict:
    return await service.complete_agreement(pool, client_id, payload.agreement_id)


@router.get("/agreement/history", response_model=AgreementHistoryResponse)
async def get_agreement_history(
    client_id: int = Depends(get_current_client_id),
    connection: asyncpg.Connection = Depends(acquire_connection),
    service: AgreementService = Depends(get_agreement_service),
) -> dict:
    return await service.get_history(connection, client_id)
