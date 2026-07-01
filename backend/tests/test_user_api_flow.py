from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.app.db.base import Base
from backend.app.db.session import get_db_session
from backend.app.main import app
from backend.app.models.reward import Reward, RewardStatus
from backend.app.models.user import User
from backend.app.services.ai_scoring_service import AiScorePayload, AiScoreResult
from backend.app.services.checkin_service import analyze_checkin
from backend.app.services.reward_formula_service import RewardFormulaInput, calculate_reward


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


def test_user_checkin_points_and_redemption_flow(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    async def fake_score_with_ai(checkin, config):
        return AiScoreResult(
            payload=AiScorePayload(
                valid=True,
                risk_factor=1,
                note_words=800,
                neatness_score=70,
                accuracy_score=70,
                note_quality_score=70,
                comment="学习记录有效。",
                advice="继续复盘。",
            ),
            raw_json='{"valid": true}',
        )

    monkeypatch.setattr("backend.app.services.checkin_service.score_with_ai", fake_score_with_ai)
    register = client.post(
        "/api/auth/register",
        json={
            "username": "api_user",
            "password": "password123",
            "display_name": "API User",
        },
    )
    assert register.status_code == 201
    register_body = register.json()
    token = register_body["access_token"]
    assert register_body["user"]["level"]["label"] == "Lv.2 起步认真"

    me = client.get("/api/users/me", headers=auth_headers(token))
    assert me.status_code == 200
    assert me.json()["level"]["code"] == "lv2"

    checkin = client.post(
        "/api/checkins",
        data={
            "content_text": "今天复习了函数、错题和笔记。",
            "checkin_date": "2026-06-30",
            "study_time_minutes": "60",
            "question_count": "20",
        },
        headers=auth_headers(token),
    )
    assert checkin.status_code == 201
    checkin_body = checkin.json()
    assert checkin_body["status"] == "analyzing"

    import asyncio

    async def score_created_checkin() -> dict:
        async for session in client.app.dependency_overrides[get_db_session]():
            user = await session.get(User, 1)
            user.streak_days = 0
            scored = await analyze_checkin(session, checkin_body["id"])
            return {
                "status": scored.status.value,
                "total_score": scored.total_score,
                "awarded_points": scored.awarded_points,
                "dimensions": len(scored.score_dimensions),
            }
        raise AssertionError("session unavailable")

    scored_body = asyncio.run(score_created_checkin())
    assert scored_body["status"] == "scored"
    assert scored_body["total_score"] > 0
    assert scored_body["dimensions"] == 4
    expected_reward = calculate_reward(
        RewardFormulaInput(
            study_time_minutes=60,
            note_words=800,
            question_count=20,
            neatness_score=70,
            accuracy_score=70,
            note_quality_score=70,
            streak_days=1,
        ),
    ).awarded_points
    assert scored_body["awarded_points"] == expected_reward

    duplicate = client.post(
        "/api/checkins",
        data={"content_text": "重复打卡", "checkin_date": "2026-06-30"},
        headers=auth_headers(token),
    )
    assert duplicate.status_code == 409

    points = client.get("/api/points/me", headers=auth_headers(token))
    assert points.status_code == 200
    assert points.json()["current_points"] == scored_body["awarded_points"]

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


def test_user_can_update_profile(client: TestClient) -> None:
    register = client.post(
        "/api/auth/register",
        json={
            "username": "profile_user",
            "password": "password123",
            "display_name": "Before",
        },
    )
    assert register.status_code == 201
    token = register.json()["access_token"]

    update = client.patch(
        "/api/users/me",
        data={"display_name": "After"},
        files={"avatar": ("avatar.png", b"fake-image-bytes", "image/png")},
        headers=auth_headers(token),
    )
    assert update.status_code == 200
    body = update.json()
    assert body["display_name"] == "After"
    assert body["avatar_url"].startswith("/uploads/avatars/")
