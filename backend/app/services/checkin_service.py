from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4

from fastapi import HTTPException, UploadFile, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.core.config import get_settings
from backend.app.models.checkin import Checkin, CheckinScoreDimension, CheckinStatus
from backend.app.models.point import PointTransactionType
from backend.app.models.user import User
from backend.app.services.fake_scoring_service import score_checkin
from backend.app.services.point_service import create_point_transaction


async def create_checkin(
    session: AsyncSession,
    user: User,
    content_text: str | None,
    image: UploadFile | None,
    checkin_date: date,
) -> Checkin:
    normalized_text = content_text.strip() if content_text else None
    if not normalized_text and image is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="content_text or image is required",
        )

    existing = await get_user_checkin_by_date(session, user.id, checkin_date)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Check-in already exists for this date",
        )

    image_url = await save_checkin_image(user.id, image) if image else None
    score = score_checkin(normalized_text, image_url, checkin_date)

    checkin = Checkin(
        user_id=user.id,
        checkin_date=checkin_date,
        content_text=normalized_text,
        image_url=image_url,
        status=CheckinStatus.scored,
        total_score=score.total_score,
        awarded_points=score.awarded_points,
        ai_comment=score.comment,
        ai_advice=score.advice,
    )
    session.add(checkin)
    await session.flush()

    for dimension in score.dimensions:
        session.add(
            CheckinScoreDimension(
                checkin_id=checkin.id,
                dimension_code=dimension.code,
                dimension_name=dimension.name,
                score=dimension.score,
                sort_order=dimension.sort_order,
            ),
        )

    await create_point_transaction(
        session=session,
        user=user,
        transaction_type=PointTransactionType.checkin_reward,
        amount=score.awarded_points,
        related_type="checkin",
        related_id=str(checkin.id),
        reason=f"{checkin_date.isoformat()} 学习打卡奖励",
    )
    await update_user_streak(session, user, checkin_date)
    await session.commit()
    return await get_user_checkin_by_id(session, user.id, checkin.id)  # type: ignore[return-value]


async def save_checkin_image(user_id: int, image: UploadFile) -> str:
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="image must be an image file",
        )

    settings = get_settings()
    suffix = Path(image.filename or "").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        suffix = ".jpg"

    relative_dir = Path("checkins") / str(user_id)
    target_dir = Path(settings.upload_dir) / relative_dir
    target_dir.mkdir(parents=True, exist_ok=True)

    filename = f"{uuid4().hex}{suffix}"
    target_path = target_dir / filename
    data = await image.read()
    if not data:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="image file cannot be empty",
        )
    target_path.write_bytes(data)
    return f"/uploads/{relative_dir.as_posix()}/{filename}"


async def update_user_streak(session: AsyncSession, user: User, checkin_date: date) -> None:
    result = await session.execute(
        select(Checkin.checkin_date)
        .where(Checkin.user_id == user.id, Checkin.checkin_date < checkin_date)
        .order_by(desc(Checkin.checkin_date))
        .limit(1),
    )
    previous_date = result.scalar_one_or_none()
    user.streak_days = user.streak_days + 1 if previous_date == checkin_date - timedelta(days=1) else 1
    await session.flush()


async def get_user_checkin_by_date(
    session: AsyncSession,
    user_id: int,
    checkin_date: date,
) -> Checkin | None:
    result = await session.execute(
        select(Checkin).where(Checkin.user_id == user_id, Checkin.checkin_date == checkin_date),
    )
    return result.scalar_one_or_none()


async def get_user_checkin_by_id(session: AsyncSession, user_id: int, checkin_id: int) -> Checkin | None:
    result = await session.execute(
        select(Checkin)
        .options(selectinload(Checkin.score_dimensions))
        .where(Checkin.id == checkin_id, Checkin.user_id == user_id),
    )
    return result.scalar_one_or_none()


async def list_user_checkins(
    session: AsyncSession,
    user_id: int,
    limit: int,
    offset: int,
) -> list[Checkin]:
    result = await session.execute(
        select(Checkin)
        .options(selectinload(Checkin.score_dimensions))
        .where(Checkin.user_id == user_id)
        .order_by(desc(Checkin.checkin_date), desc(Checkin.id))
        .limit(limit)
        .offset(offset),
    )
    return list(result.scalars().all())


async def list_user_checkins_for_month(
    session: AsyncSession,
    user_id: int,
    year: int,
    month: int,
) -> list[Checkin]:
    start_date = date(year, month, 1)
    end_date = date(year + 1, 1, 1) if month == 12 else date(year, month + 1, 1)
    result = await session.execute(
        select(Checkin)
        .where(
            Checkin.user_id == user_id,
            Checkin.checkin_date >= start_date,
            Checkin.checkin_date < end_date,
        )
        .order_by(Checkin.checkin_date),
    )
    return list(result.scalars().all())
