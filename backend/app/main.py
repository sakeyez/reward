from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from backend.app.api.routes import admin, auth, checkins, points, rewards, users
from backend.app.core.config import get_settings


settings = get_settings()
UPLOAD_DIR = Path(settings.upload_dir)
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

app = FastAPI(
    title="Reward API",
    description="Backend API for the AI learning check-in and points reward system.",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(checkins.router, prefix="/api")
app.include_router(points.router, prefix="/api")
app.include_router(rewards.rewards_router, prefix="/api")
app.include_router(rewards.redemptions_router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
