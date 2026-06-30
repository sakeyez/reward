from typing import Annotated

from fastapi import APIRouter, Depends, Query
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db.session import get_db_session
from backend.app.models.point import PointTransaction
from backend.app.models.user import User
from backend.app.schemas.point import PointAccountRead, PointTransactionRead


router = APIRouter(prefix="/points", tags=["points"])


@router.get("/me", response_model=PointAccountRead)
async def read_my_points(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> PointAccountRead:
    result = await session.execute(
        select(PointTransaction)
        .where(PointTransaction.user_id == current_user.id)
        .order_by(desc(PointTransaction.created_at), desc(PointTransaction.id))
        .limit(limit)
        .offset(offset),
    )
    transactions = result.scalars().all()
    return PointAccountRead(
        current_points=current_user.current_points,
        streak_days=current_user.streak_days,
        transactions=[PointTransactionRead.model_validate(item) for item in transactions],
    )
