from datetime import datetime

from pydantic import BaseModel, Field


class PaymentCreateRequest(BaseModel):
    agreement_id: int
    amount: float = Field(ge=0)
    method: str


class PaymentCreateResponse(BaseModel):
    payment_id: int
    status: str
    payment_date: datetime
