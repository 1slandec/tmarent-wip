from pydantic import BaseModel


class AdminCarCreateRequest(BaseModel):
    model: str
    year: int
    branch_id: int
    price_per_day: float
    status: str
    image_url: str | None = None


class AdminCarUpdateRequest(BaseModel):
    model: str | None = None
    year: int | None = None
    branch_id: int | None = None
    price_per_day: float | None = None
    status: str | None = None
    image_url: str | None = None


class AdminCarResponse(BaseModel):
    car_id: int
    model: str
    year: int
    branch_id: int
    price_per_day: float
    status: str
    image_url: str | None


class AdminCarDeleteResponse(BaseModel):
    car_id: int
    message: str


class AdminBranchCreateRequest(BaseModel):
    address: str
    capacity: int
    latitude: float | None = None
    longitude: float | None = None


class AdminBranchUpdateRequest(BaseModel):
    address: str | None = None
    capacity: int | None = None
    latitude: float | None = None
    longitude: float | None = None


class AdminBranchResponse(BaseModel):
    branch_id: int
    address: str
    capacity: int
    latitude: float | None
    longitude: float | None


class AdminBranchDeleteResponse(BaseModel):
    branch_id: int
    message: str
