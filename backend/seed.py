import asyncio
import sys
from pathlib import Path

from sqlalchemy import select

ROOT_DIR = Path(__file__).resolve().parents[1]
if str(ROOT_DIR) not in sys.path:
    sys.path.insert(0, str(ROOT_DIR))

from backend.app.core.security import hash_password
from backend.app.db.session import AsyncSessionLocal
from backend.app.models.reward import Reward, RewardStatus
from backend.app.models.user import Role, User, UserRole, UserStatus


REWARDS = [
    {
        "name": "笔记本套装",
        "category": "文具",
        "description": "适合每日复盘的学习笔记本套装。",
        "cost_points": 800,
        "stock": 50,
    },
    {
        "name": "AI 学习报告包",
        "category": "会员",
        "description": "兑换后可获得一次 AI 学习报告权益。",
        "cost_points": 1200,
        "stock": None,
    },
    {
        "name": "课程优惠券",
        "category": "课程",
        "description": "用于后续课程购买的优惠券。",
        "cost_points": 2000,
        "stock": 30,
    },
    {
        "name": "专属头像框",
        "category": "虚拟奖励",
        "description": "展示连续学习成果的虚拟头像框。",
        "cost_points": 500,
        "stock": None,
    },
    {
        "name": "错题复盘模板",
        "category": "文具",
        "description": "帮助整理错题原因和复习计划的模板。",
        "cost_points": 680,
        "stock": 80,
    },
    {
        "name": "7 天会员加速",
        "category": "会员",
        "description": "兑换 7 天会员学习辅助权益。",
        "cost_points": 1600,
        "stock": None,
    },
]

ROLES = [
    ("user", "普通用户", "Default user role"),
    ("admin", "管理员", "Operations admin role"),
    ("super_admin", "超级管理员", "Full admin role"),
]

ADMIN_USERNAME = "admin"
ADMIN_PASSWORD = "admin123456"


async def ensure_roles(session) -> dict[str, Role]:
    roles: dict[str, Role] = {}
    for code, name, description in ROLES:
        result = await session.execute(select(Role).where(Role.code == code))
        role = result.scalar_one_or_none()
        if role is None:
            role = Role(code=code, name=name, description=description)
            session.add(role)
            await session.flush()
        else:
            role.name = name
            role.description = description
        roles[code] = role
    return roles


async def ensure_admin_user(session, roles: dict[str, Role]) -> None:
    result = await session.execute(select(User).where(User.username == ADMIN_USERNAME))
    admin = result.scalar_one_or_none()
    if admin is None:
        admin = User(
            username=ADMIN_USERNAME,
            password_hash=hash_password(ADMIN_PASSWORD),
            display_name="系统管理员",
            status=UserStatus.active,
        )
        session.add(admin)
        await session.flush()
    else:
        admin.password_hash = hash_password(ADMIN_PASSWORD)
        admin.display_name = admin.display_name or "系统管理员"
        admin.status = UserStatus.active

    for role_code in ("user", "admin", "super_admin"):
        role = roles[role_code]
        result = await session.execute(
            select(UserRole).where(UserRole.user_id == admin.id, UserRole.role_id == role.id),
        )
        if result.scalar_one_or_none() is None:
            session.add(UserRole(user_id=admin.id, role_id=role.id))


async def seed_rewards() -> None:
    async with AsyncSessionLocal() as session:
        roles = await ensure_roles(session)
        await ensure_admin_user(session, roles)
        for reward_data in REWARDS:
            result = await session.execute(select(Reward).where(Reward.name == reward_data["name"]))
            reward = result.scalar_one_or_none()
            if reward is None:
                session.add(Reward(**reward_data, status=RewardStatus.active))
            else:
                for key, value in reward_data.items():
                    setattr(reward, key, value)
                reward.status = RewardStatus.active
        await session.commit()


if __name__ == "__main__":
    asyncio.run(seed_rewards())
