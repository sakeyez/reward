from pydantic import BaseModel, Field

from backend.app.schemas.user import UserRead


class LoginRequest(BaseModel):
    identifier: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=128)


class SmsCodeRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=32)


class SmsCodeResponse(BaseModel):
    message: str
    expires_in_seconds: int


class SmsLoginRequest(BaseModel):
    phone: str = Field(min_length=11, max_length=32)
    code: str = Field(min_length=4, max_length=8)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserRead
