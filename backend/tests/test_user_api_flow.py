from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.app.db.base import Base
from backend.app.db.session import get_db_session
from backend.app.main import app
from backend.app.models.reward import Reward, RewardStatus


@pytest.fixture()
def client(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Generator[TestClient, None, None]:
    database_path = tmp_path / "test.db"
    upload_dir = tmp_path / "uploads"
    monkeypatch.setenv("UPLOAD_DIR", str(upload_dir))

    engine = create_async_engine(f"sqlite+aiosqlite:///{database_path}")
    TestingSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False)

    async def override_get_db_session():
        async with TestingSessionLocal() as session:
            yield session

    async def init_db() -> None:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
        async with TestingSessionLocal() as session:
            session.add(
                Reward(
                    name="专属头像框",
                    category="虚拟奖励",
                    description="测试奖励",
                    cost_points=50,
                    stock=None,
                    status=RewardStatus.active,
                ),
            )
            await session.commit()

    import asyncio

    asyncio.run(init_db())
    app.dependency_overrides[get_db_session] = override_get_db_session
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        asyncio.run(engine.dispose())


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_user_checkin_points_and_redemption_flow(client: TestClient) -> None:
    register = client.post(
        "/api/auth/register",
        json={
            "username": "api_user",
            "password": "password123",
            "display_name": "API User",
        },
    )
    assert register.status_code == 201
    token = register.json()["access_token"]

    checkin = client.post(
        "/api/checkins",
        data={
            "content_text": "今天复习了函数、错题和笔记。",
            "checkin_date": "2026-06-30",
        },
        headers=auth_headers(token),
    )
    assert checkin.status_code == 201
    checkin_body = checkin.json()
    assert checkin_body["status"] == "scored"
    assert checkin_body["total_score"] > 0
    assert len(checkin_body["score_dimensions"]) == 4

    duplicate = client.post(
        "/api/checkins",
        data={"content_text": "重复打卡", "checkin_date": "2026-06-30"},
        headers=auth_headers(token),
    )
    assert duplicate.status_code == 409

    points = client.get("/api/points/me", headers=auth_headers(token))
    assert points.status_code == 200
    assert points.json()["current_points"] == checkin_body["awarded_points"]

    calendar = client.get("/api/checkins/calendar?year=2026&month=6", headers=auth_headers(token))
    assert calendar.status_code == 200
    assert calendar.json()["days"][0]["day"] == 30

    rewards = client.get("/api/rewards", headers=auth_headers(token))
    assert rewards.status_code == 200
    reward = rewards.json()[0]
    assert reward["can_redeem"] is True

    redemption = client.post(
        "/api/redemptions",
        json={"reward_id": reward["id"]},
        headers=auth_headers(token),
    )
    assert redemption.status_code == 201
    assert redemption.json()["reward_name"] == "专属头像框"

    redemptions = client.get("/api/redemptions/me", headers=auth_headers(token))
    assert redemptions.status_code == 200
    assert len(redemptions.json()) == 1
