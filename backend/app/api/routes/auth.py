from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.security import create_access_token
from backend.app.db.session import get_db_session
from backend.app.schemas.auth import LoginRequest, SmsCodeRequest, SmsCodeResponse, SmsLoginRequest, TokenResponse
from backend.app.schemas.user import UserCreate
from backend.app.services.sms_auth_service import issue_sms_code, login_with_sms_code
from backend.app.services.user_service import (
    authenticate_user,
    create_user,
    get_existing_user_for_create,
)


router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user_in: UserCreate,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> TokenResponse:
    existing_user = await get_existing_user_for_create(session, user_in)
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="User already exists",
        )

    user = await create_user(session, user_in)
    return TokenResponse(access_token=create_access_token(str(user.id)), user=user)


@router.post("/login", response_model=TokenResponse)
async def login(
    login_in: LoginRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> TokenResponse:
    user = await authenticate_user(session, login_in.identifier, login_in.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(access_token=create_access_token(str(user.id)), user=user)


@router.post("/sms/send-code", response_model=SmsCodeResponse)
async def send_sms_code(
    code_in: SmsCodeRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> SmsCodeResponse:
    expires_in_seconds = await issue_sms_code(session, code_in.phone)
    return SmsCodeResponse(message="验证码已发送", expires_in_seconds=expires_in_seconds)


@router.post("/sms/login", response_model=TokenResponse)
async def sms_login(
    login_in: SmsLoginRequest,
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> TokenResponse:
    user = await login_with_sms_code(session, login_in.phone, login_in.code)
    return TokenResponse(access_token=create_access_token(str(user.id)), user=user)


@router.post("/token", response_model=TokenResponse, include_in_schema=False)
async def token_login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> TokenResponse:
    user = await authenticate_user(session, form_data.username, form_data.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return TokenResponse(access_token=create_access_token(str(user.id)), user=user)
