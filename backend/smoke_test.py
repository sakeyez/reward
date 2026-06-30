import json
import subprocess
import sys
import time
from datetime import date, timedelta
from pathlib import Path
from uuid import uuid4
from urllib import error, request


ROOT_DIR = Path(__file__).resolve().parents[1]
BASE_URL = "http://127.0.0.1:8010"


def request_json(method: str, path: str, payload: dict | None = None, token: str | None = None) -> tuple[int, dict]:
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    headers = {"Accept": "application/json"}
    if payload is not None:
        headers["Content-Type"] = "application/json"
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(f"{BASE_URL}{path}", data=data, method=method, headers=headers)
    try:
        with request.urlopen(req, timeout=5) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body = exc.read().decode("utf-8")
        return exc.code, json.loads(body) if body else {}


def request_form(method: str, path: str, fields: dict[str, str], token: str | None = None) -> tuple[int, dict]:
    boundary = f"----reward-smoke-{uuid4().hex}"
    body = bytearray()
    for name, value in fields.items():
        body.extend(f"--{boundary}\r\n".encode("utf-8"))
        body.extend(f'Content-Disposition: form-data; name="{name}"\r\n\r\n'.encode("utf-8"))
        body.extend(str(value).encode("utf-8"))
        body.extend(b"\r\n")
    body.extend(f"--{boundary}--\r\n".encode("utf-8"))

    headers = {
        "Accept": "application/json",
        "Content-Type": f"multipart/form-data; boundary={boundary}",
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    req = request.Request(f"{BASE_URL}{path}", data=bytes(body), method=method, headers=headers)
    try:
        with request.urlopen(req, timeout=5) as response:
            return response.status, json.loads(response.read().decode("utf-8"))
    except error.HTTPError as exc:
        body_text = exc.read().decode("utf-8")
        return exc.code, json.loads(body_text) if body_text else {}


def wait_for_server() -> None:
    for _ in range(30):
        try:
            status, _ = request_json("GET", "/api/health")
            if status == 200:
                return
        except Exception:
            pass
        time.sleep(0.5)
    raise RuntimeError("Server did not become ready")


def main() -> None:
    subprocess.run([sys.executable, "backend/seed.py"], cwd=ROOT_DIR, check=True)
    server = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "backend.app.main:app", "--port", "8010"],
        cwd=ROOT_DIR,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    try:
        wait_for_server()
        username = f"smoke_{int(time.time())}"
        status, register = request_json(
            "POST",
            "/api/auth/register",
            {
                "username": username,
                "password": "password123",
                "display_name": "Smoke Test",
            },
        )
        assert status == 201, register
        token = register["access_token"]

        first_checkin = None
        for days_ago in range(8, -1, -1):
            checkin_date = (date.today() - timedelta(days=days_ago)).isoformat()
            status, checkin = request_form(
                "POST",
                "/api/checkins",
                {"content_text": "今天复习了函数和错题。", "checkin_date": checkin_date},
                token,
            )
            assert status == 201, checkin
            first_checkin = first_checkin or checkin

        status, points = request_json("GET", "/api/points/me", token=token)
        assert status == 200 and points["current_points"] > 0, points

        status, rewards = request_json("GET", "/api/rewards", token=token)
        assert status == 200 and rewards, rewards

        affordable = next((item for item in rewards if item["can_redeem"]), None)
        assert affordable is not None, {"points": points, "rewards": rewards, "first_checkin": first_checkin}
        status, redemption = request_json(
            "POST",
            "/api/redemptions",
            {"reward_id": affordable["id"]},
            token,
        )
        assert status == 201, redemption

        print("Smoke test passed")
    finally:
        server.terminate()
        server.wait(timeout=10)


if __name__ == "__main__":
    main()
