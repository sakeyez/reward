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
from backend.app.services.ai_scoring_service import AiScoringError, score_with_ai
from backend.app.services.ai_settings_service import get_or_create_ai_setting, setting_to_runtime
from backend.app.services.point_service import create_point_transaction
from backend.app.services.reward_formula_service import RewardFormulaInput, calculate_reward


async def create_checkin(
    session: AsyncSession,
    user: User,
    content_text: str | None,
    image: UploadFile | None,
    note_image: UploadFile | None,
    exercise_image: UploadFile | None,
    checkin_date: date,
    study_time_minutes: int,
    question_count: int,
) -> Checkin:
    normalized_text = content_text.strip() if content_text else None
    if not normalized_text and image is None and note_image is None and exercise_image is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="content_text or image is required",
        )
    if study_time_minutes < 0 or question_count < 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="study_time_minutes and question_count must be non-negative",
        )

    existing = await get_user_checkin_by_date(session, user.id, checkin_date)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Check-in already exists for this date",
        )

    image_url = await save_checkin_image(user.id, image, "legacy") if image else None
    note_image_url = await save_checkin_image(user.id, note_image, "notes") if note_image else None
    exercise_image_url = await save_checkin_image(user.id, exercise_image, "exercises") if exercise_image else None

    checkin = Checkin(
        user_id=user.id,
        checkin_date=checkin_date,
        content_text=normalized_text,
        image_url=image_url,
        note_image_url=note_image_url,
        exercise_image_url=exercise_image_url,
        study_time_minutes=study_time_minutes,
        question_count=question_count,
        status=CheckinStatus.analyzing,
        total_score=None,
        awarded_points=0,
    )
    session.add(checkin)
    await session.flush()
    await session.commit()
    return await get_user_checkin_by_id(session, user.id, checkin.id)  # type: ignore[return-value]


async def analyze_checkin(session: AsyncSession, checkin_id: int) -> Checkin | None:
    result = await session.execute(
        select(Checkin)
        .options(selectinload(Checkin.user), selectinload(Checkin.score_dimensions))
        .where(Checkin.id == checkin_id),
    )
    checkin = result.scalar_one_or_none()
    if checkin is None or checkin.status == CheckinStatus.scored:
        return checkin

    setting = await get_or_create_ai_setting(session)
    try:
        ai_result = await score_with_ai(checkin, setting_to_runtime(setting))
    except (AiScoringError, ValueError, RuntimeError) as exc:
        checkin.ai_error = str(exc)
        checkin.status = CheckinStatus.analyzing
        await session.commit()
        return checkin

    payload = ai_result.payload
    next_streak_days = await calculate_streak_days(session, checkin.user_id, checkin.checkin_date)
    formula = calculate_reward(
        RewardFormulaInput(
            study_time_minutes=checkin.study_time_minutes,
            note_words=payload.note_words,
            question_count=checkin.question_count,
            neatness_score=payload.neatness_score,
            accuracy_score=payload.accuracy_score,
            note_quality_score=payload.note_quality_score,
            streak_days=next_streak_days,
            risk_factor=payload.risk_factor if payload.valid else 0,
        ),
    )

    checkin.status = CheckinStatus.scored
    checkin.total_score = formula.total_score
    checkin.awarded_points = formula.awarded_points
    checkin.ai_comment = payload.comment
    checkin.ai_advice = f"{payload.advice}\n连续学习 {next_streak_days} 天"
    checkin.ai_error = None
    checkin.ai_raw_result = ai_result.raw_json
    checkin.note_words = payload.note_words
    checkin.neatness_score = payload.neatness_score
    checkin.accuracy_score = payload.accuracy_score
    checkin.note_quality_score = payload.note_quality_score
    checkin.risk_factor = payload.risk_factor if payload.valid else 0
    checkin.time_component = formula.time_component
    checkin.note_component = formula.note_component
    checkin.exercise_component = formula.exercise_component
    checkin.neatness_coefficient = formula.neatness_coefficient
    checkin.accuracy_coefficient = formula.accuracy_coefficient
    checkin.note_quality_coefficient = formula.note_quality_coefficient
    checkin.streak_coefficient = formula.streak_coefficient

    checkin.score_dimensions.clear()
    for index, (code, name, score) in enumerate(
        [
            ("workload", "工作量", formula.workload_score),
            ("neatness", "工整度", payload.neatness_score),
            ("accuracy", "准确率", payload.accuracy_score),
            ("note_quality", "笔记质量", payload.note_quality_score),
        ],
    ):
        checkin.score_dimensions.append(
            CheckinScoreDimension(
                dimension_code=code,
                dimension_name=name,
                score=score,
                sort_order=index,
            ),
        )

    if formula.awarded_points > 0:
        await create_point_transaction(
            session=session,
            user=checkin.user,
            transaction_type=PointTransactionType.checkin_reward,
            amount=formula.awarded_points,
            related_type="checkin",
            related_id=str(checkin.id),
            reason=f"{checkin.checkin_date.isoformat()} 学习打卡奖励",
        )
    checkin.user.streak_days = next_streak_days
    await session.commit()
    return checkin


async def save_checkin_image(user_id: int, image: UploadFile, kind: str) -> str:
    if image.content_type and not image.content_type.startswith("image/"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="image must be an image file",
        )

    settings = get_settings()
    suffix = Path(image.filename or "").suffix.lower()
    if suffix not in {".jpg", ".jpeg", ".png", ".gif", ".webp"}:
        suffix = ".jpg"

    relative_dir = Path("checkins") / str(user_id) / kind
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


async def calculate_streak_days(session: AsyncSession, user_id: int, checkin_date: date) -> int:
    result = await session.execute(
        select(Checkin.checkin_date)
        .where(
            Checkin.user_id == user_id,
            Checkin.checkin_date < checkin_date,
            Checkin.status == CheckinStatus.scored,
        )
        .order_by(desc(Checkin.checkin_date))
        .limit(1),
    )
    previous_date = result.scalar_one_or_none()
    if previous_date == checkin_date - timedelta(days=1):
        user = await session.get(User, user_id)
        return (user.streak_days if user else 0) + 1
    return 1


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
