from fastapi import HTTPException, status
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from backend.app.models.point import PointTransactionType
from backend.app.models.reward import Redemption, Reward, RewardStatus
from backend.app.models.user import User
from backend.app.services.point_service import create_point_transaction


async def list_active_rewards(session: AsyncSession) -> list[Reward]:
    result = await session.execute(
        select(Reward)
        .where(Reward.status == RewardStatus.active)
        .order_by(Reward.cost_points, Reward.id),
    )
    return list(result.scalars().all())


def reward_to_read_model(reward: Reward, user_points: int) -> dict:
    shortfall = max(reward.cost_points - user_points, 0)
    has_stock = reward.stock is None or reward.stock > 0
    return {
        "id": reward.id,
        "name": reward.name,
        "category": reward.category,
        "description": reward.description,
        "image_url": reward.image_url,
        "cost_points": reward.cost_points,
        "stock": reward.stock,
        "status": reward.status,
        "can_redeem": shortfall == 0 and has_stock,
        "points_shortfall": shortfall,
    }


async def create_redemption(
    session: AsyncSession,
    user: User,
    reward_id: int,
    receiver_name: str | None = None,
    receiver_phone: str | None = None,
    receiver_address: str | None = None,
) -> Redemption:
    reward = await session.get(Reward, reward_id)
    if reward is None or reward.status != RewardStatus.active:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Reward not found")

    if reward.stock == 0:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Reward is out of stock")

    if user.current_points < reward.cost_points:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Insufficient points")

    redemption = Redemption(
        user_id=user.id,
        reward_id=reward.id,
        cost_points=reward.cost_points,
        receiver_name=receiver_name,
        receiver_phone=receiver_phone,
        receiver_address=receiver_address,
    )
    session.add(redemption)
    await session.flush()

    if reward.stock is not None:
        reward.stock -= 1

    await create_point_transaction(
        session=session,
        user=user,
        transaction_type=PointTransactionType.redemption_cost,
        amount=-reward.cost_points,
        related_type="redemption",
        related_id=str(redemption.id),
        reason=f"兑换奖励：{reward.name}",
    )
    await session.commit()
    return await get_user_redemption_by_id(session, user.id, redemption.id)  # type: ignore[return-value]


async def list_user_redemptions(
    session: AsyncSession,
    user_id: int,
    limit: int,
    offset: int,
) -> list[Redemption]:
    result = await session.execute(
        select(Redemption)
        .options(selectinload(Redemption.reward))
        .where(Redemption.user_id == user_id)
        .order_by(desc(Redemption.created_at), desc(Redemption.id))
        .limit(limit)
        .offset(offset),
    )
    return list(result.scalars().all())


async def get_user_redemption_by_id(session: AsyncSession, user_id: int, redemption_id: int) -> Redemption | None:
    result = await session.execute(
        select(Redemption)
        .options(selectinload(Redemption.reward))
        .where(Redemption.id == redemption_id, Redemption.user_id == user_id),
    )
    return result.scalar_one_or_none()


def redemption_to_read_model(redemption: Redemption) -> dict:
    return {
        "id": redemption.id,
        "reward_id": redemption.reward_id,
        "reward_name": redemption.reward.name,
        "cost_points": redemption.cost_points,
        "status": redemption.status,
        "receiver_name": redemption.receiver_name,
        "receiver_phone": redemption.receiver_phone,
        "receiver_address": redemption.receiver_address,
        "created_at": redemption.created_at,
    }
