import asyncpg
from fastapi import APIRouter, Depends

from app.common.dependencies import get_current_client_id
from app.db.database import get_pool
from app.payment.dto import PaymentCreateRequest, PaymentCreateResponse
from app.payment.repository import PaymentRepository
from app.payment.service import PaymentService

router = APIRouter(tags=["payment"])


def get_payment_service() -> PaymentService:
    return PaymentService(PaymentRepository())


@router.post("/payment", response_model=PaymentCreateResponse)
async def create_payment(
    payload: PaymentCreateRequest,
    client_id: int = Depends(get_current_client_id),
    pool: asyncpg.Pool = Depends(get_pool),
    service: PaymentService = Depends(get_payment_service),
) -> dict:
    return await service.create_payment(
        pool,
        client_id,
        payload.agreement_id,
        payload.amount,
        payload.method,
    )
