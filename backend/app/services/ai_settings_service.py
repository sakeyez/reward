import base64
import hashlib
from dataclasses import dataclass

from cryptography.fernet import Fernet, InvalidToken
from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.config import get_settings
from backend.app.models.ai import AiSetting
from backend.app.models.user import User


DEFAULT_BASE_URL = "https://api.openai.com/v1"
DEFAULT_MODEL = "gpt-4o-mini"
API_TYPE = "chat_completions"


@dataclass(frozen=True)
class AiRuntimeConfig:
    enabled: bool
    base_url: str
    model: str
    api_key: str | None


async def get_or_create_ai_setting(session: AsyncSession) -> AiSetting:
    result = await session.execute(select(AiSetting).order_by(AiSetting.id).limit(1))
    setting = result.scalar_one_or_none()
    if setting is not None:
        return setting

    setting = AiSetting(
        enabled=False,
        base_url=DEFAULT_BASE_URL,
        model=DEFAULT_MODEL,
        api_type=API_TYPE,
    )
    session.add(setting)
    await session.flush()
    return setting


def user_is_super_admin(user: User) -> bool:
    return any(user_role.role.code == "super_admin" for user_role in user.roles)


def require_super_admin(user: User) -> None:
    if not user_is_super_admin(user):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Super admin permission required",
        )


def mask_api_key(api_key: str | None) -> str | None:
    if not api_key:
        return None
    if len(api_key) <= 8:
        return "****"
    return f"{api_key[:3]}...{api_key[-4:]}"


def encrypt_api_key(api_key: str) -> str:
    return _fernet().encrypt(api_key.encode("utf-8")).decode("utf-8")


def decrypt_api_key(encrypted: str | None) -> str | None:
    if not encrypted:
        return None
    try:
        return _fernet().decrypt(encrypted.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:
        raise ValueError("AI API key could not be decrypted") from exc


def _fernet() -> Fernet:
    settings = get_settings()
    key = settings.ai_config_encryption_key.strip()
    if key:
        return Fernet(key.encode("utf-8"))

    if settings.app_env == "production":
        raise RuntimeError("AI_CONFIG_ENCRYPTION_KEY is required in production")

    digest = hashlib.sha256(settings.secret_key.encode("utf-8")).digest()
    return Fernet(base64.urlsafe_b64encode(digest))


def setting_to_runtime(setting: AiSetting) -> AiRuntimeConfig:
    return AiRuntimeConfig(
        enabled=setting.enabled,
        base_url=setting.base_url.rstrip("/"),
        model=setting.model,
        api_key=decrypt_api_key(setting.encrypted_api_key),
    )
