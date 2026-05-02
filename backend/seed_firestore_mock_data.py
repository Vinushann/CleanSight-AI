#!/usr/bin/env python3
"""
Seed Firestore with mock IoT + Edge AI prediction data for CleanSight AI.

Run:
    python seed_firestore_mock_data.py
"""

from __future__ import annotations

import random
import time
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Literal
from uuid import uuid4

import firebase_admin
from firebase_admin import credentials, firestore

# ==================================================
# Configuration
# ==================================================
NEW_SERVICE_ACCOUNT_PATH = "/Users/vinushan/Downloads/cleansight-ai-new-firebase-adminsdk-fbsvc-1424350d32.json"
HOUSE_ID = "H001"
ROOM_ID = "R001"
DEVICE_ID = "esp32_all_sensors_01"
READING_INTERVAL_SECONDS = 4
READINGS_PER_SESSION = 60

SessionType = Literal["before", "during", "after"]
CleanlinessStatus = Literal["dirty", "moderate", "clean"]
AnomalyStatus = Literal["normal", "anomaly"]
TrendDirection = Literal["increasing", "decreasing", "stable"]


# ==================================================
# Core helpers
# ==================================================
def initialize_firestore():
    """Loads service account key, initializes Firebase app, and returns Firestore client."""
    backend_dir = Path(__file__).resolve().parent
    env_credential = os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
    candidate_paths = [
        Path(env_credential).expanduser() if env_credential else None,
        Path(NEW_SERVICE_ACCOUNT_PATH),
    ]

    service_path = next((path for path in candidate_paths if path and path.exists()), None)

    if service_path is None:
        raise FileNotFoundError(
            "Service account key not found. "
            "Set GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_PATH to the new Firebase JSON key."
        )

    if not firebase_admin._apps:
        cred = credentials.Certificate(str(service_path))
        firebase_admin.initialize_app(cred)

    return firestore.client()


def get_cleanliness_status(score: float) -> CleanlinessStatus:
    """Returns cleanliness label based on score."""
    if score < 40:
        return "dirty"
    if score < 70:
        return "moderate"
    return "clean"


def get_dust_level(dust: float) -> Literal["clean", "slight", "heavy"]:
    """Returns dust level bucket for dashboard badge."""
    if dust < 25:
        return "clean"
    if dust < 80:
        return "slight"
    return "heavy"


def calculate_trend_direction(current_score: float, next_score: float) -> TrendDirection:
    """Returns trend direction by comparing current and predicted next score."""
    delta = next_score - current_score
    if delta > 1.5:
        return "increasing"
    if delta < -1.5:
        return "decreasing"
    return "stable"


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def _session_ranges(session_type: SessionType):
    if session_type == "before":
        return {
            "dust": (70, 120),
            "air_quality": (180, 260),
            "temperature": (29, 32),
            "humidity": (70, 85),
            "cleanliness": (20, 45),
        }
    if session_type == "during":
        return {
            "dust": (40, 110),
            "air_quality": (140, 230),
            "temperature": (28, 32),
            "humidity": (65, 85),
            "cleanliness": (40, 70),
        }
    return {
        "dust": (5, 35),
        "air_quality": (80, 150),
        "temperature": (27, 31),
        "humidity": (55, 75),
        "cleanliness": (70, 95),
    }


def _prediction_reason(dust: float, air_quality: float, score: float) -> str:
    if score < 40:
        return "High dust and poor air quality reduced cleanliness score"
    if score < 70:
        return "Moderate dust and air quality produced a mid-range cleanliness score"
    return "Low dust and improved air quality boosted cleanliness score"


def _anomaly_reason(anomaly: AnomalyStatus, session_type: SessionType) -> str:
    if anomaly == "normal":
        return ""
    if session_type == "during":
        return "Particle disturbance during active cleaning caused a temporary spike"
    return "Sensor pattern deviated from expected baseline"


def _generate_cleanliness_score(session_type: SessionType, index: int) -> float:
    """
    Generate realistic cleanliness progression by session:
    - before: generally low
    - during: improving with fluctuations
    - after: high and stable
    """
    progress = index / max(READINGS_PER_SESSION - 1, 1)
    ranges = _session_ranges(session_type)["cleanliness"]

    if session_type == "before":
        base = random.uniform(ranges[0], ranges[1])
    elif session_type == "during":
        base = ranges[0] + (ranges[1] - ranges[0]) * progress + random.uniform(-6, 6)
    else:
        base = random.uniform(ranges[0], ranges[1]) + random.uniform(-2, 2)

    return round(_clamp(base, ranges[0], ranges[1]), 2)


def generate_mock_reading(session_type: SessionType, index: int, base_timestamp_ms: int) -> dict:
    """Generates one realistic reading dictionary containing all required fields."""
    reading_id = f"reading_{uuid4().hex[:12]}"
    timestamp_ms = base_timestamp_ms + (index * READING_INTERVAL_SECONDS * 1000)
    ranges = _session_ranges(session_type)

    dust = round(random.uniform(*ranges["dust"]), 2)
    air_quality = round(random.uniform(*ranges["air_quality"]), 2)
    temperature = round(random.uniform(*ranges["temperature"]), 2)
    humidity = round(random.uniform(*ranges["humidity"]), 2)

    cleanliness_score = _generate_cleanliness_score(session_type, index)
    predicted_next_cleanliness = round(
        _clamp(cleanliness_score + random.uniform(-4.0, 5.0), 0, 100),
        2,
    )

    anomaly_probability = 0.18 if session_type == "during" else 0.08
    anomaly_prediction: AnomalyStatus = "anomaly" if random.random() < anomaly_probability else "normal"

    trend_direction = calculate_trend_direction(cleanliness_score, predicted_next_cleanliness)
    cleanliness_status = get_cleanliness_status(cleanliness_score)

    return {
        # Basic metadata
        "reading_id": reading_id,
        "session_id": "",  # filled during write
        "house_id": HOUSE_ID,
        "room_id": ROOM_ID,
        "device_id": DEVICE_ID,
        "timestamp_ms": timestamp_ms,
        "recorded_at": firestore.SERVER_TIMESTAMP,
        # Raw sensor values
        "dust": dust,
        "air_quality": air_quality,
        "temperature": temperature,
        "humidity": humidity,
        # Sensor status
        "dust_level": get_dust_level(dust),
        "sensor_status": "OK",
        # Edge AI / ML predictions
        "cleanliness_score": cleanliness_score,
        "cleanliness_status": cleanliness_status,
        "anomaly_prediction": anomaly_prediction,
        "predicted_next_cleanliness": predicted_next_cleanliness,
        "actual_cleanliness": cleanliness_score,
        "trend_direction": trend_direction,
        "model_source": "python_mock_model",
        "model_version": "v1",
        # Repeated session filtering field
        "session_type": session_type,
        # Optional explanation fields
        "prediction_reason": _prediction_reason(dust, air_quality, cleanliness_score),
        "anomaly_reason": _anomaly_reason(anomaly_prediction, session_type),
        "notes": "Mock reading generated for dashboard testing",
    }


def create_session(db, session_type: SessionType) -> str:
    """Creates Firestore session document and returns session_id."""
    session_id = f"session_{session_type}_{uuid4().hex[:8]}"
    session_doc = {
        "session_id": session_id,
        "house_id": HOUSE_ID,
        "room_id": ROOM_ID,
        "session_type": session_type,
        "device_id": DEVICE_ID,
        "start_time": firestore.SERVER_TIMESTAMP,
        "end_time": firestore.SERVER_TIMESTAMP,
        "status": "completed",
        "reading_interval_seconds": READING_INTERVAL_SECONDS,
        "total_readings": 0,
        "created_at": firestore.SERVER_TIMESTAMP,
        "updated_at": firestore.SERVER_TIMESTAMP,
    }
    db.collection("sessions").document(session_id).set(session_doc)
    print(f"[SESSION] Created: {session_id} ({session_type})")
    return session_id


def write_readings_for_session(db, session_id: str, session_type: SessionType) -> None:
    """Writes readings subcollection and updates total_readings for the session."""
    session_ref = db.collection("sessions").document(session_id)
    base_timestamp_ms = int(time.time() * 1000)
    batch_size = 25
    written = 0

    for start_idx in range(0, READINGS_PER_SESSION, batch_size):
        batch = db.batch()
        end_idx = min(start_idx + batch_size, READINGS_PER_SESSION)
        for i in range(start_idx, end_idx):
            reading = generate_mock_reading(session_type, i, base_timestamp_ms)
            reading["session_id"] = session_id

            reading_id = str(reading["reading_id"])
            reading_ref = session_ref.collection("readings").document(reading_id)
            batch.set(reading_ref, reading)
            written += 1
        batch.commit()
        print(f"[READINGS] {session_id}: committed {written}/{READINGS_PER_SESSION}")

    session_ref.update(
        {
            "total_readings": READINGS_PER_SESSION,
            "updated_at": firestore.SERVER_TIMESTAMP,
        }
    )
    print(f"[SESSION] Updated total_readings={READINGS_PER_SESSION} for {session_id}")


def main():
    """Runs the full seeding process."""
    print("Starting Firestore mock IoT data seeding...")
    print(f"UTC now: {datetime.now(timezone.utc).isoformat()}")

    try:
        db = initialize_firestore()
        print("Firestore initialized successfully.")
    except Exception as exc:
        print(f"[ERROR] Failed to initialize Firestore: {exc}")
        raise

    session_order: list[SessionType] = ["before", "during", "after"]

    try:
        for session_type in session_order:
            session_id = create_session(db, session_type)
            write_readings_for_session(db, session_id, session_type)
        print("Seeding completed successfully.")
    except Exception as exc:
        print(f"[ERROR] Seeding failed: {exc}")
        raise


if __name__ == "__main__":
    main()
