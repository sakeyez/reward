from datetime import date, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import and_, desc, func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.api.deps import get_current_admin_user
from backend.app.db.session import get_db_session
from backend.app.models.checkin import Checkin, CheckinStatus
from backend.app.models.point import PointTransaction, PointTransactionType
from backend.app.models.reward import Redemption, RedemptionStatus, Reward, RewardStatus
from backend.app.models.user import User, UserRole, UserStatus
from backend.app.schemas.admin import (
    AdminAiSettingRead,
    AdminAiSettingTest,
    AdminAiSettingTestResult,
    AdminAiSettingUpdate,
    AdminCheckinList,
    AdminCheckinRead,
    AdminPointAdjustmentCreate,
    AdminPointTransactionList,
    AdminPointTransactionRead,
    AdminRedemptionList,
    AdminRedemptionRead,
    AdminRedemptionUpdate,
    AdminRewardCreate,
    AdminRewardList,
    AdminRewardRead,
    AdminRewardUpdate,
    AdminSummary,
    AdminUserList,
    AdminUserRead,
    AdminUserUpdate,
)
from backend.app.services.ai_scoring_service import AiScoringError, test_ai_connection
from backend.app.services.ai_settings_service import (
    AiRuntimeConfig,
    API_TYPE,
    DEFAULT_BASE_URL,
    DEFAULT_MODEL,
    decrypt_api_key,
    encrypt_api_key,
    get_or_create_ai_setting,
    mask_api_key,
    require_super_admin,
    user_is_super_admin,
)
from backend.app.services.point_service import create_point_transaction
from backend.app.services.checkin_service import analyze_checkin


router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/summary", response_model=AdminSummary)
async def read_admin_summary(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminSummary:
    today = date.today()
    users_total = await scalar_count(session, select(func.count()).select_from(User))
    active_users = await scalar_count(
        session,
        select(func.count()).select_from(User).where(User.status == UserStatus.active),
    )
    today_checkins = await scalar_count(
        session,
        select(func.count()).select_from(Checkin).where(Checkin.checkin_date == today),
    )
    earned = await scalar_sum(
        session,
        select(func.coalesce(func.sum(PointTransaction.amount), 0)).where(PointTransaction.amount > 0),
    )
    spent = await scalar_sum(
        session,
        select(func.coalesce(func.sum(PointTransaction.amount), 0)).where(PointTransaction.amount < 0),
    )
    pending_redemptions = await scalar_count(
        session,
        select(func.count()).select_from(Redemption).where(Redemption.status == RedemptionStatus.created),
    )
    rewards_total = await scalar_count(session, select(func.count()).select_from(Reward))
    return AdminSummary(
        users_total=users_total,
        active_users=active_users,
        today_checkins=today_checkins,
        points_earned=earned,
        points_spent=abs(spent),
        pending_redemptions=pending_redemptions,
        rewards_total=rewards_total,
    )


@router.get("/ai-settings", response_model=AdminAiSettingRead)
async def read_admin_ai_settings(
    admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminAiSettingRead:
    setting = await get_or_create_ai_setting(session)
    await session.commit()
    api_key = decrypt_api_key(setting.encrypted_api_key)
    return ai_setting_to_read(setting, api_key, user_is_super_admin(admin))


@router.patch("/ai-settings", response_model=AdminAiSettingRead)
async def update_admin_ai_settings(
    setting_in: AdminAiSettingUpdate,
    admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminAiSettingRead:
    require_super_admin(admin)
    setting = await get_or_create_ai_setting(session)
    payload = setting_in.model_dump(exclude_unset=True)
    if "enabled" in payload:
        setting.enabled = bool(payload["enabled"])
    if payload.get("base_url") is not None:
        setting.base_url = payload["base_url"].rstrip("/") or DEFAULT_BASE_URL
    if payload.get("model") is not None:
        setting.model = payload["model"] or DEFAULT_MODEL
    setting.api_type = API_TYPE
    api_key = decrypt_api_key(setting.encrypted_api_key)
    if "api_key" in payload and payload["api_key"] is not None:
        api_key_candidate = payload["api_key"].strip()
        if api_key_candidate:
            setting.encrypted_api_key = encrypt_api_key(api_key_candidate)
            api_key = api_key_candidate
    await session.commit()
    await session.refresh(setting)
    return ai_setting_to_read(setting, api_key, True)


@router.post("/ai-settings/test", response_model=AdminAiSettingTestResult)
async def test_admin_ai_settings(
    setting_in: AdminAiSettingTest,
    admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminAiSettingTestResult:
    setting = await get_or_create_ai_setting(session)
    stored_key = decrypt_api_key(setting.encrypted_api_key)
    runtime = AiRuntimeConfig(
        enabled=setting_in.enabled if setting_in.enabled is not None else setting.enabled,
        base_url=(setting_in.base_url or setting.base_url or DEFAULT_BASE_URL).rstrip("/"),
        model=setting_in.model or setting.model or DEFAULT_MODEL,
        api_key=(setting_in.api_key.strip() if setting_in.api_key else stored_key),
    )
    try:
        message = await test_ai_connection(runtime)
        setting.last_test_status = "success"
        setting.last_test_message = message
        status_text = "success"
    except (AiScoringError, RuntimeError, ValueError) as exc:
        message = str(exc)
        setting.last_test_status = "failed"
        setting.last_test_message = message
        status_text = "failed"
    await session.commit()
    return AdminAiSettingTestResult(status=status_text, message=message)


@router.get("/users", response_model=AdminUserList)
async def list_admin_users(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    q: Annotated[str | None, Query(max_length=80)] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminUserList:
    filters = []
    if q:
        keyword = f"%{q.strip()}%"
        filters.append(
            or_(
                User.username.ilike(keyword),
                User.phone.ilike(keyword),
                User.email.ilike(keyword),
                User.display_name.ilike(keyword),
            ),
        )
    where_clause = and_(*filters) if filters else None
    total_stmt = select(func.count()).select_from(User)
    list_stmt = (
        select(User)
        .options(selectinload(User.roles).selectinload(UserRole.role))
        .order_by(desc(User.created_at), desc(User.id))
        .limit(limit)
        .offset(offset)
    )
    if where_clause is not None:
        total_stmt = total_stmt.where(where_clause)
        list_stmt = list_stmt.where(where_clause)
    total = await scalar_count(session, total_stmt)
    result = await session.execute(list_stmt)
    users = result.scalars().all()
    return AdminUserList(
        items=[user_to_admin_read(item) for item in users],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/users/{user_id}", response_model=AdminUserRead)
async def update_admin_user(
    user_id: int,
    user_in: AdminUserUpdate,
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminUserRead:
    user = await get_user_with_roles(session, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    user.status = user_in.status
    await session.commit()
    user = await get_user_with_roles(session, user_id)
    return user_to_admin_read(user)  # type: ignore[arg-type]


@router.post("/users/{user_id}/point-adjustments", response_model=AdminPointTransactionRead)
async def create_admin_point_adjustment(
    user_id: int,
    adjustment_in: AdminPointAdjustmentCreate,
    admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminPointTransactionRead:
    user = await session.get(User, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    try:
        transaction = await create_point_transaction(
            session=session,
            user=user,
            transaction_type=PointTransactionType.admin_adjustment,
            amount=adjustment_in.amount,
            reason=adjustment_in.reason,
            related_type="admin_adjustment",
            related_id=str(admin.id),
            created_by=admin.id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    await session.commit()
    await session.refresh(transaction)
    return AdminPointTransactionRead(
        id=transaction.id,
        user_id=user.id,
        user_display_name=user.display_name,
        type=transaction.type,
        amount=transaction.amount,
        balance_after=transaction.balance_after,
        related_type=transaction.related_type,
        related_id=transaction.related_id,
        reason=transaction.reason,
        created_by=transaction.created_by,
        created_at=transaction.created_at,
    )


@router.get("/checkins", response_model=AdminCheckinList)
async def list_admin_checkins(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    user_id: int | None = None,
    status_filter: Annotated[CheckinStatus | None, Query(alias="status")] = None,
    date_from: date | None = None,
    date_to: date | None = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminCheckinList:
    filters = []
    if user_id is not None:
        filters.append(Checkin.user_id == user_id)
    if status_filter is not None:
        filters.append(Checkin.status == status_filter)
    if date_from is not None:
        filters.append(Checkin.checkin_date >= date_from)
    if date_to is not None:
        filters.append(Checkin.checkin_date <= date_to)
    where_clause = and_(*filters) if filters else None
    total_stmt = select(func.count()).select_from(Checkin)
    list_stmt = (
        select(Checkin)
        .options(selectinload(Checkin.user))
        .order_by(desc(Checkin.checkin_date), desc(Checkin.id))
        .limit(limit)
        .offset(offset)
    )
    if where_clause is not None:
        total_stmt = total_stmt.where(where_clause)
        list_stmt = list_stmt.where(where_clause)
    total = await scalar_count(session, total_stmt)
    result = await session.execute(list_stmt)
    return AdminCheckinList(
        items=[checkin_to_admin_read(item) for item in result.scalars().all()],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.delete("/checkins/{checkin_id}", status_code=status.HTTP_204_NO_CONTENT)
async def reset_admin_checkin(
    checkin_id: int,
    admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    result = await session.execute(
        select(Checkin)
        .options(selectinload(Checkin.user))
        .where(Checkin.id == checkin_id),
    )
    checkin = result.scalar_one_or_none()
    if checkin is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check-in not found")

    user = checkin.user
    if checkin.awarded_points > 0:
        try:
            await create_point_transaction(
                session=session,
                user=user,
                transaction_type=PointTransactionType.admin_adjustment,
                amount=-checkin.awarded_points,
                reason=f"管理员重置 {checkin.checkin_date.isoformat()} 学习打卡，扣回奖励",
                related_type="checkin_reset",
                related_id=str(checkin.id),
                created_by=admin.id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

    await session.delete(checkin)
    user.streak_days = await recalculate_user_streak_days(session, user.id, exclude_checkin_id=checkin_id)
    await session.commit()


@router.post("/checkins/{checkin_id}/retry", response_model=AdminCheckinRead)
async def retry_admin_checkin_scoring(
    checkin_id: int,
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminCheckinRead:
    checkin = await analyze_checkin(session, checkin_id)
    if checkin is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check-in not found")
    result = await session.execute(
        select(Checkin)
        .options(selectinload(Checkin.user))
        .where(Checkin.id == checkin_id),
    )
    return checkin_to_admin_read(result.scalar_one())


@router.get("/point-transactions", response_model=AdminPointTransactionList)
async def list_admin_point_transactions(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    user_id: int | None = None,
    transaction_type: Annotated[PointTransactionType | None, Query(alias="type")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminPointTransactionList:
    filters = []
    if user_id is not None:
        filters.append(PointTransaction.user_id == user_id)
    if transaction_type is not None:
        filters.append(PointTransaction.type == transaction_type)
    where_clause = and_(*filters) if filters else None
    total_stmt = select(func.count()).select_from(PointTransaction)
    list_stmt = (
        select(PointTransaction)
        .options(selectinload(PointTransaction.user))
        .order_by(desc(PointTransaction.created_at), desc(PointTransaction.id))
        .limit(limit)
        .offset(offset)
    )
    if where_clause is not None:
        total_stmt = total_stmt.where(where_clause)
        list_stmt = list_stmt.where(where_clause)
    total = await scalar_count(session, total_stmt)
    result = await session.execute(list_stmt)
    return AdminPointTransactionList(
        items=[transaction_to_admin_read(item) for item in result.scalars().all()],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.get("/rewards", response_model=AdminRewardList)
async def list_admin_rewards(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminRewardList:
    result = await session.execute(select(Reward).order_by(Reward.cost_points, Reward.id))
    rewards = result.scalars().all()
    return AdminRewardList(
        items=[AdminRewardRead.model_validate(item) for item in rewards],
        total=len(rewards),
    )


@router.post("/rewards", response_model=AdminRewardRead, status_code=status.HTTP_201_CREATED)
async def create_admin_reward(
    reward_in: AdminRewardCreate,
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminRewardRead:
    reward = Reward(**reward_in.model_dump())
    session.add(reward)
    await session.commit()
    await session.refresh(reward)
    return AdminRewardRead.model_validate(reward)


@router.patch("/rewards/{reward_id}", response_model=AdminRewardRead)
async def update_admin_reward(
    reward_id: int,
    reward_in: AdminRewardUpdate,
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminRewardRead:
    reward = await session.get(Reward, reward_id)
    if reward is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")
    for key, value in reward_in.model_dump(exclude_unset=True).items():
        setattr(reward, key, value)
    await session.commit()
    await session.refresh(reward)
    return AdminRewardRead.model_validate(reward)


@router.get("/redemptions", response_model=AdminRedemptionList)
async def list_admin_redemptions(
    _admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    status_filter: Annotated[RedemptionStatus | None, Query(alias="status")] = None,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> AdminRedemptionList:
    where_clause = Redemption.status == status_filter if status_filter is not None else None
    total_stmt = select(func.count()).select_from(Redemption)
    list_stmt = (
        select(Redemption)
        .options(selectinload(Redemption.user), selectinload(Redemption.reward))
        .order_by(desc(Redemption.created_at), desc(Redemption.id))
        .limit(limit)
        .offset(offset)
    )
    if where_clause is not None:
        total_stmt = total_stmt.where(where_clause)
        list_stmt = list_stmt.where(where_clause)
    total = await scalar_count(session, total_stmt)
    result = await session.execute(list_stmt)
    return AdminRedemptionList(
        items=[redemption_to_admin_read(item) for item in result.scalars().all()],
        total=total,
        limit=limit,
        offset=offset,
    )


@router.patch("/redemptions/{redemption_id}", response_model=AdminRedemptionRead)
async def update_admin_redemption(
    redemption_id: int,
    redemption_in: AdminRedemptionUpdate,
    admin: Annotated[User, Depends(get_current_admin_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> AdminRedemptionRead:
    result = await session.execute(
        select(Redemption)
        .options(selectinload(Redemption.user), selectinload(Redemption.reward))
        .where(Redemption.id == redemption_id),
    )
    redemption = result.scalar_one_or_none()
    if redemption is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Redemption not found")
    if redemption.status != RedemptionStatus.created:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Redemption already processed")
    if redemption_in.status not in {RedemptionStatus.fulfilled, RedemptionStatus.cancelled}:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Invalid status transition")

    if redemption_in.status == RedemptionStatus.cancelled:
        await create_point_transaction(
            session=session,
            user=redemption.user,
            transaction_type=PointTransactionType.refund,
            amount=redemption.cost_points,
            reason=f"兑换取消退款：{redemption.reward.name}",
            related_type="redemption",
            related_id=str(redemption.id),
            created_by=admin.id,
        )
        if redemption.reward.stock is not None:
            redemption.reward.stock += 1
    redemption.status = redemption_in.status
    await session.commit()

    result = await session.execute(
        select(Redemption)
        .options(selectinload(Redemption.user), selectinload(Redemption.reward))
        .where(Redemption.id == redemption_id),
    )
    return redemption_to_admin_read(result.scalar_one())


async def scalar_count(session: AsyncSession, stmt) -> int:
    result = await session.execute(stmt)
    return int(result.scalar_one() or 0)


async def scalar_sum(session: AsyncSession, stmt) -> int:
    result = await session.execute(stmt)
    return int(result.scalar_one() or 0)


async def get_user_with_roles(session: AsyncSession, user_id: int) -> User | None:
    result = await session.execute(
        select(User)
        .options(selectinload(User.roles).selectinload(UserRole.role))
        .where(User.id == user_id),
    )
    return result.scalar_one_or_none()


async def recalculate_user_streak_days(
    session: AsyncSession,
    user_id: int,
    exclude_checkin_id: int | None = None,
) -> int:
    filters = [Checkin.user_id == user_id, Checkin.status == CheckinStatus.scored]
    if exclude_checkin_id is not None:
        filters.append(Checkin.id != exclude_checkin_id)
    result = await session.execute(
        select(Checkin.checkin_date)
        .where(*filters)
        .order_by(desc(Checkin.checkin_date)),
    )
    dates = list(result.scalars().all())
    if not dates:
        return 0

    streak = 1
    previous = dates[0]
    for current in dates[1:]:
        if current == previous:
            continue
        if current == previous - timedelta(days=1):
            streak += 1
            previous = current
            continue
        break
    return streak


def user_to_admin_read(user: User) -> AdminUserRead:
    return AdminUserRead(
        id=user.id,
        username=user.username,
        phone=user.phone,
        email=user.email,
        display_name=user.display_name,
        current_points=user.current_points,
        streak_days=user.streak_days,
        status=user.status,
        roles=[item.role.code for item in user.roles],
        created_at=user.created_at,
    )


def checkin_to_admin_read(checkin: Checkin) -> AdminCheckinRead:
    return AdminCheckinRead(
        id=checkin.id,
        user_id=checkin.user_id,
        user_display_name=checkin.user.display_name,
        checkin_date=checkin.checkin_date,
        content_text=checkin.content_text,
        image_url=checkin.image_url,
        status=checkin.status,
        total_score=checkin.total_score,
        awarded_points=checkin.awarded_points,
        ai_comment=checkin.ai_comment,
        ai_error=checkin.ai_error,
        created_at=checkin.created_at,
    )


def ai_setting_to_read(setting, api_key: str | None, can_edit: bool) -> AdminAiSettingRead:
    return AdminAiSettingRead(
        enabled=setting.enabled,
        base_url=setting.base_url,
        model=setting.model,
        api_type=setting.api_type,
        api_key_masked=mask_api_key(api_key),
        last_test_status=setting.last_test_status,
        last_test_message=setting.last_test_message,
        can_edit=can_edit,
    )


def transaction_to_admin_read(transaction: PointTransaction) -> AdminPointTransactionRead:
    return AdminPointTransactionRead(
        id=transaction.id,
        user_id=transaction.user_id,
        user_display_name=transaction.user.display_name,
        type=transaction.type,
        amount=transaction.amount,
        balance_after=transaction.balance_after,
        related_type=transaction.related_type,
        related_id=transaction.related_id,
        reason=transaction.reason,
        created_by=transaction.created_by,
        created_at=transaction.created_at,
    )


def redemption_to_admin_read(redemption: Redemption) -> AdminRedemptionRead:
    return AdminRedemptionRead(
        id=redemption.id,
        user_id=redemption.user_id,
        user_display_name=redemption.user.display_name,
        reward_id=redemption.reward_id,
        reward_name=redemption.reward.name,
        cost_points=redemption.cost_points,
        status=redemption.status,
        receiver_name=redemption.receiver_name,
        receiver_phone=redemption.receiver_phone,
        receiver_address=redemption.receiver_address,
        created_at=redemption.created_at,
    )
