from backend.app.services.level_service import calculate_level


def test_calculate_level_progress_between_thresholds() -> None:
    level = calculate_level(1401)

    assert level.code == "lv4"
    assert level.name == "学习能量"
    assert level.label == "Lv.4 学习能量"
    assert level.current_level_points == 800
    assert level.next_level_points == 1500
    assert level.progress_percent == 86
    assert level.points_to_next_level == 99
    assert level.is_max_level is False


def test_calculate_level_max_level() -> None:
    level = calculate_level(3000)

    assert level.code == "lv6"
    assert level.progress_percent == 100
    assert level.points_to_next_level == 0
    assert level.next_level_points is None
    assert level.is_max_level is True
