from __future__ import annotations

import json
import math
import re
from datetime import date, datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.services import dashboard_data_service as data_service

LOCAL_TIMEZONE = ZoneInfo("Asia/Colombo")
MONTHS = {
    "jan": 1,
    "january": 1,
    "feb": 2,
    "february": 2,
    "mar": 3,
    "march": 3,
    "apr": 4,
    "april": 4,
    "may": 5,
    "jun": 6,
    "june": 6,
    "jul": 7,
    "july": 7,
    "aug": 8,
    "august": 8,
    "sep": 9,
    "sept": 9,
    "september": 9,
    "oct": 10,
    "october": 10,
    "nov": 11,
    "november": 11,
    "dec": 12,
    "december": 12,
}
METRIC_LABELS = {
    "dust": "Dust",
    "air_quality": "Air Quality",
    "temperature": "Temperature",
    "humidity": "Humidity",
}
METRIC_UNITS = {
    "dust": "PM ug/m3",
    "air_quality": "AQI proxy",
    "temperature": "C",
    "humidity": "%",
}


def answer_known_question(messages: list[dict[str, Any]], dashboard_context: dict[str, Any] | None) -> str | None:
    if not messages:
        return None

    user_input = str(messages[-1].get("content") or "").strip()
    if not user_input:
        return None

    context = dashboard_context or {}
    text = _clean_text(user_input)

    if _asks_current_date(text):
        return f"Today is {_today().strftime('%d-%b-%Y')}."

    follow_up = _answer_follow_up_if_needed(messages, context)
    if follow_up:
        return follow_up

    if _is_sessions_by_date_question(text):
        target_date = _extract_date(text) or _context_date(context) or _today()
        return _answer_sessions_by_date(target_date, context, user_input)

    if _is_sessions_for_house_question(text):
        house_id = _resolve_house_id(user_input, context)
        if not house_id:
            return "Which house should I check? Please send the house name, for example: Banet."
        return _answer_sessions_for_house(house_id)

    metric = _requested_trend_metric(text)
    if metric:
        house_id = _resolve_house_id(user_input, context)
        room_id = _resolve_room_id(user_input, context)
        missing = []
        if not house_id:
            missing.append("house")
        if not room_id:
            missing.append("room")
        if missing:
            return f"Please tell me the {' and '.join(missing)} so I can visualize the {METRIC_LABELS[metric].lower()} trend."
        date_from, date_to = _date_range_from_text_or_context(text, context)
        return _answer_metric_trend(house_id, room_id, metric, date_from, date_to)

    if _is_temperature_session_question(text):
        session_id = _extract_session_id(user_input)
        if session_id:
            return _answer_session_temperature(session_id)

        house_id = _resolve_house_id(user_input, context)
        room_id = _resolve_room_id(user_input, context)
        session_type = _context_session_type(context)
        date_from, date_to = _date_range_from_text_or_context(text, context)

        if not room_id:
            return "Which room/session should I use for the temperature change? Send the room name or the session ID."

        sessions = data_service.get_sessions(house_id, room_id, session_type, date_from, date_to)
        if not sessions:
            return "I could not find a matching session for that temperature question."
        if len(sessions) > 1:
            latest_session = sessions[-1]
            return _answer_session_temperature(latest_session["session_id"], note="I used the latest matching session.")
        return _answer_session_temperature(sessions[0]["session_id"])

    return None


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value.strip().lower())


def _today() -> date:
    return datetime.now(LOCAL_TIMEZONE).date()


def _asks_current_date(text: str) -> bool:
    return any(phrase in text for phrase in ("current date", "today date", "what date is it", "what is today"))


def _context_date(context: dict[str, Any]) -> date | None:
    date_range = context.get("date_range") or {}
    raw_value = date_range.get("from") or date_range.get("from_date")
    return _parse_date_value(raw_value)


def _context_session_type(context: dict[str, Any]) -> str | None:
    value = str(context.get("session_type") or "").strip().lower()
    return value if value and value != "all" else None


def _date_range_from_text_or_context(text: str, context: dict[str, Any]) -> tuple[str | None, str | None]:
    parsed = _extract_date(text)
    if parsed:
        return parsed.isoformat(), parsed.isoformat()

    date_range = context.get("date_range") or {}
    from_date = _parse_date_value(date_range.get("from") or date_range.get("from_date"))
    to_date = _parse_date_value(date_range.get("to") or date_range.get("to_date"))
    return (from_date.isoformat() if from_date else None, to_date.isoformat() if to_date else None)


def _parse_date_value(raw_value: Any) -> date | None:
    if not raw_value:
        return None
    text = str(raw_value).strip()
    for fmt in ("%Y-%m-%d", "%d-%b-%Y", "%d-%B-%Y", "%d/%m/%Y", "%m/%d/%Y"):
        try:
            return datetime.strptime(text, fmt).date()
        except ValueError:
            continue
    return None


def _extract_date(text: str) -> date | None:
    if "today" in text:
        return _today()
    if "yesterday" in text:
        return _today() - timedelta(days=1)

    iso_match = re.search(r"\b(20\d{2})-(\d{1,2})-(\d{1,2})\b", text)
    if iso_match:
        return _safe_date(int(iso_match.group(1)), int(iso_match.group(2)), int(iso_match.group(3)))

    named_match = re.search(r"\b(\d{1,2})[-\s]([a-zA-Z]{3,9})[-\s](20\d{2})\b", text)
    if named_match:
        month = MONTHS.get(named_match.group(2).lower())
        if month:
            return _safe_date(int(named_match.group(3)), month, int(named_match.group(1)))

    slash_match = re.search(r"\b(\d{1,2})/(\d{1,2})/(20\d{2})\b", text)
    if slash_match:
        first = int(slash_match.group(1))
        second = int(slash_match.group(2))
        year = int(slash_match.group(3))
        if first > 12:
            return _safe_date(year, second, first)
        return _safe_date(year, first, second)

    return None


def _safe_date(year: int, month: int, day: int) -> date | None:
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _is_sessions_by_date_question(text: str) -> bool:
    return "session" in text and any(word in text for word in ("happened", "on", "date", "today", "yesterday"))


def _is_sessions_for_house_question(text: str) -> bool:
    return "session" in text and "house" in text and any(word in text for word in ("show", "list", "all", "for"))


def _requested_trend_metric(text: str) -> str | None:
    wants_visual = any(word in text for word in ("visualize", "trend", "graph", "chart", "show"))
    if not wants_visual:
        return None
    if "dust" in text:
        return "dust"
    if "air quality" in text or re.search(r"\bair\b", text):
        return "air_quality"
    if "temperature" in text or "temp" in text:
        return "temperature"
    if "humidity" in text:
        return "humidity"
    return None


def _is_temperature_session_question(text: str) -> bool:
    return "temperature" in text and any(word in text for word in ("change", "changed", "during", "session"))


def _extract_session_id(text: str) -> str | None:
    match = re.search(r"\b(session_[a-zA-Z0-9_-]+)\b", text)
    return match.group(1) if match else None


def _answer_follow_up_if_needed(messages: list[dict[str, Any]], context: dict[str, Any]) -> str | None:
    if len(messages) < 2:
        return None
    previous = str(messages[-2].get("content") or "").lower()
    current = str(messages[-1].get("content") or "").strip()
    if "which house should i check" in previous:
        return _answer_sessions_for_house(current)
    if "tell me the house" in previous or "tell me the house and room" in previous:
        house_id = _resolve_house_id(current, context)
        room_id = _resolve_room_id(current, context)
        if house_id and room_id:
            metric = _requested_trend_metric(previous) or "dust"
            date_from, date_to = _date_range_from_text_or_context(_clean_text(current), context)
            return _answer_metric_trend(house_id, room_id, metric, date_from, date_to)
    return None


def _known_sessions() -> list[dict[str, Any]]:
    try:
        return data_service.get_sessions()
    except Exception:
        return []


def _resolve_house_id(question: str, context: dict[str, Any]) -> str | None:
    known_houses = sorted({row["house_id"] for row in _known_sessions() if row.get("house_id")}, key=len, reverse=True)
    lowered = question.lower()
    for house_id in known_houses:
        if house_id.lower() in lowered:
            return house_id

    match = re.search(r"\bhouse(?:\s+(?:id|name))?\s*(?:is|=|:)?\s+([a-zA-Z0-9 _-]+)", question, re.IGNORECASE)
    if match:
        return _trim_entity(match.group(1))
    context_house = str(context.get("house_id") or "").strip()
    if context_house:
        return context_house
    return None


def _resolve_room_id(question: str, context: dict[str, Any]) -> str | None:
    known_rooms = sorted({row["room_id"] for row in _known_sessions() if row.get("room_id")}, key=len, reverse=True)
    lowered = question.lower()
    for room_id in known_rooms:
        if room_id.lower() in lowered:
            return room_id

    match = re.search(r"\broom(?:\s+(?:id|name))?\s*(?:is|=|:)?\s+([a-zA-Z0-9 _-]+)", question, re.IGNORECASE)
    if match:
        return _trim_entity(match.group(1))
    context_room = str(context.get("room_id") or "").strip()
    if context_room:
        return context_room
    return None


def _trim_entity(value: str) -> str:
    return re.split(
        r"\b(?:on|for|from|to|and|with|session|date|room|house)\b",
        value,
        flags=re.IGNORECASE,
    )[0].strip(" .,:;-")


def _answer_sessions_by_date(target_date: date, context: dict[str, Any], question: str) -> str:
    house_id = _resolve_house_id(question, context)
    room_id = _resolve_room_id(question, context)
    sessions = data_service.get_sessions(house_id, room_id, None, target_date.isoformat(), target_date.isoformat())
    label = target_date.strftime("%d-%b-%Y")
    if not sessions:
        scope = _scope_label(house_id, room_id)
        return f"No sessions were found on {label}{scope}."
    lines = [f"{len(sessions)} session(s) happened on {label}{_scope_label(house_id, room_id)}:"]
    lines.extend(_format_session_lines(sessions))
    return "\n".join(lines)


def _answer_sessions_for_house(house_id: str) -> str:
    sessions = data_service.get_sessions(house_id=house_id)
    if not sessions:
        return f"I could not find any sessions for house '{house_id}'. Please check the house name."
    lines = [f"I found {len(sessions)} session(s) for house {house_id}:"]
    lines.extend(_format_session_lines(sessions))
    return "\n".join(lines)


def _format_session_lines(sessions: list[dict[str, Any]]) -> list[str]:
    lines: list[str] = []
    for index, session in enumerate(sessions[:20], start=1):
        session_date = session.get("session_date") or _short_date(session.get("start_time"))
        lines.append(
            f"{index}. {session.get('house_id', '-')} / {session.get('room_id', '-')} | "
            f"{session.get('session_type', '-')} | {session.get('status', '-')} | "
            f"{session.get('total_readings', 0)} readings | {session_date or 'date unknown'}"
        )
    if len(sessions) > 20:
        lines.append(f"...and {len(sessions) - 20} more session(s).")
    return lines


def _answer_metric_trend(
    house_id: str,
    room_id: str,
    metric: str,
    date_from: str | None,
    date_to: str | None,
) -> str:
    trend = data_service.get_trend_data(house_id, room_id, metric, date_from, date_to, None)
    if trend.get("status") != "success":
        return str(trend.get("message") or "I could not load the trend data.")

    points = trend.get("points") or []
    label = METRIC_LABELS[metric]
    range_text = _range_label(date_from, date_to)
    if not points:
        return f"No {label.lower()} trend data was found for {house_id} / {room_id}{range_text}."

    summary = trend.get("summary") or {}
    values = [float(point["value"]) for point in points if isinstance(point.get("value"), (int, float))]
    first = values[0]
    last = values[-1]
    delta = round(last - first, 2)
    direction = "increased" if delta > 0 else "decreased" if delta < 0 else "stayed flat"

    lines = [
        f"{label} trend for {house_id} / {room_id}{range_text}",
        f"Points: {len(points)} | Average: {_fmt(summary.get('avg'))} {METRIC_UNITS[metric]} | "
        f"Min: {_fmt(summary.get('min'))} | Max: {_fmt(summary.get('max'))}",
        f"Overall change: {direction} by {abs(delta):.2f} {METRIC_UNITS[metric]} from first to last reading.",
        "",
        "Trend sample:",
        *_sparkline_rows(points, metric),
    ]
    return "\n".join(lines) + "\n\n" + _chart_marker(metric, _chart_points_from_trend(points, metric))


def _answer_session_temperature(session_id: str, note: str | None = None) -> str:
    session = data_service.get_session(session_id)
    if not session:
        return f"I could not find session {session_id}."

    readings = data_service.get_session_readings(session_id)
    values = [float(row["temperature"]) for row in readings if isinstance(row.get("temperature"), (int, float))]
    if not values:
        return f"I found the session, but it has no temperature readings."

    first = values[0]
    last = values[-1]
    delta = round(last - first, 2)
    direction = "increased" if delta > 0 else "decreased" if delta < 0 else "stayed flat"
    lines = []
    if note:
        lines.append(note)
    lines.extend(
        [
            f"Temperature during {session.get('house_id', '-')} / {session.get('room_id', '-')} ({session.get('session_type', '-')}) {direction}.",
            f"Start: {first:.2f} C | End: {last:.2f} C | Change: {delta:+.2f} C",
            f"Average: {_average(values):.2f} C | Min: {min(values):.2f} C | Max: {max(values):.2f} C",
            "",
            "Temperature sample:",
            *_sparkline_values(values, "temperature"),
        ]
    )
    chart_points = [
        {"label": f"{index + 1}", "value": round(value, 2)}
        for index, value in enumerate(_sample(values, 80))
    ]
    return "\n".join(lines) + "\n\n" + _chart_marker("temperature", chart_points)


def _sparkline_rows(points: list[dict[str, Any]], metric: str) -> list[str]:
    sampled_points = _sample(points, 12)
    sampled_values = [float(point["value"]) for point in sampled_points if isinstance(point.get("value"), (int, float))]
    return _bars(sampled_values, METRIC_UNITS[metric])


def _sparkline_values(values: list[float], metric: str) -> list[str]:
    return _bars(_sample(values, 12), METRIC_UNITS[metric])


def _bars(values: list[float], unit: str) -> list[str]:
    if not values:
        return ["No values available."]
    minimum = min(values)
    maximum = max(values)
    span = maximum - minimum
    rows: list[str] = []
    for index, value in enumerate(values, start=1):
        width = 2 if span == 0 else 2 + int(((value - minimum) / span) * 22)
        rows.append(f"{index:02d}. {value:8.2f} {unit:<8} | {'#' * width}")
    return rows


def _sample(values: list[Any], size: int) -> list[Any]:
    if len(values) <= size:
        return values
    step = (len(values) - 1) / (size - 1)
    return [values[math.floor(index * step)] for index in range(size)]


def _scope_label(house_id: str | None, room_id: str | None) -> str:
    if house_id and room_id:
        return f" for {house_id} / {room_id}"
    if house_id:
        return f" for house {house_id}"
    if room_id:
        return f" for room {room_id}"
    return ""


def _range_label(date_from: str | None, date_to: str | None) -> str:
    if date_from and date_to and date_from == date_to:
        return f" on {date_from}"
    if date_from and date_to:
        return f" from {date_from} to {date_to}"
    if date_from:
        return f" from {date_from}"
    if date_to:
        return f" until {date_to}"
    return ""


def _short_date(value: Any) -> str | None:
    if not value:
        return None
    return str(value).split("T", maxsplit=1)[0]


def _fmt(value: Any) -> str:
    if isinstance(value, (int, float)):
        return f"{float(value):.2f}"
    return "-"


def _average(values: list[float]) -> float:
    return sum(values) / len(values)


def _chart_points_from_trend(points: list[dict[str, Any]], metric: str) -> list[dict[str, Any]]:
    chart_points: list[dict[str, Any]] = []
    for index, point in enumerate(_sample(points, 80), start=1):
        value = point.get("value")
        if not isinstance(value, (int, float)):
            continue
        chart_points.append(
            {
                "label": str(index),
                "value": round(float(value), 2),
                "stage": point.get("session_type"),
            }
        )
    return chart_points


def _chart_marker(metric: str, points: list[dict[str, Any]]) -> str:
    payload = {
        "type": "line",
        "metric": metric,
        "label": METRIC_LABELS[metric],
        "unit": METRIC_UNITS[metric],
        "points": points,
    }
    return f"__CLEANSIGHT_CHART__{json.dumps(payload, ensure_ascii=True)}__END_CLEANSIGHT_CHART__"
