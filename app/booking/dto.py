from datetime import date, datetime

from pydantic import BaseModel


class AvailabilityCheckRequest(BaseModel):
    car_id: int
    start_date: date
    end_date: date


class AvailabilityCheckResponse(BaseModel):
    is_available: bool
    conflicting_bookings: list[int] | None = None
    message: str


class BookingCreateRequest(BaseModel):
    car_id: int
    start_date: date
    end_date: date


class BookingCreateResponse(BaseModel):
    booking_id: int
    status: str
    reserved_until: datetime
    total_price: float


class BookingCancelRequest(BaseModel):
    booking_id: int


class BookingCancelResponse(BaseModel):
    booking_id: int
    status: str
    message: str


class BookingConfirmRequest(BaseModel):
    booking_id: int
    method: str


class BookingConfirmPaymentResponse(BaseModel):
    payment_id: int
    status: str
    amount: float
    method: str


class BookingConfirmAgreementResponse(BaseModel):
    agreement_id: int
    status: str


class BookingConfirmResponse(BaseModel):
    booking_id: int
    booking_status: str
    payment: BookingConfirmPaymentResponse
    agreement: BookingConfirmAgreementResponse
    message: str


class ActiveBookingCarResponse(BaseModel):
    car_id: int
    model: str
    year: int
    price_per_day: float
    status: str
    image_url: str | None


class ActiveBookingBranchResponse(BaseModel):
    branch_id: int
    address: str


class ActiveBookingResponse(BaseModel):
    booking_id: int
    status: str
    start_date: date
    end_date: date
    reserved_until: datetime
    total_price: float
    car: ActiveBookingCarResponse
    branch: ActiveBookingBranchResponse


class NoActiveBookingResponse(BaseModel):
    booking: None
    message: str
