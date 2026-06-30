from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.core.security import hash_password, verify_password
from backend.app.models.user import Role, User, UserRole, UserStatus
from backend.app.schemas.user import UserCreate


async def get_user_by_id(session: AsyncSession, user_id: int) -> User | None:
    return await session.get(User, user_id)


async def get_user_by_identifier(session: AsyncSession, identifier: str) -> User | None:
    result = await session.execute(
        select(User).where(
            or_(
                User.username == identifier,
                User.phone == identifier,
                User.email == identifier,
            ),
        ),
    )
    return result.scalar_one_or_none()


async def get_existing_user_for_create(
    session: AsyncSession,
    user_in: UserCreate,
) -> User | None:
    conditions = []
    if user_in.username:
        conditions.append(User.username == user_in.username)
    if user_in.phone:
        conditions.append(User.phone == user_in.phone)
    if user_in.email:
        conditions.append(User.email == str(user_in.email))

    if not conditions:
        return None

    result = await session.execute(select(User).where(or_(*conditions)))
    return result.scalar_one_or_none()


async def ensure_default_role(session: AsyncSession) -> Role:
    result = await session.execute(select(Role).where(Role.code == "user"))
    role = result.scalar_one_or_none()
    if role:
        return role

    role = Role(code="user", name="普通用户", description="Default user role")
    session.add(role)
    await session.flush()
    return role


async def create_user(session: AsyncSession, user_in: UserCreate) -> User:
    user = User(
        username=user_in.username,
        phone=user_in.phone,
        email=str(user_in.email) if user_in.email else None,
        password_hash=hash_password(user_in.password),
        display_name=user_in.display_name,
        status=UserStatus.active,
    )
    session.add(user)
    await session.flush()

    default_role = await ensure_default_role(session)
    session.add(UserRole(user_id=user.id, role_id=default_role.id))
    await session.commit()
    await session.refresh(user)
    return user


async def authenticate_user(
    session: AsyncSession,
    identifier: str,
    password: str,
) -> User | None:
    user = await get_user_by_identifier(session, identifier)
    if not user or user.status != UserStatus.active:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user
