import base64
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import httpx
from pydantic import BaseModel, Field, ValidationError, field_validator

from backend.app.core.config import get_settings
from backend.app.models.checkin import Checkin
from backend.app.services.ai_settings_service import AiRuntimeConfig


class AiScorePayload(BaseModel):
    valid: bool = True
    risk_factor: float = Field(default=1.0, ge=0, le=1)
    note_words: int = Field(default=0, ge=0)
    neatness_score: int = Field(ge=0, le=100)
    accuracy_score: int = Field(ge=0, le=100)
    note_quality_score: int = Field(ge=0, le=100)
    comment: str = Field(min_length=1, max_length=1000)
    advice: str = Field(min_length=1, max_length=1000)

    @field_validator("risk_factor", mode="before")
    @classmethod
    def normalize_risk_factor(cls, value: Any) -> float:
        if isinstance(value, str):
            normalized = value.strip().lower()
            mapping = {
                "low": 1.0,
                "normal": 1.0,
                "none": 1.0,
                "medium": 0.5,
                "moderate": 0.5,
                "high": 0.5,
                "invalid": 0.0,
                "cheating": 0.0,
            }
            if normalized in mapping:
                return mapping[normalized]
        return value


@dataclass(frozen=True)
class AiScoreResult:
    payload: AiScorePayload
    raw_json: str


class AiScoringError(RuntimeError):
    pass


async def score_with_ai(checkin: Checkin, config: AiRuntimeConfig) -> AiScoreResult:
    if not config.enabled or not config.api_key:
        raise AiScoringError("AI scoring is not configured")

    messages = [
        {
            "role": "system",
            "content": (
                "你是学习打卡评分助手。请只返回严格 JSON，不要 Markdown。"
                "根据学习笔记、做题记录、学习时间和题量，判断内容是否有效，"
                "并给出 risk_factor、note_words、neatness_score、accuracy_score、"
                "note_quality_score、comment、advice。"
                "risk_factor 必须是数字：正常 1，疑似异常 0.5，无效或作弊 0；"
                "所有 score 字段必须是 0 到 100 的整数，note_words 必须是整数。"
            ),
        },
        {"role": "user", "content": _build_user_content(checkin)},
    ]
    request_body = {
        "model": config.model,
        "messages": messages,
        "temperature": 0.2,
        "response_format": {"type": "json_object"},
    }

    try:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                f"{config.base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json=request_body,
            )
            response.raise_for_status()
            data = response.json()
    except (httpx.HTTPError, ValueError) as exc:
        raise AiScoringError(f"AI request failed: {exc}") from exc

    try:
        content = data["choices"][0]["message"]["content"]
        parsed = json.loads(content)
        payload = AiScorePayload.model_validate(parsed)
    except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as exc:
        raise AiScoringError(f"AI response was not valid scoring JSON: {exc}") from exc

    return AiScoreResult(payload=payload, raw_json=json.dumps(parsed, ensure_ascii=False))


async def test_ai_connection(config: AiRuntimeConfig) -> str:
    if not config.api_key:
        raise AiScoringError("API key is required")
    request_body = {
        "model": config.model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "你是学习打卡评分助手。请只返回严格 JSON，不要 Markdown。"
                    "字段必须包含 valid, risk_factor, note_words, neatness_score, "
                    "accuracy_score, note_quality_score, comment, advice。"
                    "risk_factor 必须是数字 0、0.5 或 1。score 字段必须是 0 到 100 的整数。"
                ),
            },
            {
                "role": "user",
                "content": (
                    "测试样例：学习 60 分钟，完成 20 道题，笔记结构清晰，内容有效。"
                    "请返回一份可用于系统解析的评分 JSON。"
                ),
            },
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    try:
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.post(
                f"{config.base_url.rstrip('/')}/chat/completions",
                headers={"Authorization": f"Bearer {config.api_key}"},
                json=request_body,
            )
            response.raise_for_status()
    except httpx.HTTPError as exc:
        raise AiScoringError(f"AI connection failed: {exc}") from exc
    try:
        data = response.json()
        content = data["choices"][0]["message"]["content"]
        AiScorePayload.model_validate(json.loads(content))
    except (KeyError, IndexError, TypeError, json.JSONDecodeError, ValidationError) as exc:
        raise AiScoringError(f"AI returned JSON, but it did not match scoring schema: {exc}") from exc
    return "AI connection and scoring schema test succeeded"


def _build_user_content(checkin: Checkin) -> list[dict[str, Any]]:
    content: list[dict[str, Any]] = [
        {
            "type": "text",
            "text": (
                f"学习日期：{checkin.checkin_date.isoformat()}\n"
                f"学习时长分钟：{checkin.study_time_minutes}\n"
                f"做题数量：{checkin.question_count}\n"
                f"用户文字说明：{checkin.content_text or '无'}\n"
                "评分标准：工整度看图片清晰度、字迹和步骤；准确率只看做题内容；"
                "笔记质量看结构、重点、理解和复盘。无对应内容时该项给 0，并在 comment 说明。"
            ),
        },
    ]
    for label, image_url in [("学习笔记图片", checkin.note_image_url or checkin.image_url), ("做题记录图片", checkin.exercise_image_url)]:
        data_url = _image_url_to_data_url(image_url)
        if data_url:
            content.append({"type": "text", "text": label})
            content.append({"type": "image_url", "image_url": {"url": data_url}})
    return content


def _image_url_to_data_url(image_url: str | None) -> str | None:
    if not image_url or not image_url.startswith("/uploads/"):
        return None
    settings = get_settings()
    relative_path = image_url.removeprefix("/uploads/").replace("/", "\\")
    path = Path(settings.upload_dir) / relative_path
    if not path.exists() or not path.is_file():
        return None
    suffix = path.suffix.lower().lstrip(".") or "jpeg"
    mime = "jpeg" if suffix == "jpg" else suffix
    encoded = base64.b64encode(path.read_bytes()).decode("ascii")
    return f"data:image/{mime};base64,{encoded}"
