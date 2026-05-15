from datetime import date

from pydantic import BaseModel


class AgreementCreateRequest(BaseModel):
    booking_id: int
    employee_id: int
    insurance: str
    terms: str


class AgreementCreateResponse(BaseModel):
    agreement_id: int
    status: str
    car_id: int
    client_id: int
    cost: float


class AgreementCompleteRequest(BaseModel):
    agreement_id: int


class AgreementCompleteResponse(BaseModel):
    agreement_id: int
    status: str
    message: str


class AgreementHistoryCarResponse(BaseModel):
    car_id: int
    model: str
    year: int
    image_url: str | None


class AgreementHistoryBranchResponse(BaseModel):
    branch_id: int
    address: str


class AgreementHistoryPaymentResponse(BaseModel):
    payment_id: int
    status: str
    amount: float
    method: str


class AgreementHistoryItemResponse(BaseModel):
    agreement_id: int
    status: str
    start_date: date
    end_date: date
    cost: float
    car: AgreementHistoryCarResponse
    branch: AgreementHistoryBranchResponse
    payment: AgreementHistoryPaymentResponse | None = None


class AgreementHistoryResponse(BaseModel):
    history: list[AgreementHistoryItemResponse]
