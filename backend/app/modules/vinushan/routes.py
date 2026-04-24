from __future__ import annotations

from collections import defaultdict
from datetime import datetime, timezone
from statistics import mean
from typing import Any, Iterable
from zoneinfo import ZoneInfo

from fastapi import APIRouter, HTTPException, Query, status

from app.core.firebase import get_db

router = APIRouter()

SESSIONS_COLLECTION = "sessions"
READINGS_SUBCOLLECTION = "readings"
SESSION_TYPES = ("before", "during", "after")
LOCAL_TIMEZONE = ZoneInfo("Asia/Colombo")


def _to_iso(value: Any) -> str | None:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    if hasattr(value, "isoformat"):
        try:
            return value.isoformat()
        except Exception:
            return str(value)
    return str(value)


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


def _average(values: Iterable[float | None]) -> float | None:
    clean_values = [value for value in values if value is not None]
    if not clean_values:
        return None
    return round(mean(clean_values), 2)


def _to_local_date_string(value: Any) -> str | None:
    if not isinstance(value, datetime):
        return None

    normalized = value
    if normalized.tzinfo is None:
        normalized = normalized.replace(tzinfo=timezone.utc)

    return normalized.astimezone(LOCAL_TIMEZONE).date().isoformat()


def _session_date_from_payload(payload: dict[str, Any]) -> str | None:
    for key in ("start_time", "created_at", "updated_at"):
        date_string = _to_local_date_string(payload.get(key))
        if date_string:
            return date_string
    return None


def _validate_date(value: str | None, field_name: str) -> str | None:
    raw_value = (value or "").strip()
    if not raw_value:
        return None
    try:
        return datetime.strptime(raw_value, "%Y-%m-%d").date().isoformat()
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name}. Use YYYY-MM-DD.",
        ) from exc


def _normalize_date_filters(
    session_date: str | None,
    date_from: str | None,
    date_to: str | None,
) -> tuple[str | None, str | None]:
    normalized_session_date = _validate_date(session_date, "session_date")
    if normalized_session_date:
        return normalized_session_date, normalized_session_date

    normalized_from = _validate_date(date_from, "date_from")
    normalized_to = _validate_date(date_to, "date_to")

    if normalized_from and normalized_to and normalized_from > normalized_to:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid date range. date_from must be less than or equal to date_to.",
        )

    if normalized_from and not normalized_to:
        normalized_to = normalized_from
    elif normalized_to and not normalized_from:
        normalized_from = normalized_to

    return normalized_from, normalized_to


def _is_within_date_range(payload_date: str | None, date_from: str | None, date_to: str | None) -> bool:
    if not payload_date:
        return False
    if date_from and payload_date < date_from:
        return False
    if date_to and payload_date > date_to:
        return False
    return True


@router.get("/filters")
async def get_dashboard_filters(
    session_date: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
) -> dict[str, Any]:
    db = get_db()
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database not connected. Please ensure Firebase is setup.",
        )

    normalized_from, normalized_to = _normalize_date_filters(session_date, date_from, date_to)
    house_room_map: dict[str, set[str]] = defaultdict(set)
    try:
        for doc in db.collection(SESSIONS_COLLECTION).stream():
            payload = doc.to_dict() or {}
            payload_session_date = _session_date_from_payload(payload)
            if (normalized_from or normalized_to) and not _is_within_date_range(payload_session_date, normalized_from, normalized_to):
                continue
            house_id = str(payload.get("house_id") or "").strip()
            room_id = str(payload.get("room_id") or "").strip()
            if house_id and room_id:
                house_room_map[house_id].add(room_id)

        houses = [
            {"house_id": house_id, "rooms": sorted(rooms)}
            for house_id, rooms in sorted(house_room_map.items(), key=lambda item: item[0].lower())
        ]
        return {"status": "success", "houses": houses}
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to fetch dashboard filters: {str(exc)}",
        ) from exc


@router.get("/visualization")
async def get_dashboard_visualization(
    house_id: str = Query(..., min_length=1),
    room_id: str = Query(..., min_length=1),
    session_type: str | None = Query(None),
    session_date: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    max_points: int = Query(2000, ge=1, le=20000),
) -> dict[str, Any]:
    db = get_db()
    if not db:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database not connected. Please ensure Firebase is setup.",
        )

    normalized_house_id = house_id.strip()
    normalized_room_id = room_id.strip()
    normalized_session_type = (session_type or "").strip().lower() or None
    normalized_from, normalized_to = _normalize_date_filters(session_date, date_from, date_to)
    if normalized_session_type and normalized_session_type not in SESSION_TYPES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid session_type. Allowed values: before, during, after.",
        )

    try:
        matched_sessions: list[dict[str, Any]] = []
        readings: list[dict[str, Any]] = []

        session_docs = list(db.collection(SESSIONS_COLLECTION).stream())
        for doc in session_docs:
            payload = doc.to_dict() or {}
            doc_house_id = str(payload.get("house_id") or "").strip()
            doc_room_id = str(payload.get("room_id") or "").strip()
            doc_session_type = str(payload.get("session_type") or "").strip().lower()
            doc_session_date = _session_date_from_payload(payload)

            if doc_house_id != normalized_house_id or doc_room_id != normalized_room_id:
                continue
            if normalized_session_type and doc_session_type != normalized_session_type:
                continue
            if (normalized_from or normalized_to) and not _is_within_date_range(doc_session_date, normalized_from, normalized_to):
                continue

            session_id = str(payload.get("session_id") or doc.id)
            session_record = {
                "session_id": session_id,
                "house_id": doc_house_id,
                "room_id": doc_room_id,
                "session_type": doc_session_type,
                "status": str(payload.get("status") or ""),
                "device_id": str(payload.get("device_id") or ""),
                "total_readings": _to_int(payload.get("total_readings"), default=0),
                "start_time": _to_iso(payload.get("start_time")),
                "end_time": _to_iso(payload.get("end_time")),
                "created_at": _to_iso(payload.get("created_at")),
                "updated_at": _to_iso(payload.get("updated_at")),
            }
            matched_sessions.append(session_record)

            readings_docs = list(
                db.collection(SESSIONS_COLLECTION)
                .document(session_id)
                .collection(READINGS_SUBCOLLECTION)
                .stream()
            )
            for reading_doc in readings_docs:
                reading_payload = reading_doc.to_dict() or {}
                readings.append(
                    {
                        "reading_id": str(reading_payload.get("reading_id") or reading_doc.id),
                        "session_id": session_id,
                        "session_type": doc_session_type,
                        "timestamp_ms": _to_int(reading_payload.get("timestamp_ms"), default=0),
                        "recorded_at": _to_iso(reading_payload.get("recorded_at")),
                        "dust": _to_float(reading_payload.get("dust")),
                        "air_quality": _to_float(reading_payload.get("air_quality")),
                        "temperature": _to_float(reading_payload.get("temperature")),
                        "humidity": _to_float(reading_payload.get("humidity")),
                        "dust_level": reading_payload.get("dust_level"),
                        "sensor_status": reading_payload.get("sensor_status"),
                    }
                )

        matched_sessions.sort(key=lambda item: item.get("start_time") or "")
        readings.sort(
            key=lambda item: (
                _to_int(item.get("timestamp_ms"), default=0),
                str(item.get("recorded_at") or ""),
            )
        )
        if len(readings) > max_points:
            readings = readings[-max_points:]

        latest_reading = readings[-1] if readings else None
        metrics = {
            "sessions_count": len(matched_sessions),
            "points_count": len(readings),
            "averages": {
                "dust": _average(reading.get("dust") for reading in readings),
                "air_quality": _average(reading.get("air_quality") for reading in readings),
                "temperature": _average(reading.get("temperature") for reading in readings),
                "humidity": _average(reading.get("humidity") for reading in readings),
            },
            "latest": latest_reading,
            "session_type_summary": {},
        }

        for one_session_type in SESSION_TYPES:
            stage_readings = [row for row in readings if row.get("session_type") == one_session_type]
            stage_sessions = [row for row in matched_sessions if row.get("session_type") == one_session_type]
            metrics["session_type_summary"][one_session_type] = {
                "session_count": len(stage_sessions),
                "points_count": len(stage_readings),
                "avg_dust": _average(row.get("dust") for row in stage_readings),
                "avg_air_quality": _average(row.get("air_quality") for row in stage_readings),
                "avg_temperature": _average(row.get("temperature") for row in stage_readings),
                "avg_humidity": _average(row.get("humidity") for row in stage_readings),
                "latest": stage_readings[-1] if stage_readings else None,
            }

        room_bucket: dict[str, dict[str, Any]] = defaultdict(
            lambda: {
                "sessions_count": 0,
                "points_count": 0,
                "dust_values": [],
                "air_quality_values": [],
                "temperature_values": [],
                "humidity_values": [],
                "anomaly_points": 0,
            }
        )

        for doc in session_docs:
            payload = doc.to_dict() or {}
            doc_house_id = str(payload.get("house_id") or "").strip()
            doc_room_id = str(payload.get("room_id") or "").strip()
            doc_session_type = str(payload.get("session_type") or "").strip().lower()
            doc_session_date = _session_date_from_payload(payload)
            if doc_house_id != normalized_house_id:
                continue
            if normalized_session_type and doc_session_type != normalized_session_type:
                continue
            if (normalized_from or normalized_to) and not _is_within_date_range(doc_session_date, normalized_from, normalized_to):
                continue

            session_id = str(payload.get("session_id") or doc.id)
            readings_docs = list(
                db.collection(SESSIONS_COLLECTION)
                .document(session_id)
                .collection(READINGS_SUBCOLLECTION)
                .stream()
            )
            room_bucket[doc_room_id]["sessions_count"] += 1

            for reading_doc in readings_docs:
                reading_payload = reading_doc.to_dict() or {}
                dust = _to_float(reading_payload.get("dust"))
                air_quality = _to_float(reading_payload.get("air_quality"))
                temperature = _to_float(reading_payload.get("temperature"))
                humidity = _to_float(reading_payload.get("humidity"))

                room_bucket[doc_room_id]["points_count"] += 1
                if dust is not None:
                    room_bucket[doc_room_id]["dust_values"].append(dust)
                if air_quality is not None:
                    room_bucket[doc_room_id]["air_quality_values"].append(air_quality)
                if temperature is not None:
                    room_bucket[doc_room_id]["temperature_values"].append(temperature)
                if humidity is not None:
                    room_bucket[doc_room_id]["humidity_values"].append(humidity)

                if (
                    (dust is not None and dust > 180)
                    or (air_quality is not None and air_quality > 250)
                    or (temperature is not None and temperature > 32)
                    or (humidity is not None and humidity > 75)
                ):
                    room_bucket[doc_room_id]["anomaly_points"] += 1

        room_ranking: list[dict[str, Any]] = []
        house_dust_values: list[float] = []
        house_air_quality_values: list[float] = []
        house_temperature_values: list[float] = []
        house_humidity_values: list[float] = []

        for one_room_id, bucket in room_bucket.items():
            avg_dust = _average(bucket["dust_values"])
            avg_air_quality = _average(bucket["air_quality_values"])
            avg_temperature = _average(bucket["temperature_values"])
            avg_humidity = _average(bucket["humidity_values"])

            house_dust_values.extend(bucket["dust_values"])
            house_air_quality_values.extend(bucket["air_quality_values"])
            house_temperature_values.extend(bucket["temperature_values"])
            house_humidity_values.extend(bucket["humidity_values"])

            anomaly_ratio = (
                bucket["anomaly_points"] / bucket["points_count"]
                if bucket["points_count"] > 0
                else 0.0
            )
            attention_score = round(
                (float(avg_dust or 0) * 0.4)
                + (float(avg_air_quality or 0) * 0.35)
                + (anomaly_ratio * 100 * 0.25),
                2,
            )

            condition = "good"
            if attention_score >= 140:
                condition = "critical"
            elif attention_score >= 95:
                condition = "warning"

            room_ranking.append(
                {
                    "room_id": one_room_id,
                    "sessions_count": bucket["sessions_count"],
                    "points_count": bucket["points_count"],
                    "avg_dust": avg_dust,
                    "avg_air_quality": avg_air_quality,
                    "avg_temperature": avg_temperature,
                    "avg_humidity": avg_humidity,
                    "anomaly_points": bucket["anomaly_points"],
                    "attention_score": attention_score,
                    "condition": condition,
                }
            )

        room_ranking.sort(key=lambda row: row["attention_score"], reverse=True)
        selected_room_rank = next(
            (index + 1 for index, row in enumerate(room_ranking) if row.get("room_id") == normalized_room_id),
            None,
        )

        selected_room_metrics = next(
            (row for row in room_ranking if row.get("room_id") == normalized_room_id),
            None,
        )
        house_averages = {
            "dust": _average(house_dust_values),
            "air_quality": _average(house_air_quality_values),
            "temperature": _average(house_temperature_values),
            "humidity": _average(house_humidity_values),
        }
        selected_vs_house = {
            "dust_delta": (
                round((selected_room_metrics.get("avg_dust") or 0) - (house_averages["dust"] or 0), 2)
                if selected_room_metrics
                else None
            ),
            "air_quality_delta": (
                round((selected_room_metrics.get("avg_air_quality") or 0) - (house_averages["air_quality"] or 0), 2)
                if selected_room_metrics
                else None
            ),
            "temperature_delta": (
                round((selected_room_metrics.get("avg_temperature") or 0) - (house_averages["temperature"] or 0), 2)
                if selected_room_metrics
                else None
            ),
            "humidity_delta": (
                round((selected_room_metrics.get("avg_humidity") or 0) - (house_averages["humidity"] or 0), 2)
                if selected_room_metrics
                else None
            ),
        }

        return {
            "status": "success",
            "house_id": normalized_house_id,
            "room_id": normalized_room_id,
            "session_filter": normalized_session_type,
            "date_from": normalized_from,
            "date_to": normalized_to,
            "session_date": normalized_from if normalized_from == normalized_to else None,
            "sessions": matched_sessions,
            "readings": readings,
            "metrics": metrics,
            "house_context": {
                "room_ranking": room_ranking,
                "selected_room_rank": selected_room_rank,
                "most_problematic_room": room_ranking[0]["room_id"] if room_ranking else None,
                "best_room": room_ranking[-1]["room_id"] if room_ranking else None,
                "house_averages": house_averages,
                "selected_room_vs_house": selected_vs_house,
            },
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to load visualization data: {str(exc)}",
        ) from exc
