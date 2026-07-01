from dataclasses import dataclass
from math import exp


@dataclass(frozen=True)
class RewardFormulaInput:
    study_time_minutes: int
    note_words: int
    question_count: int
    neatness_score: int
    accuracy_score: int
    note_quality_score: int
    streak_days: int
    risk_factor: float = 1.0


@dataclass(frozen=True)
class RewardFormulaResult:
    total_score: int
    awarded_points: int
    time_component: float
    note_component: float
    exercise_component: float
    neatness_coefficient: float
    accuracy_coefficient: float
    note_quality_coefficient: float
    streak_coefficient: float
    workload_score: int


def calculate_reward(input_data: RewardFormulaInput) -> RewardFormulaResult:
    study_time = max(0, input_data.study_time_minutes)
    note_words = max(0, input_data.note_words)
    question_count = max(0, input_data.question_count)
    neatness = _clamp_score(input_data.neatness_score)
    accuracy = _clamp_score(input_data.accuracy_score)
    note_quality = _clamp_score(input_data.note_quality_score)
    streak_days = max(1, input_data.streak_days)
    risk_factor = max(0.0, min(1.0, input_data.risk_factor))

    time_component = 20 * (1 - exp(-study_time / 60))
    note_component = 30 * (1 - exp(-note_words / 800))
    exercise_component = 30 * (1 - exp(-question_count / 20))
    neatness_coefficient = 0.85 + 0.30 * neatness / 100
    accuracy_coefficient = 0.60 + 1.00 * accuracy / 100
    note_quality_coefficient = 0.60 + 1.00 * note_quality / 100
    streak_coefficient = min(2.0, 1 + 0.0333 * streak_days)

    raw = (
        20
        + time_component
        + note_component * note_quality_coefficient * neatness_coefficient
        + exercise_component * accuracy_coefficient * neatness_coefficient
    ) * streak_coefficient * risk_factor
    awarded_points = min(300, round(raw))
    total_score = round((neatness + accuracy + note_quality) / 3)
    workload_score = min(100, round((time_component + note_component + exercise_component) / 80 * 100))

    return RewardFormulaResult(
        total_score=total_score,
        awarded_points=awarded_points,
        time_component=time_component,
        note_component=note_component,
        exercise_component=exercise_component,
        neatness_coefficient=neatness_coefficient,
        accuracy_coefficient=accuracy_coefficient,
        note_quality_coefficient=note_quality_coefficient,
        streak_coefficient=streak_coefficient,
        workload_score=workload_score,
    )


def _clamp_score(value: int) -> int:
    return max(0, min(100, int(value)))
