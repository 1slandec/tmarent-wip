from pydantic import BaseModel


class BranchResponse(BaseModel):
    branch_id: int
    address: str
    capacity: int
    latitude: float | None
    longitude: float | None


class BranchesResponse(BaseModel):
    branches: list[BranchResponse]


class CarResponse(BaseModel):
    car_id: int
    model: str
    year: int
    branch_id: int | None
    price_per_day: float
    status: str
    image_url: str | None


class CarsResponse(BaseModel):
    cars: list[CarResponse]
