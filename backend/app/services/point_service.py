from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.point import PointTransaction, PointTransactionType
from backend.app.models.user import User


async def create_point_transaction(
    session: AsyncSession,
    user: User,
    transaction_type: PointTransactionType,
    amount: int,
    reason: str,
    related_type: str | None = None,
    related_id: str | None = None,
    created_by: int | None = None,
) -> PointTransaction:
    new_balance = user.current_points + amount
    if new_balance < 0:
        raise ValueError("Point balance cannot be negative")

    user.current_points = new_balance
    transaction = PointTransaction(
        user_id=user.id,
        type=transaction_type,
        amount=amount,
        balance_after=new_balance,
        related_type=related_type,
        related_id=related_id,
        reason=reason,
        created_by=created_by,
    )
    session.add(transaction)
    await session.flush()
    return transaction
