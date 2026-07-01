from collections.abc import Generator
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from backend.app.core.security import hash_password
from backend.app.db.base import Base
from backend.app.db.session import get_db_session
from backend.app.main import app
from backend.app.models.reward import Reward, RewardStatus
from backend.app.models.user import Role, User, UserRole, UserStatus
from backend.app.services.ai_scoring_service import AiScorePayload, AiScoreResult


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
            user_role = Role(code="user", name="普通用户")
            admin_role = Role(code="admin", name="管理员")
            super_admin_role = Role(code="super_admin", name="超级管理员")
            session.add_all([user_role, admin_role, super_admin_role])
            await session.flush()
            admin = User(
                username="admin",
                password_hash=hash_password("admin123456"),
                display_name="Admin",
                status=UserStatus.active,
            )
            session.add(admin)
            await session.flush()
            session.add_all(
                [
                    UserRole(user_id=admin.id, role_id=user_role.id),
                    UserRole(user_id=admin.id, role_id=admin_role.id),
                    UserRole(user_id=admin.id, role_id=super_admin_role.id),
                    Reward(
                        name="测试奖励",
                        category="虚拟奖励",
                        description="测试奖励",
                        cost_points=50,
                        stock=5,
                        status=RewardStatus.active,
                    ),
                ],
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


def login(client: TestClient, identifier: str, password: str) -> str:
    response = client.post("/api/auth/login", json={"identifier": identifier, "password": password})
    assert response.status_code == 200, response.json()
    return response.json()["access_token"]


def register_user(client: TestClient) -> str:
    response = client.post(
        "/api/auth/register",
        json={
            "username": "student",
            "password": "password123",
            "display_name": "Student",
        },
    )
    assert response.status_code == 201, response.json()
    return response.json()["access_token"]


def test_admin_permissions_and_operations(client: TestClient) -> None:
    user_token = register_user(client)
    admin_token = login(client, "admin", "admin123456")

    forbidden = client.get("/api/admin/summary", headers=auth_headers(user_token))
    assert forbidden.status_code == 403

    summary = client.get("/api/admin/summary", headers=auth_headers(admin_token))
    assert summary.status_code == 200
    assert summary.json()["users_total"] == 2

    users = client.get("/api/admin/users", headers=auth_headers(admin_token))
    assert users.status_code == 200
    student = next(item for item in users.json()["items"] if item["username"] == "student")

    adjustment = client.post(
        f"/api/admin/users/{student['id']}/point-adjustments",
        json={"amount": 100, "reason": "运营补发积分"},
        headers=auth_headers(admin_token),
    )
    assert adjustment.status_code == 200
    assert adjustment.json()["type"] == "admin_adjustment"
    assert adjustment.json()["balance_after"] == 100

    overdraw = client.post(
        f"/api/admin/users/{student['id']}/point-adjustments",
        json={"amount": -200, "reason": "扣除积分"},
        headers=auth_headers(admin_token),
    )
    assert overdraw.status_code == 400

    disabled = client.patch(
        f"/api/admin/users/{student['id']}",
        json={"status": "disabled"},
        headers=auth_headers(admin_token),
    )
    assert disabled.status_code == 200
    assert disabled.json()["status"] == "disabled"

    login_disabled = client.post("/api/auth/login", json={"identifier": "student", "password": "password123"})
    assert login_disabled.status_code == 401

    reward = client.post(
        "/api/admin/rewards",
        json={
            "name": "管理端新奖励",
            "category": "课程",
            "description": "管理端创建",
            "cost_points": 30,
            "stock": 2,
            "status": "active",
        },
        headers=auth_headers(admin_token),
    )
    assert reward.status_code == 201
    reward_id = reward.json()["id"]

    inactive = client.patch(
        f"/api/admin/rewards/{reward_id}",
        json={"status": "inactive"},
        headers=auth_headers(admin_token),
    )
    assert inactive.status_code == 200
    assert inactive.json()["status"] == "inactive"


def test_super_admin_can_manage_ai_settings(client: TestClient) -> None:
    user_token = register_user(client)
    admin_token = login(client, "admin", "admin123456")

    forbidden = client.get("/api/admin/ai-settings", headers=auth_headers(user_token))
    assert forbidden.status_code == 403

    updated = client.patch(
        "/api/admin/ai-settings",
        json={
            "enabled": True,
            "base_url": "https://example.test/v1",
            "model": "test-model",
            "api_key": "sk-test-secret",
        },
        headers=auth_headers(admin_token),
    )
    assert updated.status_code == 200
    body = updated.json()
    assert body["enabled"] is True
    assert body["base_url"] == "https://example.test/v1"
    assert body["model"] == "test-model"
    assert body["api_key_masked"] == "sk-...cret"

    loaded = client.get("/api/admin/ai-settings", headers=auth_headers(admin_token))
    assert loaded.status_code == 200
    assert loaded.json()["api_key_masked"] == "sk-...cret"
    assert "sk-test-secret" not in loaded.text


def test_admin_cancel_redemption_refunds_points_and_stock(client: TestClient) -> None:
    user_token = register_user(client)
    admin_token = login(client, "admin", "admin123456")

    users = client.get("/api/admin/users?q=student", headers=auth_headers(admin_token))
    student = users.json()["items"][0]
    client.post(
        f"/api/admin/users/{student['id']}/point-adjustments",
        json={"amount": 100, "reason": "测试积分"},
        headers=auth_headers(admin_token),
    )

    rewards = client.get("/api/rewards", headers=auth_headers(user_token))
    reward = rewards.json()[0]
    redemption = client.post(
        "/api/redemptions",
        json={"reward_id": reward["id"]},
        headers=auth_headers(user_token),
    )
    assert redemption.status_code == 201

    cancelled = client.patch(
        f"/api/admin/redemptions/{redemption.json()['id']}",
        json={"status": "cancelled"},
        headers=auth_headers(admin_token),
    )
    assert cancelled.status_code == 200
    assert cancelled.json()["status"] == "cancelled"

    points = client.get("/api/points/me", headers=auth_headers(user_token))
    assert points.status_code == 200
    assert points.json()["current_points"] == 100
    assert any(item["type"] == "refund" for item in points.json()["transactions"])

    processed_again = client.patch(
        f"/api/admin/redemptions/{redemption.json()['id']}",
        json={"status": "fulfilled"},
        headers=auth_headers(admin_token),
    )
    assert processed_again.status_code == 409


def test_admin_can_reset_checkin_and_refund_awarded_points(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_score_with_ai(checkin, config):
        return AiScoreResult(
            payload=AiScorePayload(
                valid=True,
                risk_factor=1,
                note_words=800,
                neatness_score=80,
                accuracy_score=80,
                note_quality_score=80,
                comment="有效打卡",
                advice="继续保持",
            ),
            raw_json='{"valid": true}',
        )

    monkeypatch.setattr("backend.app.services.checkin_service.score_with_ai", fake_score_with_ai)
    user_token = register_user(client)
    admin_token = login(client, "admin", "admin123456")

    created = client.post(
        "/api/checkins",
        data={
            "content_text": "今天认真复习。",
            "checkin_date": "2026-07-01",
            "study_time_minutes": "60",
            "question_count": "20",
        },
        headers=auth_headers(user_token),
    )
    assert created.status_code == 201

    checkins = client.get("/api/admin/checkins", headers=auth_headers(admin_token))
    item = checkins.json()["items"][0]
    assert item["awarded_points"] > 0

    reset = client.delete(f"/api/admin/checkins/{item['id']}", headers=auth_headers(admin_token))
    assert reset.status_code == 204

    points = client.get("/api/points/me", headers=auth_headers(user_token))
    assert points.json()["current_points"] == 0
    assert any(transaction["related_type"] == "checkin_reset" for transaction in points.json()["transactions"])

    recreated = client.post(
        "/api/checkins",
        data={"content_text": "重新提交", "checkin_date": "2026-07-01"},
        headers=auth_headers(user_token),
    )
    assert recreated.status_code == 201
