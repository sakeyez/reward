from pathlib import Path

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles

from backend.app.api.routes import auth, users
from backend.app.core.config import get_settings


settings = get_settings()
UPLOAD_DIR = Path(settings.upload_dir)

app = FastAPI(
    title="Reward API",
    description="Backend API for the AI learning check-in and points reward system.",
    version="0.1.0",
)

app.include_router(auth.router, prefix="/api")
app.include_router(users.router, prefix="/api")


@app.get("/api/health")
async def health_check() -> dict[str, str]:
    return {"status": "ok"}


if UPLOAD_DIR.exists():
    app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")
