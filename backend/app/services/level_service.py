from dataclasses import dataclass


@dataclass(frozen=True)
class LevelInfo:
    code: str
    name: str
    label: str
    current_level_points: int
    next_level_points: int | None
    progress_percent: int
    points_to_next_level: int
    is_max_level: bool


LEVELS: tuple[tuple[int, str, str], ...] = (
    (0, "lv2", "起步认真"),
    (300, "lv3", "稳定进步"),
    (800, "lv4", "学习能量"),
    (1500, "lv5", "坚持达人"),
    (3000, "lv6", "复盘高手"),
)


def calculate_level(points: int) -> LevelInfo:
    current_points = max(0, points)
    current_index = 0
    for index, (threshold, _, _) in enumerate(LEVELS):
        if current_points >= threshold:
            current_index = index
        else:
            break

    threshold, code, name = LEVELS[current_index]
    level_number = code.removeprefix("lv")
    next_threshold = LEVELS[current_index + 1][0] if current_index + 1 < len(LEVELS) else None
    is_max_level = next_threshold is None

    if is_max_level:
        progress_percent = 100
        points_to_next_level = 0
    else:
        span = max(1, next_threshold - threshold)
        progress_percent = max(0, min(100, round((current_points - threshold) / span * 100)))
        points_to_next_level = max(next_threshold - current_points, 0)

    return LevelInfo(
        code=code,
        name=name,
        label=f"Lv.{level_number} {name}",
        current_level_points=threshold,
        next_level_points=next_threshold,
        progress_percent=progress_percent,
        points_to_next_level=points_to_next_level,
        is_max_level=is_max_level,
    )
