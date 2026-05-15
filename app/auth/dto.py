from pydantic import BaseModel


class TelegramAuthRequest(BaseModel):
    init_data: str


class TelegramAuthClientResponse(BaseModel):
    client_id: int
    telegram_id: int
    username: str | None
    is_new_user: bool


class TelegramAuthResponse(BaseModel):
    access_token: str
    token_type: str
    client: TelegramAuthClientResponse
    status: str


class UserMeResponse(BaseModel):
    client_id: int
    full_name: str | None
    username: str | None
    telegram_id: int
    age: int | None
    license_no: str | None
    is_admin: bool


class UserProfileUpdateRequest(BaseModel):
    full_name: str
    age: int
    license_no: str


class UserProfileUpdateResponse(BaseModel):
    client_id: int
    telegram_id: int
    username: str | None
    full_name: str
    age: int
    license_no: str
    profile_completed: bool
