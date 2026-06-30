from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.api.deps import get_current_user
from backend.app.db.session import get_db_session
from backend.app.models.user import User
from backend.app.schemas.checkin import CheckinCalendarItem, CheckinCalendarResponse, CheckinRead
from backend.app.services.checkin_service import (
    create_checkin,
    get_user_checkin_by_id,
    list_user_checkins,
    list_user_checkins_for_month,
)


router = APIRouter(prefix="/checkins", tags=["checkins"])


@router.post("", response_model=CheckinRead, status_code=status.HTTP_201_CREATED)
async def submit_checkin(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    content_text: Annotated[str | None, Form()] = None,
    checkin_date: Annotated[date | None, Form()] = None,
    image: Annotated[UploadFile | None, File()] = None,
) -> CheckinRead:
    checkin = await create_checkin(
        session=session,
        user=current_user,
        content_text=content_text,
        image=image,
        checkin_date=checkin_date or date.today(),
    )
    return CheckinRead.model_validate(checkin)


@router.get("/me", response_model=list[CheckinRead])
async def read_my_checkins(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
) -> list[CheckinRead]:
    checkins = await list_user_checkins(session, current_user.id, limit, offset)
    return [CheckinRead.model_validate(item) for item in checkins]


@router.get("/calendar", response_model=CheckinCalendarResponse)
async def read_my_checkin_calendar(
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    year: Annotated[int, Query(ge=2000, le=2100)],
    month: Annotated[int, Query(ge=1, le=12)],
) -> CheckinCalendarResponse:
    checkins = await list_user_checkins_for_month(session, current_user.id, year, month)
    return CheckinCalendarResponse(
        year=year,
        month=month,
        days=[
            CheckinCalendarItem(
                id=item.id,
                checkin_date=item.checkin_date,
                day=item.checkin_date.day,
                status=item.status,
                total_score=item.total_score,
                awarded_points=item.awarded_points,
            )
            for item in checkins
        ],
    )


@router.get("/{checkin_id}", response_model=CheckinRead)
async def read_my_checkin(
    checkin_id: int,
    current_user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CheckinRead:
    checkin = await get_user_checkin_by_id(session, current_user.id, checkin_id)
    if checkin is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check-in not found")
    return CheckinRead.model_validate(checkin)
