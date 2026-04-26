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

    if _is_chart_explanation_question(text):
        return _answer_chart_explanation(messages, text)

    follow_up = _answer_follow_up_if_needed(messages, context)
    if follow_up:
        return follow_up

    if _is_cleaned_houses_question(text):
        date_from, date_to, label = _cleaned_houses_range(text)
        return _answer_cleaned_houses(date_from, date_to, label)

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
        if not date_from and not date_to:
            date_from, date_to = _recent_cleaned_house_range_from_history(messages)
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
    if "last week" in text or "past week" in text:
        start, end, _label = _cleaned_houses_range(text)
        return start, end

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


def _is_cleaned_houses_question(text: str) -> bool:
    asks_house = "house" in text or "houses" in text
    asks_cleaned = any(word in text for word in ("cleaned", "cleaning", "completed"))
    asks_listing = any(word in text for word in ("list", "show", "which", "what", "all"))
    asks_period = any(phrase in text for phrase in ("last week", "past week", "last 7 days", "previous week"))
    return asks_house and asks_cleaned and asks_listing and asks_period


def _is_chart_explanation_question(text: str) -> bool:
    asks_explain = any(word in text for word in ("explain", "describe", "understand", "interpret"))
    asks_language_follow_up = _requested_explanation_language(text) is not None
    return ("chart" in text and asks_explain) or (asks_explain and asks_language_follow_up)


def _requested_explanation_language(text: str) -> str | None:
    if "sinhala" in text or "sinhalese" in text:
        return "sinhala"
    if "tamil" in text:
        return "tamil"
    return None


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


def _cleaned_houses_range(text: str) -> tuple[str, str, str]:
    today = _today()
    if "previous week" in text:
        start = today - timedelta(days=today.weekday() + 7)
        end = start + timedelta(days=6)
        return start.isoformat(), end.isoformat(), f"previous calendar week ({start.isoformat()} to {end.isoformat()})"

    end = today
    start = today - timedelta(days=7)
    return start.isoformat(), end.isoformat(), f"last 7 days ({start.isoformat()} to {end.isoformat()})"


def _recent_cleaned_house_range_from_history(messages: list[dict[str, Any]]) -> tuple[str | None, str | None]:
    for message in reversed(messages[:-1]):
        if str(message.get("role")) != "assistant":
            continue
        content = str(message.get("content") or "")
        if "house(s) cleaned" not in content.lower():
            continue
        match = re.search(r"\((20\d{2}-\d{2}-\d{2})\s+to\s+(20\d{2}-\d{2}-\d{2})\)", content)
        if match:
            return match.group(1), match.group(2)
    return None, None


def _answer_cleaned_houses(date_from: str, date_to: str, range_label: str) -> str:
    sessions = data_service.get_sessions(None, None, None, date_from, date_to)
    if not sessions:
        return f"I could not find any cleaned houses in the {range_label}."

    grouped: dict[str, dict[str, Any]] = {}
    for session in sessions:
        house_id = str(session.get("house_id") or "Unknown house").strip() or "Unknown house"
        room_id = str(session.get("room_id") or "Unknown room").strip() or "Unknown room"
        bucket = grouped.setdefault(
            house_id,
            {
                "rooms": set(),
                "sessions": 0,
                "readings": 0,
                "latest": None,
            },
        )
        bucket["rooms"].add(room_id)
        bucket["sessions"] += 1
        bucket["readings"] += int(session.get("total_readings") or 0)
        session_date = session.get("session_date") or _short_date(session.get("start_time"))
        if session_date and (bucket["latest"] is None or session_date > bucket["latest"]):
            bucket["latest"] = session_date

    lines = [
        f"I found {len(grouped)} house(s) cleaned in the {range_label}.",
        "Here is the cleaned-house summary:",
    ]
    for index, house_id in enumerate(sorted(grouped), start=1):
        bucket = grouped[house_id]
        rooms = ", ".join(sorted(bucket["rooms"]))
        lines.append(
            f"{index}. {house_id}: {bucket['sessions']} session(s), "
            f"{len(bucket['rooms'])} room(s) ({rooms}), {bucket['readings']} readings, "
            f"latest cleaning date {bucket['latest'] or 'unknown'}."
        )

    return "\n".join(lines)


def _known_sessions() -> list[dict[str, Any]]:
    try:
        return data_service.get_sessions()
    except Exception:
        return []


def _resolve_house_id(question: str, context: dict[str, Any]) -> str | None:
    known_houses = sorted({row["house_id"] for row in _known_sessions() if row.get("house_id")}, key=len, reverse=True)
    explicit_house = _extract_entity_after_keyword(question, "house")
    if explicit_house:
        matched_house = _match_known_entity(explicit_house, known_houses)
        if matched_house:
            return matched_house

    matched_house = _match_known_entity(question, known_houses)
    if matched_house:
        return matched_house

    match = re.search(r"\bhouse(?:\s+(?:id|name))?\s*(?:is|=|:)?\s+([a-zA-Z0-9 _-]+)", question, re.IGNORECASE)
    if match:
        candidate = _trim_entity(match.group(1))
        return _match_known_entity(candidate, known_houses) or candidate
    context_house = str(context.get("house_id") or "").strip()
    if context_house:
        return context_house
    return None


def _resolve_room_id(question: str, context: dict[str, Any]) -> str | None:
    known_rooms = sorted({row["room_id"] for row in _known_sessions() if row.get("room_id")}, key=len, reverse=True)
    explicit_room = _extract_entity_after_keyword(question, "room")
    if explicit_room:
        matched_room = _match_known_entity(explicit_room, known_rooms)
        if matched_room:
            return matched_room

    matched_room = _match_known_entity(question, known_rooms)
    if matched_room:
        return matched_room

    match = re.search(r"\broom(?:\s+(?:id|name))?\s*(?:is|=|:)?\s+([a-zA-Z0-9 _-]+)", question, re.IGNORECASE)
    if match:
        candidate = _trim_entity(match.group(1))
        return _match_known_entity(candidate, known_rooms) or candidate
    context_room = str(context.get("room_id") or "").strip()
    if context_room:
        return context_room
    return None


def _extract_entity_after_keyword(question: str, keyword: str) -> str | None:
    quoted = re.search(
        rf"\b{keyword}\b(?:\s+(?:id|name))?(?:\s+(?:as|is))?\s*(?:=|:)?\s*[\"']([^\"']+)[\"']",
        question,
        re.IGNORECASE,
    )
    if quoted:
        return quoted.group(1).strip()

    plain = re.search(
        rf"\b{keyword}\b(?:\s+(?:id|name))?(?:\s+(?:as|is))?\s*(?:=|:)?\s+([a-zA-Z0-9 _-]+)",
        question,
        re.IGNORECASE,
    )
    if plain:
        return _trim_entity(plain.group(1))
    return None


def _normalize_entity(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower())


def _match_known_entity(candidate: str, known_entities: list[str]) -> str | None:
    normalized_candidate = _normalize_entity(candidate)
    if not normalized_candidate:
        return None

    for entity in known_entities:
        normalized_entity = _normalize_entity(entity)
        if not normalized_entity:
            continue
        if normalized_entity == normalized_candidate:
            return entity

    for entity in known_entities:
        normalized_entity = _normalize_entity(entity)
        if normalized_entity and normalized_entity in normalized_candidate:
            return entity

    return None


def _trim_entity(value: str) -> str:
    return re.split(
        r"\b(?:on|for|from|to|and|with|session|date|room|house)\b",
        value,
        flags=re.IGNORECASE,
    )[0].strip(" .,:;-\"'")


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
        f"Here is the visualization of the {label.lower()} trend for {house_id} / {room_id}{range_text}.",
        "You can hover over the line to inspect exact readings and use the bottom range selector to zoom into a smaller time window.",
    ]
    chart_summary = {
        "house_id": house_id,
        "room_id": room_id,
        "date_from": date_from,
        "date_to": date_to,
        "points_count": len(points),
        "average": summary.get("avg"),
        "min": summary.get("min"),
        "max": summary.get("max"),
        "first": round(first, 2),
        "last": round(last, 2),
        "delta": delta,
        "direction": direction,
    }
    return "\n".join(lines) + "\n\n" + _chart_marker(metric, _chart_points_from_trend(points, metric), chart_summary)


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
        recorded_at = point.get("recorded_at")
        timestamp_ms = point.get("timestamp_ms")
        chart_points.append(
            {
                "label": _time_label(recorded_at, timestamp_ms) or str(index),
                "value": round(float(value), 2),
                "stage": point.get("session_type"),
                "recorded_at": recorded_at,
                "timestamp_ms": timestamp_ms,
            }
        )
    return chart_points


def _time_label(recorded_at: Any, timestamp_ms: Any) -> str | None:
    try:
        if isinstance(recorded_at, str) and recorded_at:
            return datetime.fromisoformat(recorded_at).strftime("%I:%M %p").lstrip("0")
    except ValueError:
        pass
    try:
        ts = float(timestamp_ms)
        if ts > 0:
            return datetime.fromtimestamp(ts / 1000, LOCAL_TIMEZONE).strftime("%I:%M %p").lstrip("0")
    except (TypeError, ValueError, OSError):
        pass
    return None


def _chart_marker(metric: str, points: list[dict[str, Any]], summary: dict[str, Any] | None = None) -> str:
    payload = {
        "type": "line",
        "metric": metric,
        "label": METRIC_LABELS[metric],
        "unit": METRIC_UNITS[metric],
        "points": points,
        "summary": summary or {},
    }
    return f"__CLEANSIGHT_CHART__{json.dumps(payload, ensure_ascii=True)}__END_CLEANSIGHT_CHART__"


def _last_chart_payload(messages: list[dict[str, Any]]) -> dict[str, Any] | None:
    for message in reversed(messages[:-1]):
        if str(message.get("role")) != "assistant":
            continue
        content = str(message.get("content") or "")
        match = re.search(r"__CLEANSIGHT_CHART__([\s\S]*?)__END_CLEANSIGHT_CHART__", content)
        if not match:
            continue
        try:
            payload = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        if isinstance(payload, dict) and isinstance(payload.get("points"), list):
            return payload
    return None


def _answer_chart_explanation(messages: list[dict[str, Any]], request_text: str) -> str:
    chart = _last_chart_payload(messages)
    if not chart:
        return "I do not see a chart in this chat yet. Ask me to visualize dust, air quality, temperature, or humidity first, then I can explain it."

    metric = str(chart.get("metric") or "metric")
    label = str(chart.get("label") or METRIC_LABELS.get(metric, "Metric"))
    unit = str(chart.get("unit") or METRIC_UNITS.get(metric, "units"))
    points = [point for point in chart.get("points", []) if isinstance(point.get("value"), (int, float))]
    if not points:
        return f"I found the {label.lower()} chart, but it does not contain enough numeric points to explain."

    values = [float(point["value"]) for point in points]
    first = values[0]
    last = values[-1]
    avg = _average(values)
    minimum = min(values)
    maximum = max(values)
    min_index = values.index(minimum)
    max_index = values.index(maximum)
    delta = last - first
    direction = "down" if delta < 0 else "up" if delta > 0 else "flat"
    stages = _stage_stats(points)
    language = _requested_explanation_language(request_text) or "english"

    if metric in ("dust", "air_quality"):
        outcome = (
            "That is a good sign because lower readings after cleaning usually mean cleaner air."
            if delta < 0
            else "That needs attention because the final reading is not lower than the starting reading."
        )
    else:
        outcome = "For comfort metrics, the key question is whether the final value stabilized into the expected range."

    if language == "sinhala":
        return _answer_chart_explanation_sinhala(
            label=label,
            unit=unit,
            points=points,
            first=first,
            last=last,
            avg=avg,
            minimum=minimum,
            maximum=maximum,
            min_index=min_index,
            max_index=max_index,
            delta=delta,
            direction=direction,
            stages=stages,
            lower_is_better=metric in ("dust", "air_quality"),
        )

    if language == "tamil":
        return _answer_chart_explanation_tamil(
            label=label,
            unit=unit,
            points=points,
            first=first,
            last=last,
            avg=avg,
            minimum=minimum,
            maximum=maximum,
            min_index=min_index,
            max_index=max_index,
            delta=delta,
            direction=direction,
            stages=stages,
            lower_is_better=metric in ("dust", "air_quality"),
        )

    lines = [
        f"Here is the full explanation of the {label} chart.",
        "",
        f"1. What the chart shows: the X-axis is time and the Y-axis is {label.lower()} in {unit}. Each point is a sensor reading from the selected cleaning window.",
        f"2. Starting point: the chart begins at {first:.2f} {unit}.",
        f"3. Ending point: the chart ends at {last:.2f} {unit}, so the overall movement is {direction} by {abs(delta):.2f} {unit}.",
        f"4. Average level: across the chart, the average reading is {avg:.2f} {unit}.",
        f"5. Lowest point: {minimum:.2f} {unit} around {points[min_index].get('label', 'the low point')}.",
        f"6. Highest point: {maximum:.2f} {unit} around {points[max_index].get('label', 'the peak point')}.",
        f"7. Cleaning interpretation: {outcome}",
    ]

    if stages:
        lines.append("8. Stage-by-stage reading:")
        for stage, stats in stages.items():
            lines.append(
                f"- {stage.title()}: average {stats['avg']:.2f} {unit}, min {stats['min']:.2f}, max {stats['max']:.2f}, {stats['count']} point(s)."
            )
    else:
        lines.append("8. Stage-by-stage reading: this chart does not include enough stage labels, so I am reading it as one continuous trend.")

    lines.extend(
        [
            "9. How to use it interactively: hover over the line to see exact values, and use the bottom range selector to zoom into a smaller time period.",
            "10. Bottom line: focus on the peak, the final reading, and whether the after-cleaning section settles lower than the starting level.",
        ]
    )
    return "\n".join(lines)


def _localized_direction(language: str, direction: str) -> str:
    if language == "sinhala":
        return {"down": "අඩු වී ඇත", "up": "වැඩි වී ඇත", "flat": "ස්ථාවරව තිබේ"}.get(direction, direction)
    return {"down": "குறைந்துள்ளது", "up": "அதிகரித்துள்ளது", "flat": "நிலையாக உள்ளது"}.get(direction, direction)


def _answer_chart_explanation_sinhala(
    *,
    label: str,
    unit: str,
    points: list[dict[str, Any]],
    first: float,
    last: float,
    avg: float,
    minimum: float,
    maximum: float,
    min_index: int,
    max_index: int,
    delta: float,
    direction: str,
    stages: dict[str, dict[str, float | int]],
    lower_is_better: bool,
) -> str:
    interpretation = (
        "මෙය හොඳ ලක්ෂණයක්. පිරිසිදු කිරීමෙන් පසු කියවීම අඩු වීම සාමාන්‍යයෙන් වාතය/කාමර තත්ත්වය හොඳ වූ බව පෙන්වයි."
        if lower_is_better and delta < 0
        else "මෙය තවදුරටත් බලන්න අවශ්‍ය ලක්ෂණයකි. අවසාන කියවීම ආරම්භක කියවීමට වඩා පැහැදිලිව අඩු වී නැත."
        if lower_is_better
        else "මෙම මිනුම සඳහා වැදගත් වන්නේ අවසාන අගය සුදුසු පරාසයක ස්ථාවර වූවාද යන්නයි."
    )

    lines = [
        f"මෙන්න {label} chart එකේ සම්පූර්ණ පැහැදිලි කිරීම.",
        "",
        f"1. මෙම chart එකේ X-axis එකෙන් වේලාව පෙන්වයි. Y-axis එකෙන් {label} අගය {unit} ලෙස පෙන්වයි.",
        f"2. ආරම්භක කියවීම {first:.2f} {unit}.",
        f"3. අවසාන කියවීම {last:.2f} {unit}. සමස්ත වෙනස {_localized_direction('sinhala', direction)}: {abs(delta):.2f} {unit}.",
        f"4. සාමාන්‍ය කියවීම {avg:.2f} {unit}.",
        f"5. අවම අගය {minimum:.2f} {unit}, {points[min_index].get('label', 'අවම ස්ථානය')} අවට.",
        f"6. උපරිම අගය {maximum:.2f} {unit}, {points[max_index].get('label', 'උපරිම ස්ථානය')} අවට.",
        f"7. පිරිසිදු කිරීමේ අර්ථය: {interpretation}",
    ]

    if stages:
        lines.append("8. Stage අනුව සාරාංශය:")
        for stage, stats in stages.items():
            lines.append(
                f"- {stage}: average {stats['avg']:.2f} {unit}, min {stats['min']:.2f}, max {stats['max']:.2f}, points {stats['count']}."
            )
    else:
        lines.append("8. Stage data ප්‍රමාණවත් නැති නිසා, මෙය එක් continuous trend එකක් ලෙස කියවිය හැක.")

    lines.extend(
        [
            "9. Line එකට hover කළාම නිශ්චිත reading බලන්න පුළුවන්. පහළ range selector එකෙන් කාල පරාසය zoom කරන්න පුළුවන්.",
            "10. සරලව කියනවා නම්: peak එක, අවසාන reading එක, සහ after-cleaning කොටස ආරම්භයට වඩා හොඳද කියන එක බලන්න.",
        ]
    )
    return "\n".join(lines)


def _answer_chart_explanation_tamil(
    *,
    label: str,
    unit: str,
    points: list[dict[str, Any]],
    first: float,
    last: float,
    avg: float,
    minimum: float,
    maximum: float,
    min_index: int,
    max_index: int,
    delta: float,
    direction: str,
    stages: dict[str, dict[str, float | int]],
    lower_is_better: bool,
) -> str:
    interpretation = (
        "இது நல்ல அறிகுறி. சுத்தம் செய்த பிறகு வாசிப்பு குறைவது பொதுவாக காற்று/அறை நிலை மேம்பட்டுள்ளது என்பதைக் காட்டுகிறது."
        if lower_is_better and delta < 0
        else "இதை மேலும் கவனிக்க வேண்டும். இறுதி வாசிப்பு ஆரம்ப வாசிப்பை விட தெளிவாக குறையவில்லை."
        if lower_is_better
        else "இந்த அளவீட்டில் முக்கியமானது, இறுதி மதிப்பு ஏற்ற வரம்பில் நிலையாக உள்ளதா என்பதே."
    )

    lines = [
        f"இதோ {label} chart பற்றிய முழு விளக்கம்.",
        "",
        f"1. இந்த chart-இல் X-axis நேரத்தை காட்டுகிறது. Y-axis {label} மதிப்பை {unit} ஆக காட்டுகிறது.",
        f"2. ஆரம்ப வாசிப்பு {first:.2f} {unit}.",
        f"3. இறுதி வாசிப்பு {last:.2f} {unit}. மொத்த மாற்றம் {_localized_direction('tamil', direction)}: {abs(delta):.2f} {unit}.",
        f"4. சராசரி வாசிப்பு {avg:.2f} {unit}.",
        f"5. குறைந்த மதிப்பு {minimum:.2f} {unit}, {points[min_index].get('label', 'குறைந்த இடம்')} அருகில்.",
        f"6. அதிகபட்ச மதிப்பு {maximum:.2f} {unit}, {points[max_index].get('label', 'உச்ச இடம்')} அருகில்.",
        f"7. சுத்தம் செய்ததன் அர்த்தம்: {interpretation}",
    ]

    if stages:
        lines.append("8. Stage அடிப்படையிலான சுருக்கம்:")
        for stage, stats in stages.items():
            lines.append(
                f"- {stage}: average {stats['avg']:.2f} {unit}, min {stats['min']:.2f}, max {stats['max']:.2f}, points {stats['count']}."
            )
    else:
        lines.append("8. Stage data போதுமானதாக இல்லை; எனவே இதை ஒரு continuous trend ஆக வாசிக்கலாம்.")

    lines.extend(
        [
            "9. Line மீது hover செய்தால் சரியான reading பார்க்கலாம். கீழே உள்ள range selector மூலம் நேர பகுதியை zoom செய்யலாம்.",
            "10. சுருக்கமாக: peak, final reading, மற்றும் after-cleaning பகுதி ஆரம்ப நிலையை விட மேம்பட்டதா என்பதை கவனிக்கவும்.",
        ]
    )
    return "\n".join(lines)


def _stage_stats(points: list[dict[str, Any]]) -> dict[str, dict[str, float | int]]:
    buckets: dict[str, list[float]] = {}
    for point in points:
        stage = str(point.get("stage") or "").strip().lower()
        if stage not in {"before", "during", "after"}:
            continue
        buckets.setdefault(stage, []).append(float(point["value"]))

    stats: dict[str, dict[str, float | int]] = {}
    for stage in ("before", "during", "after"):
        values = buckets.get(stage)
        if not values:
            continue
        stats[stage] = {
            "avg": round(_average(values), 2),
            "min": round(min(values), 2),
            "max": round(max(values), 2),
            "count": len(values),
        }
    return stats
