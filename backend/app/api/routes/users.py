from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.core.config import get_settings
from backend.app.db.session import get_db_session
from backend.app.models.user import User
from backend.app.schemas.user import UserRead


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_current_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user


@router.patch("/me", response_model=UserRead)
async def update_current_user(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    display_name: Annotated[str | None, Form(min_length=1, max_length=80)] = None,
    avatar: Annotated[UploadFile | None, File()] = None,
) -> User:
    if display_name is not None:
        normalized_name = display_name.strip()
        if not normalized_name:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="display_name cannot be empty",
            )
        current_user.display_name = normalized_name
    if avatar is not None:
        current_user.avatar_url = await save_avatar_image(current_user.id, avatar)

    await session.commit()
    await session.refresh(current_user)
    return current_user


async def save_avatar_image(user_id: int, avatar: UploadFile) -> str:
    if avatar.content_type and not avatar.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="avatar must be an image file",
        )

    settings = get_settings()
    suffix = Path(avatar.filename or "").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        suffix = ".jpg"

    relative_dir = Path("avatars") / str(user_id)
    target_dir = Path(settings.upload_dir) / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    data = await avatar.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="avatar file cannot be empty",
        )

    filename = f"{uuid4().hex}{suffix}"
    target_path = target_dir / filename
    target_path.write_bytes(data)
    return f"/uploads/{relative_dir.as_posix()}/{filename}"
