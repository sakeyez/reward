from typing import Annotated

from fastapi import APIRouter, Depends

from backend.app.api.deps import get_current_user
from backend.app.models.user import User
from backend.app.schemas.user import UserRead


router = APIRouter(prefix="/users", tags=["users"])


@router.get("/me", response_model=UserRead)
async def read_current_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user
