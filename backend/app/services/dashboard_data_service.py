from __future__ import annotations

from collections import defaultdict
from datetime import date, datetime, timezone
from statistics import mean
from typing import Any
from zoneinfo import ZoneInfo

from app.core.firebase import get_db

SESSIONS_COLLECTION = "sessions"
READINGS_SUBCOLLECTION = "readings"
METRICS = ("dust", "air_quality", "temperature", "humidity")
LOCAL_TIMEZONE = ZoneInfo("Asia/Colombo")


def _to_float(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def _to_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _normalize_datetime(value: Any) -> datetime | None:
    if not isinstance(value, datetime):
        return None
    normalized = value
    if normalized.tzinfo is None:
        normalized = normalized.replace(tzinfo=timezone.utc)
    return normalized.astimezone(LOCAL_TIMEZONE)


def _to_iso(value: Any) -> str | None:
    dt = _normalize_datetime(value)
    if dt:
        return dt.isoformat()
    if value is None:
        return None
    return str(value)


def _parse_date(value: str | None) -> date | None:
    raw_value = (value or "").strip()
    if not raw_value:
        return None
    return datetime.strptime(raw_value, "%Y-%m-%d").date()


def _extract_session_datetime(payload: dict[str, Any]) -> datetime | None:
    for key in ("start_time", "created_at", "updated_at"):
        dt = _normalize_datetime(payload.get(key))
        if dt:
            return dt
    return None


def _in_range(value: date | None, date_from: date | None, date_to: date | None) -> bool:
    if value is None:
        return False
    if date_from and value < date_from:
        return False
    if date_to and value > date_to:
        return False
    return True


def _average(values: list[float]) -> float | None:
    if not values:
        return None
    return round(mean(values), 2)


def _metric_bucket(readings: list[dict[str, Any]], metric: str) -> list[float]:
    bucket: list[float] = []
    for row in readings:
        value = _to_float(row.get(metric))
        if value is not None:
            bucket.append(value)
    return bucket


def _readings_summary(readings: list[dict[str, Any]]) -> dict[str, Any]:
    summary: dict[str, Any] = {"total_readings": len(readings), "metrics": {}}
    for metric in METRICS:
        values = _metric_bucket(readings, metric)
        if not values:
            summary["metrics"][metric] = {"avg": None, "min": None, "max": None}
            continue
        summary["metrics"][metric] = {
            "avg": _average(values),
            "min": round(min(values), 2),
            "max": round(max(values), 2),
        }
    return summary


def _safe_db():
    db = get_db()
    if not db:
        raise RuntimeError("Database not connected. Please ensure Firebase is setup.")
    return db


def get_sessions(
    house_id: str | None = None,
    room_id: str | None = None,
    session_type: str | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
) -> list[dict[str, Any]]:
    db = _safe_db()
    from_date = _parse_date(date_from)
    to_date = _parse_date(date_to)

    normalized_house = (house_id or "").strip() or None
    normalized_room = (room_id or "").strip() or None
    normalized_type = (session_type or "").strip().lower() or None

    sessions: list[dict[str, Any]] = []
    for doc in db.collection(SESSIONS_COLLECTION).stream():
        payload = doc.to_dict() or {}

        doc_house = str(payload.get("house_id") or "").strip()
        doc_room = str(payload.get("room_id") or "").strip()
        doc_type = str(payload.get("session_type") or "").strip().lower()

        if normalized_house and doc_house != normalized_house:
            continue
        if normalized_room and doc_room != normalized_room:
            continue
        if normalized_type and doc_type != normalized_type:
            continue

        session_dt = _extract_session_datetime(payload)
        session_day = session_dt.date() if session_dt else None
        if (from_date or to_date) and not _in_range(session_day, from_date, to_date):
            continue

        sessions.append(
            {
                "session_id": str(payload.get("session_id") or doc.id),
                "house_id": doc_house,
                "room_id": doc_room,
                "session_type": doc_type,
                "status": str(payload.get("status") or ""),
                "device_id": str(payload.get("device_id") or ""),
                "total_readings": _to_int(payload.get("total_readings"), default=0),
                "start_time": _to_iso(payload.get("start_time")),
                "end_time": _to_iso(payload.get("end_time")),
                "created_at": _to_iso(payload.get("created_at")),
                "updated_at": _to_iso(payload.get("updated_at")),
                "session_date": session_day.isoformat() if session_day else None,
            }
        )

    sessions.sort(key=lambda row: row.get("start_time") or "")
    return sessions


def get_session(session_id: str) -> dict[str, Any] | None:
    db = _safe_db()
    normalized_session_id = session_id.strip()
    if not normalized_session_id:
        return None

    snapshot = db.collection(SESSIONS_COLLECTION).document(normalized_session_id).get()
    if not snapshot.exists:
        return None

    payload = snapshot.to_dict() or {}
    session_dt = _extract_session_datetime(payload)
    return {
        "session_id": str(payload.get("session_id") or snapshot.id),
        "house_id": str(payload.get("house_id") or ""),
        "room_id": str(payload.get("room_id") or ""),
        "session_type": str(payload.get("session_type") or ""),
        "status": str(payload.get("status") or ""),
        "device_id": str(payload.get("device_id") or ""),
        "total_readings": _to_int(payload.get("total_readings"), default=0),
        "start_time": _to_iso(payload.get("start_time")),
        "end_time": _to_iso(payload.get("end_time")),
        "created_at": _to_iso(payload.get("created_at")),
        "updated_at": _to_iso(payload.get("updated_at")),
        "session_date": session_dt.date().isoformat() if session_dt else None,
    }


def get_session_readings(session_id: str) -> list[dict[str, Any]]:
    db = _safe_db()
    normalized_session_id = session_id.strip()
    if not normalized_session_id:
        return []

    docs = (
        db.collection(SESSIONS_COLLECTION)
        .document(normalized_session_id)
        .collection(READINGS_SUBCOLLECTION)
        .stream()
    )
    rows: list[dict[str, Any]] = []
    for doc in docs:
        payload = doc.to_dict() or {}
        rows.append(
            {
                "reading_id": str(payload.get("reading_id") or doc.id),
                "session_id": normalized_session_id,
                "timestamp_ms": _to_int(payload.get("timestamp_ms"), default=0),
                "recorded_at": _to_iso(payload.get("recorded_at")),
                "dust": _to_float(payload.get("dust")),
                "air_quality": _to_float(payload.get("air_quality")),
                "temperature": _to_float(payload.get("temperature")),
                "humidity": _to_float(payload.get("humidity")),
            }
        )
    rows.sort(key=lambda row: row.get("timestamp_ms") or 0)
    return rows


def get_session_summary(session_id: str) -> dict[str, Any]:
    session = get_session(session_id)
    if not session:
        return {"found": False, "session_id": session_id}
    readings = get_session_readings(session_id)
    return {
        "found": True,
        "session": session,
        "summary": _readings_summary(readings),
    }


def get_trend_data(
    house_id: str | None,
    room_id: str | None,
    metric: str,
    date_from: str | None,
    date_to: str | None,
    session_type: str | None = None,
) -> dict[str, Any]:
    normalized_metric = metric.strip().lower()
    if normalized_metric not in METRICS:
        return {
            "status": "error",
            "message": f"Unsupported metric '{metric}'. Allowed metrics: {', '.join(METRICS)}.",
        }

    sessions = get_sessions(
        house_id=house_id,
        room_id=room_id,
        session_type=session_type,
        date_from=date_from,
        date_to=date_to,
    )
    points: list[dict[str, Any]] = []
    for session in sessions:
        readings = get_session_readings(session["session_id"])
        for row in readings:
            value = _to_float(row.get(normalized_metric))
            if value is None:
                continue
            points.append(
                {
                    "session_id": session["session_id"],
                    "session_type": session.get("session_type"),
                    "timestamp_ms": row.get("timestamp_ms"),
                    "recorded_at": row.get("recorded_at"),
                    "value": round(value, 2),
                }
            )

    points.sort(key=lambda row: row.get("timestamp_ms") or 0)
    values = [point["value"] for point in points]
    return {
        "status": "success",
        "metric": normalized_metric,
        "points_count": len(points),
        "summary": {
            "avg": _average(values),
            "min": round(min(values), 2) if values else None,
            "max": round(max(values), 2) if values else None,
        },
        "points": points,
    }


def compare_room_dust(room_a: str, room_b: str, date_from: str | None, date_to: str | None) -> dict[str, Any]:
    trend_a = get_trend_data(None, room_a, "dust", date_from, date_to, None)
    trend_b = get_trend_data(None, room_b, "dust", date_from, date_to, None)

    avg_a = trend_a.get("summary", {}).get("avg")
    avg_b = trend_b.get("summary", {}).get("avg")
    difference = None
    if isinstance(avg_a, (int, float)) and isinstance(avg_b, (int, float)):
        difference = round(float(avg_a) - float(avg_b), 2)

    return {
        "status": "success",
        "room_a": room_a,
        "room_b": room_b,
        "room_a_summary": trend_a.get("summary"),
        "room_b_summary": trend_b.get("summary"),
        "difference_avg_dust": difference,
        "comparison_summary": (
            "Room A has higher average dust."
            if difference and difference > 0
            else "Room B has higher average dust."
            if difference and difference < 0
            else "Both rooms show similar average dust."
        ),
    }


def compare_sessions(
    room_id: str,
    session_type_a: str,
    session_type_b: str,
    date_from: str | None,
    date_to: str | None,
) -> dict[str, Any]:
    sessions_a = get_sessions(None, room_id, session_type_a, date_from, date_to)
    sessions_b = get_sessions(None, room_id, session_type_b, date_from, date_to)

    def aggregate(metric: str, source_sessions: list[dict[str, Any]]) -> float | None:
        bucket: list[float] = []
        for session in source_sessions:
            readings = get_session_readings(session["session_id"])
            bucket.extend(_metric_bucket(readings, metric))
        return _average(bucket)

    comparison: dict[str, Any] = {"status": "success", "room_id": room_id, "session_type_a": session_type_a, "session_type_b": session_type_b, "metrics": {}}
    for metric in METRICS:
        avg_a = aggregate(metric, sessions_a)
        avg_b = aggregate(metric, sessions_b)
        delta = None
        if avg_a is not None and avg_b is not None:
            delta = round(avg_a - avg_b, 2)
        comparison["metrics"][metric] = {"avg_a": avg_a, "avg_b": avg_b, "delta": delta}
    return comparison


def get_anomaly_explanation(session_id: str) -> dict[str, Any]:
    session = get_session(session_id)
    if not session:
        return {"status": "not_found", "session_id": session_id}

    readings = get_session_readings(session_id)
    summary = _readings_summary(readings)
    dust_max = summary["metrics"]["dust"]["max"]
    aq_max = summary["metrics"]["air_quality"]["max"]
    temp_max = summary["metrics"]["temperature"]["max"]
    humidity_max = summary["metrics"]["humidity"]["max"]

    flags: list[str] = []
    if isinstance(dust_max, (int, float)) and dust_max > 220:
        flags.append("High dust peak detected.")
    if isinstance(aq_max, (int, float)) and aq_max > 320:
        flags.append("High air-quality index peak detected.")
    if isinstance(temp_max, (int, float)) and temp_max > 32:
        flags.append("Temperature spike detected.")
    if isinstance(humidity_max, (int, float)) and humidity_max > 75:
        flags.append("Humidity spike detected.")

    reason = (
        "Sensor values show temporary spikes likely linked to active cleaning or ventilation changes."
        if flags
        else "No strong anomaly signals were detected in this session."
    )
    return {
        "status": "success",
        "session_id": session_id,
        "anomaly_flags": flags,
        "possible_reason": reason,
        "relevant_metrics": summary["metrics"],
    }


def get_dashboard_context_summary(context: dict[str, Any]) -> dict[str, Any]:
    date_range = context.get("date_range") or {}
    from_date = date_range.get("from")
    to_date = date_range.get("to")

    summary = {
        "house_id": context.get("house_id"),
        "room_id": context.get("room_id"),
        "session_type": context.get("session_type"),
        "selected_page": context.get("selected_page"),
        "selected_chart": context.get("selected_chart"),
        "date_from": from_date,
        "date_to": to_date,
        "filters": context.get("filters") or {},
    }
    return {"status": "success", "context_summary": summary}


def generate_visualization_instruction(
    chart_type: str,
    metric: str,
    room_id: str,
    date_from: str | None,
    date_to: str | None,
) -> dict[str, Any]:
    trend = get_trend_data(None, room_id, metric, date_from, date_to, None)
    return {
        "status": "success",
        "instruction": {
            "chart_type": chart_type,
            "metric": metric,
            "room_id": room_id,
            "date_range": {"from": date_from, "to": date_to},
            "summary": trend.get("summary"),
            "suggested_focus": "Highlight peaks and compare before/during/after sessions.",
        },
    }


def get_room_attention_ranking(date_from: str | None, date_to: str | None) -> dict[str, Any]:
    sessions = get_sessions(None, None, None, date_from, date_to)
    room_bucket: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for session in sessions:
        room_bucket[session["room_id"]].append(session)

    ranking: list[dict[str, Any]] = []
    for room_id, room_sessions in room_bucket.items():
        dust_values: list[float] = []
        aq_values: list[float] = []
        anomaly_count = 0

        for session in room_sessions:
            readings = get_session_readings(session["session_id"])
            dust_values.extend(_metric_bucket(readings, "dust"))
            aq_values.extend(_metric_bucket(readings, "air_quality"))

            anomaly = get_anomaly_explanation(session["session_id"])
            if anomaly.get("anomaly_flags"):
                anomaly_count += 1

        avg_dust = _average(dust_values) or 0.0
        avg_aq = _average(aq_values) or 0.0
        attention_score = round((avg_dust * 0.45) + (avg_aq * 0.45) + (anomaly_count * 20), 2)
        ranking.append(
            {
                "room_id": room_id,
                "avg_dust": avg_dust,
                "avg_air_quality": avg_aq,
                "anomaly_sessions": anomaly_count,
                "attention_score": attention_score,
            }
        )

    ranking.sort(key=lambda row: row["attention_score"], reverse=True)
    return {"status": "success", "ranking": ranking}


def answer_decision_support_question(
    question: str,
    room_id: str | None,
    house_id: str | None,
    date_from: str | None,
    date_to: str | None,
) -> dict[str, Any]:
    trend_dust = get_trend_data(house_id, room_id, "dust", date_from, date_to, None)
    trend_air = get_trend_data(house_id, room_id, "air_quality", date_from, date_to, None)
    trend_temp = get_trend_data(house_id, room_id, "temperature", date_from, date_to, None)
    trend_humidity = get_trend_data(house_id, room_id, "humidity", date_from, date_to, None)

    return {
        "status": "success",
        "question": question,
        "room_id": room_id,
        "house_id": house_id,
        "evidence": {
            "dust": trend_dust.get("summary"),
            "air_quality": trend_air.get("summary"),
            "temperature": trend_temp.get("summary"),
            "humidity": trend_humidity.get("summary"),
        },
        "decision_summary": (
            "Use dust and air-quality peaks as primary priority signals. "
            "If both are elevated, review cleaning flow and ventilation first."
        ),
    }
