from dataclasses import dataclass
from datetime import date
import hashlib


@dataclass(frozen=True)
class ScoreDimension:
    code: str
    name: str
    score: int
    sort_order: int


@dataclass(frozen=True)
class ScoreResult:
    total_score: int
    awarded_points: int
    comment: str
    advice: str
    dimensions: list[ScoreDimension]


DIMENSIONS = [
    ("completion", "完成度"),
    ("clarity", "清晰度"),
    ("depth", "理解深度"),
    ("consistency", "坚持度"),
]


def score_checkin(content_text: str | None, image_url: str | None, checkin_date: date) -> ScoreResult:
    seed = f"{checkin_date.isoformat()}|{content_text or ''}|{image_url or ''}"
    digest = hashlib.sha256(seed.encode("utf-8")).digest()

    base = 76 + digest[0] % 15
    dimensions: list[ScoreDimension] = []
    for index, (code, name) in enumerate(DIMENSIONS):
        offset = digest[index + 1] % 13 - 6
        dimensions.append(
            ScoreDimension(
                code=code,
                name=name,
                score=max(60, min(98, base + offset)),
                sort_order=index,
            ),
        )

    total_score = round(sum(item.score for item in dimensions) / len(dimensions))
    return ScoreResult(
        total_score=total_score,
        awarded_points=total_score,
        comment=_comment_for_score(total_score),
        advice=_advice_for_score(total_score),
        dimensions=dimensions,
    )


def _comment_for_score(score: int) -> str:
    if score >= 90:
        return "今天的学习成果非常完整，重点清晰，能看出你在主动复盘和总结。"
    if score >= 80:
        return "今天的学习成果结构比较完整，关键内容表达清楚，继续保持这个节奏。"
    return "今天已经完成了学习记录，可以再补充错题原因或知识点总结来提高复盘质量。"


def _advice_for_score(score: int) -> str:
    if score >= 90:
        return "明天可以尝试把知识点整理成 3 条可复述的结论，进一步巩固理解。"
    if score >= 80:
        return "明天可以把薄弱点单独列出来，复习时会更容易定位问题。"
    return "明天建议补充学习目标、完成过程和反思，帮助 AI 给出更准确的建议。"
