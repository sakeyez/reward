import logging
import re
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import get_settings
from backend.app.core.security import hash_password, verify_password
from backend.app.models.sms import SmsVerificationCode
from backend.app.models.user import User, UserStatus
from backend.app.schemas.user import UserCreate
from backend.app.services.user_service import create_user


logger = logging.getLogger(__name__)
PHONE_RE = re.compile(r"^1[3-9]\d{9}$")


def normalize_phone(phone: str) -> str:
    normalized = re.sub(r"\D", "", phone)
    if not PHONE_RE.fullmatch(normalized):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="请输入有效的中国大陆手机号",
        )
    return normalized


async def issue_sms_code(session: AsyncSession, phone: str, purpose: str = "login") -> int:
    settings = get_settings()
    normalized_phone = normalize_phone(phone)
    now = datetime.now(timezone.utc)

    result = await session.execute(
        select(SmsVerificationCode)
        .where(
            SmsVerificationCode.phone == normalized_phone,
            SmsVerificationCode.purpose == purpose,
        )
        .order_by(desc(SmsVerificationCode.created_at))
        .limit(1),
    )
    latest = result.scalar_one_or_none()
    if latest and latest.created_at:
        created_at = latest.created_at
        if created_at.tzinfo is None:
            created_at = created_at.replace(tzinfo=timezone.utc)
        elapsed = (now - created_at).total_seconds()
        if elapsed < settings.sms_code_send_interval_seconds:
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"验证码发送太频繁，请 {int(settings.sms_code_send_interval_seconds - elapsed)} 秒后再试",
            )

    code = f"{secrets.randbelow(1_000_000):06d}"
    verification = SmsVerificationCode(
        phone=normalized_phone,
        purpose=purpose,
        code_hash=hash_password(code),
        expires_at=now + timedelta(minutes=settings.sms_code_ttl_minutes),
    )
    session.add(verification)
    await session.commit()

    logger.warning("SMS verification code for %s is %s", normalized_phone, code)
    return settings.sms_code_ttl_minutes * 60


async def login_with_sms_code(session: AsyncSession, phone: str, code: str) -> User:
    settings = get_settings()
    normalized_phone = normalize_phone(phone)
    now = datetime.now(timezone.utc)

    result = await session.execute(
        select(SmsVerificationCode)
        .where(
            SmsVerificationCode.phone == normalized_phone,
            SmsVerificationCode.purpose == "login",
            SmsVerificationCode.consumed.is_(False),
        )
        .order_by(desc(SmsVerificationCode.created_at))
        .limit(1),
    )
    verification = result.scalar_one_or_none()
    if not verification:
        raise_invalid_code()

    expires_at = verification.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < now or not verify_password(code, verification.code_hash):
        raise_invalid_code()

    user = await get_user_by_phone(session, normalized_phone)
    if user and user.status != UserStatus.active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="账号已被禁用")
    if user is None:
        if not settings.sms_login_auto_register:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="手机号未注册")
        user = await create_user(
            session,
            UserCreate(
                phone=normalized_phone,
                password=secrets.token_urlsafe(24),
                display_name=f"手机用户{normalized_phone[-4:]}",
            ),
        )

    verification.consumed = True
    verification.consumed_at = now
    verification.user_id = user.id
    await session.commit()
    await session.refresh(user)
    return user


async def get_user_by_phone(session: AsyncSession, phone: str) -> User | None:
    result = await session.execute(select(User).where(User.phone == phone))
    return result.scalar_one_or_none()


def raise_invalid_code() -> None:
    raise HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="验证码错误或已过期",
    )
