#!/usr/bin/env python3
"""
IoT scenario simulator that sends realistic multi-sensor data through backend APIs.

Flow:
1) Ask user for house_id, room_id, and duration
2) Start session via POST /api/session/start
3) Send sensor readings every 4 seconds via POST /api/sensor-data
4) Stop session via POST /api/session/stop
5) Optional batch mode runs before -> during -> after automatically
"""

from __future__ import annotations

import math
import os
import random
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

import requests
from dotenv import load_dotenv

SessionType = Literal["before", "during", "after"]
CleanlinessStatus = Literal["clean", "needs_attention", "dirty"]
AnomalyStatus = Literal["normal", "anomaly"]
CleaningUrgency = Literal["low", "medium", "high", "critical"]

load_dotenv(Path(__file__).resolve().parent / ".env", override=False)
DEFAULT_BACKEND_BASE_URL = os.getenv("BACKEND_BASE_URL", "http://127.0.0.1:8000").strip()


@dataclass
class Config:
    api_base_url: str
    house_id: str
    room_id: str
    session_type: SessionType
    duration_minutes: float
    interval_seconds: int = 4
    device_id: str = "esp32_all_sensors_01"
    request_timeout_seconds: int = 30
    max_retries: int = 3


def _prompt_non_empty(label: str) -> str:
    while True:
        value = input(f"{label}: ").strip()
        if value:
            return value
        print(f"{label} cannot be empty.")


def _prompt_session_type() -> SessionType:
    valid = {"before", "during", "after"}
    while True:
        value = input("Session type (before/during/after): ").strip().lower()
        if value in valid:
            return value  # type: ignore[return-value]
        print("Invalid session type. Use: before, during, or after.")


def _prompt_duration_minutes() -> float:
    while True:
        raw = input("Duration in minutes (example: 3): ").strip()
        try:
            value = float(raw)
            if value <= 0:
                raise ValueError
            return value
        except ValueError:
            print("Duration must be a positive number.")


def _prompt_yes_no(label: str, default_yes: bool = True) -> bool:
    if default_yes:
        suffix = " [Y/n]: "
    else:
        suffix = " [y/N]: "

    while True:
        raw = input(label + suffix).strip().lower()
        if not raw:
            return default_yes
        if raw in {"y", "yes"}:
            return True
        if raw in {"n", "no"}:
            return False
        print("Please answer with y/yes or n/no.")


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _dust_level(dust: float) -> str:
    if dust < 25:
        return "clean"
    if dust < 80:
        return "slight"
    return "heavy"


def _weighted_choice(choices: list[tuple[str, float]]) -> str:
    labels = [label for label, _ in choices]
    weights = [weight for _, weight in choices]
    return random.choices(labels, weights=weights, k=1)[0]


def _derive_cleanliness_status(score: int) -> CleanlinessStatus:
    if score >= 85:
        return "clean"
    if score >= 55:
        return "needs_attention"
    return "dirty"


def _derive_cleaning_urgency(
    cleanliness_status: CleanlinessStatus,
    cleanliness_score: int,
    anomaly_status: AnomalyStatus,
) -> CleaningUrgency:
    if cleanliness_score < 40:
        urgency: CleaningUrgency = "critical"
    elif cleanliness_status == "dirty":
        urgency = "high"
    elif cleanliness_status == "needs_attention":
        urgency = "medium"
    else:
        urgency = "low"

    if anomaly_status == "anomaly":
        if urgency == "low":
            return "medium"
        if urgency == "medium":
            return "high"
    return urgency


def _derive_anomaly_status(session_type: SessionType, progress: float, index: int) -> AnomalyStatus:
    if session_type == "before":
        anomaly_chance = 0.18
        periodic_anomaly = index % 5 == 3
    elif session_type == "during":
        anomaly_chance = 0.28
        periodic_anomaly = index % 4 == 2
    else:
        anomaly_chance = 0.14
        periodic_anomaly = progress < 0.25 and index % 6 == 1

    if periodic_anomaly or random.random() < anomaly_chance:
        return "anomaly"
    return "normal"


def _select_cleanliness_score(session_type: SessionType, progress: float) -> int:
    if session_type == "before":
        status = _weighted_choice(
            [
                ("dirty", 0.62 + 0.12 * progress),
                ("needs_attention", 0.38 - 0.12 * progress),
            ]
        )
        if status == "dirty":
            return random.randint(28, 54)
        return random.randint(55, 69)

    if session_type == "during":
        status = _weighted_choice(
            [
                ("dirty", 0.78 + 0.10 * progress),
                ("needs_attention", 0.22 - 0.10 * progress),
            ]
        )
        if status == "dirty":
            return random.randint(39, 54)
        return random.randint(55, 72)

    status = _weighted_choice(
        [
            ("clean", 0.72 + 0.23 * progress),
            ("needs_attention", 0.28 - 0.23 * progress),
        ]
    )
    if status == "clean":
        return random.randint(85, 99)
    return random.randint(80, 84)


def _build_prediction_reason(
    session_type: SessionType,
    cleanliness_status: CleanlinessStatus,
    cleanliness_score: int,
) -> str:
    if cleanliness_status == "clean":
        return (
            f"{session_type.title()} session settled into low dust and low air-quality load, "
            f"supporting a strong cleanliness score of {cleanliness_score}%."
        )
    if cleanliness_status == "needs_attention":
        return (
            f"{session_type.title()} session shows moderate pollution buildup, so the room still needs attention "
            f"with a cleanliness score of {cleanliness_score}%."
        )
    return (
        f"{session_type.title()} session has elevated dust and air-quality readings, so the room is labeled dirty "
        f"with a cleanliness score of {cleanliness_score}%."
    )


def _build_anomaly_reason(
    session_type: SessionType,
    anomaly_status: AnomalyStatus,
    dust: float,
    air_quality: float,
) -> str:
    if anomaly_status == "anomaly":
        return (
            f"{session_type.title()} session contains an unusual spike pattern "
            f"(dust={dust:.1f}, air_quality={air_quality:.1f})."
        )
    return (
        f"{session_type.title()} session remains within the expected sensor pattern "
        f"(dust={dust:.1f}, air_quality={air_quality:.1f})."
    )


def _generate_reading(session_type: SessionType, progress: float, index: int) -> dict:
    cleanliness_score = _select_cleanliness_score(session_type, progress)
    cleanliness_status = _derive_cleanliness_status(cleanliness_score)
    anomaly_status = _derive_anomaly_status(session_type, progress, index)
    severity = 1.0 - (cleanliness_score / 100.0)

    wave = math.sin(index * 0.55) * 2.5 + math.cos(index * 0.23) * 1.8
    anomaly_dust_bump = random.uniform(8.0, 18.0) if anomaly_status == "anomaly" else 0.0
    anomaly_aq_bump = random.uniform(22.0, 58.0) if anomaly_status == "anomaly" else 0.0

    if session_type == "before":
        dust_base = 16 + severity * 42 + progress * 8
        aq_base = 75 + severity * 135 + progress * 18
        temp_base = 27.1 + 0.6 * progress
        hum_base = 59.0 + 3.0 * progress
    elif session_type == "during":
        spike = random.uniform(5.0, 14.0) if index % 3 == 1 else 0.0
        dust_base = 22 + severity * 52 + progress * 12 + spike
        aq_base = 95 + severity * 155 + progress * 28 + spike * 2.2
        temp_base = 28.2 + 1.0 * progress
        hum_base = 64.0 + 4.0 * progress
    else:
        decay = math.exp(-2.5 * progress)
        dust_base = 7 + severity * 26 + decay * 6
        aq_base = 50 + severity * 78 + decay * 12
        temp_base = 28.6 - 1.4 * progress
        hum_base = 66.0 - 8.0 * progress

    dust = _clamp(dust_base + wave + random.gauss(0, 2.0) + anomaly_dust_bump, 3, 500)
    air_quality = _clamp(aq_base + wave * 2.5 + random.gauss(0, 5.0) + anomaly_aq_bump, 20, 600)
    temperature = _clamp(
        temp_base + random.gauss(0, 0.24) + (0.55 if anomaly_status == "anomaly" else 0.0),
        24.0,
        36.0,
    )
    humidity = _clamp(
        hum_base + random.gauss(0, 1.5) + (2.0 if anomaly_status == "anomaly" else 0.0),
        35.0,
        92.0,
    )
    cleaning_urgency = _derive_cleaning_urgency(cleanliness_status, cleanliness_score, anomaly_status)

    return {
        "dust": round(dust, 2),
        "air_quality": round(air_quality, 2),
        "temperature": round(temperature, 2),
        "humidity": round(humidity, 2),
        "dust_level": _dust_level(dust),
        "cleanliness_status": cleanliness_status,
        "anomaly_status": anomaly_status,
        "cleanliness_score": cleanliness_score,
        "cleaning_urgency": cleaning_urgency,
        "cleanliness_prediction": cleanliness_status,
        "anomaly_prediction": anomaly_status,
        "prediction_reason": _build_prediction_reason(
            session_type=session_type,
            cleanliness_status=cleanliness_status,
            cleanliness_score=cleanliness_score,
        ),
        "anomaly_reason": _build_anomaly_reason(
            session_type=session_type,
            anomaly_status=anomaly_status,
            dust=dust,
            air_quality=air_quality,
        ),
        "model_source": "synthetic_rule_engine",
        "model_version": "tinyml-dataset-v1",
        "sensor_status": "ok",
    }


def _post_json(session: requests.Session, url: str, payload: dict, timeout: int) -> dict:
    response = session.post(url, json=payload, timeout=timeout)
    response.raise_for_status()
    return response.json()


def _post_json_with_retry(
    session: requests.Session,
    url: str,
    payload: dict,
    timeout: int,
    retries: int,
    retry_delay_seconds: float,
) -> dict:
    last_error: Exception | None = None
    for attempt in range(1, retries + 1):
        try:
            return _post_json(session, url, payload, timeout)
        except (requests.Timeout, requests.ConnectionError, requests.HTTPError) as exc:
            last_error = exc
            if attempt == retries:
                break
            time.sleep(retry_delay_seconds * attempt)

    assert last_error is not None
    raise last_error


def _stop_session_safely(session: requests.Session, stop_url: str, session_id: str, config: Config) -> None:
    payload = {"session_id": session_id}
    try:
        stop_result = _post_json_with_retry(
            session=session,
            url=stop_url,
            payload=payload,
            timeout=config.request_timeout_seconds,
            retries=max(3, config.max_retries),
            retry_delay_seconds=0.8,
        )
        print(f"Session stopped: {stop_result.get('session_id')}")
        return
    except requests.HTTPError as exc:
        response_text = ""
        try:
            response_text = exc.response.text if exc.response is not None else ""
        except Exception:
            response_text = ""

        # If the first stop request succeeded but response was delayed, retry can return "already stopped".
        if exc.response is not None and exc.response.status_code == 400 and "already stopped" in response_text.lower():
            print(f"Session already stopped on backend: {session_id}")
            return
        raise


def _get_active_session_id(session: requests.Session, control_url: str, timeout: int) -> str | None:
    response = session.get(control_url, timeout=timeout)
    response.raise_for_status()
    payload = response.json()
    if payload.get("collecting") and payload.get("session_id"):
        return str(payload["session_id"])
    return None


def _start_session_with_recovery(
    session: requests.Session,
    start_url: str,
    control_url: str,
    stop_url: str,
    start_payload: dict,
    config: Config,
) -> dict:
    try:
        return _post_json(session, start_url, start_payload, config.request_timeout_seconds)
    except requests.HTTPError as exc:
        response_text = ""
        try:
            response_text = exc.response.text if exc.response is not None else ""
        except Exception:
            response_text = ""

        conflict_is_active_session = (
            exc.response is not None
            and exc.response.status_code == 409
            and "already active" in response_text.lower()
        )
        if not conflict_is_active_session:
            raise

        print("Detected existing active session. Attempting automatic recovery...")
        active_session_id = _get_active_session_id(
            session=session,
            control_url=control_url,
            timeout=config.request_timeout_seconds,
        )
        if not active_session_id:
            raise

        _stop_session_safely(
            session=session,
            stop_url=stop_url,
            session_id=active_session_id,
            config=config,
        )
        print("Retrying session start...")
        return _post_json(session, start_url, start_payload, config.request_timeout_seconds)


def run(config: Config) -> int:
    start_url = f"{config.api_base_url}/api/session/start"
    sensor_url = f"{config.api_base_url}/api/sensor-data"
    stop_url = f"{config.api_base_url}/api/session/stop"
    control_url = f"{config.api_base_url}/api/device/control"

    total_points = max(1, int((config.duration_minutes * 60) / config.interval_seconds))
    session_id: str | None = None
    session_stopped = False

    with requests.Session() as http:
        try:
            print("\nStarting session...")
            start_payload = {
                "house_id": config.house_id,
                "room_id": config.room_id,
                "session_type": config.session_type,
            }
            start_result = _start_session_with_recovery(
                session=http,
                start_url=start_url,
                control_url=control_url,
                stop_url=stop_url,
                start_payload=start_payload,
                config=config,
            )
            session_id = start_result["session_id"]
            print(f"Session started: {session_id}")
            print(f"Sending {total_points} points every {config.interval_seconds}s...\n")

            next_tick = time.monotonic()
            for i in range(total_points):
                progress = 0.0 if total_points == 1 else i / (total_points - 1)
                reading = _generate_reading(config.session_type, progress, i)
                payload = {
                    "device_id": config.device_id,
                    "session_id": session_id,
                    "timestamp_ms": int(time.time() * 1000),
                    **reading,
                }
                try:
                    _post_json_with_retry(
                        session=http,
                        url=sensor_url,
                        payload=payload,
                        timeout=config.request_timeout_seconds,
                        retries=config.max_retries,
                        retry_delay_seconds=0.6,
                    )
                except Exception as exc:
                    # Keep simulation running even if one write fails transiently.
                    print(f"[{i + 1:03d}/{total_points}] write failed after retries: {exc}")
                    continue

                print(
                    f"[{i + 1:03d}/{total_points}] "
                    f"dust={reading['dust']}, aq={reading['air_quality']}, "
                    f"temp={reading['temperature']}, hum={reading['humidity']}, "
                    f"status={reading['cleanliness_status']}, score={reading['cleanliness_score']}, "
                    f"anomaly={reading['anomaly_status']}, urgency={reading['cleaning_urgency']}"
                )

                next_tick += config.interval_seconds
                sleep_for = next_tick - time.monotonic()
                if sleep_for > 0:
                    time.sleep(sleep_for)

            print("\nStopping session...")
            _stop_session_safely(http, stop_url, session_id, config)
            session_stopped = True
            print(f"Simulation complete for session_type='{config.session_type}'.")
            return 0

        except KeyboardInterrupt:
            print("\nInterrupted by user.")
            return 130
        except requests.HTTPError as exc:
            body = ""
            try:
                body = exc.response.text if exc.response is not None else ""
            except Exception:
                body = ""
            print(f"HTTP error: {exc}. Response: {body}")
            return 1
        except Exception as exc:  # pragma: no cover - defensive runtime guard
            print(f"Unexpected error: {exc}")
            return 1
        finally:
            if session_id and not session_stopped:
                try:
                    _stop_session_safely(http, stop_url, session_id, config)
                except Exception:
                    pass


def main() -> int:
    print("CleanSight IoT Session Simulator (Backend API path)")
    print("---------------------------------------------------")
    api_base_url = DEFAULT_BACKEND_BASE_URL.rstrip("/")
    print(f"Using backend base URL: {api_base_url}")
    house_id = _prompt_non_empty("House ID")
    room_id = _prompt_non_empty("Room ID")
    duration_minutes = _prompt_duration_minutes()
    run_all_sessions = _prompt_yes_no(
        "Auto-run all sessions in order (before -> during -> after)?",
        default_yes=True,
    )

    if run_all_sessions:
        for session_type in ("before", "during", "after"):
            print("\n===================================================")
            print(f"Running auto session: {session_type}")
            print("===================================================")
            config = Config(
                api_base_url=api_base_url.rstrip("/"),
                house_id=house_id,
                room_id=room_id,
                session_type=session_type,
                duration_minutes=duration_minutes,
            )
            result = run(config)
            if result != 0:
                print(f"Batch stopped at session_type='{session_type}' with exit code {result}.")
                return result
        print("\nBatch simulation complete for all 3 sessions.")
        return 0

    session_type = _prompt_session_type()
    config = Config(
        api_base_url=api_base_url.rstrip("/"),
        house_id=house_id,
        room_id=room_id,
        session_type=session_type,
        duration_minutes=duration_minutes,
    )
    return run(config)


if __name__ == "__main__":
    sys.exit(main())
