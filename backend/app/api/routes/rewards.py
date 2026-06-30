from typing import Annotated

from fastapi import APIRouter, Depends, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db.session import get_db_session
from backend.app.models.user import User
from backend.app.schemas.reward import RedemptionCreate, RedemptionRead, RewardRead
from backend.app.services.reward_service import (
    create_redemption,
    list_active_rewards,
    list_user_redemptions,
    redemption_to_read_model,
    reward_to_read_model,
)


rewards_router = APIRouter(prefix="/rewards", tags=["rewards"])
redemptions_router = APIRouter(prefix="/redemptions", tags=["redemptions"])


@rewards_router.get("", response_model=list[RewardRead])
async def read_rewards(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[RewardRead]:
    rewards = await list_active_rewards(session)
    return [RewardRead.model_validate(reward_to_read_model(item, current_user.current_points)) for item in rewards]


@redemptions_router.post("", response_model=RedemptionRead, status_code=status.HTTP_201_CREATED)
async def redeem_reward(
    redemption_in: RedemptionCreate,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> RedemptionRead:
    redemption = await create_redemption(
        session=session,
        user=current_user,
        reward_id=redemption_in.reward_id,
        receiver_name=redemption_in.receiver_name,
        receiver_phone=redemption_in.receiver_phone,
        receiver_address=redemption_in.receiver_address,
    )
    return RedemptionRead.model_validate(redemption_to_read_model(redemption))


@redemptions_router.get("/me", response_model=list[RedemptionRead])
async def read_my_redemptions(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[RedemptionRead]:
    redemptions = await list_user_redemptions(session, current_user.id, limit, offset)
    return [RedemptionRead.model_validate(redemption_to_read_model(item)) for item in redemptions]
