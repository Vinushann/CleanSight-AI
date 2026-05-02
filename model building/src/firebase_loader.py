"""Firestore loading utilities for the CleanSight AI model pipeline.

This module reads the active Firestore structure:
sessions/{session_id}/readings/{reading_id}
and converts it into a flat pandas DataFrame for ML work.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Any

import firebase_admin
import pandas as pd
from firebase_admin import credentials, firestore


SESSION_COLUMNS = [
    "session_id",
    "house_id",
    "room_id",
    "session_type",
    "device_id",
    "start_time",
    "end_time",
    "status",
    "reading_interval_seconds",
    "total_readings",
    "created_at",
    "updated_at",
]

READING_COLUMNS = [
    "reading_id",
    "timestamp_ms",
    "recorded_at",
    "dust",
    "air_quality",
    "temperature",
    "humidity",
    "dust_level",
    "sensor_status",
    "notes",
    "cleanliness_status",
    "anomaly_status",
    "cleanliness_score",
    "cleaning_urgency",
    "cleanliness_prediction",
    "anomaly_prediction",
    "prediction_reason",
    "anomaly_reason",
    "model_source",
    "model_version",
]


def _make_json_safe(value: Any) -> Any:
    """Convert Firestore timestamp-like values into CSV-friendly strings."""
    if hasattr(value, "isoformat"):
        return value.isoformat()
    return value


def connect_firestore(service_account_path: str | None = None):
    """Connect to Firestore using a local Firebase service account JSON file.

    Args:
        service_account_path: Path to the Firebase service account JSON file.
            If omitted, FIREBASE_SERVICE_ACCOUNT_PATH is read from the
            environment.

    Returns:
        A Firestore client.
    """
    key_path = (
        service_account_path
        or os.getenv("FIREBASE_SERVICE_ACCOUNT_PATH")
        or os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
    )
    if not key_path:
        raise ValueError(
            "Provide service_account_path or set FIREBASE_SERVICE_ACCOUNT_PATH."
        )

    key_file = Path(key_path).expanduser()
    if not key_file.exists():
        raise FileNotFoundError(f"Firebase service account file not found: {key_file}")

    if not firebase_admin._apps:
        cred = credentials.Certificate(str(key_file))
        firebase_admin.initialize_app(cred)

    return firestore.client()


def load_sessions_and_readings(db, sessions_collection: str = "sessions") -> pd.DataFrame:
    """Load sessions and their readings subcollections into one DataFrame."""
    rows: list[dict[str, Any]] = []

    for session_doc in db.collection(sessions_collection).stream():
        session_data = session_doc.to_dict() or {}
        session_data.setdefault("session_id", session_doc.id)

        session_row = {
            col: _make_json_safe(session_data.get(col)) for col in SESSION_COLUMNS
        }

        readings_ref = session_doc.reference.collection("readings")
        for reading_doc in readings_ref.stream():
            reading_data = reading_doc.to_dict() or {}
            reading_data.setdefault("reading_id", reading_doc.id)

            reading_row = {
                col: _make_json_safe(reading_data.get(col)) for col in READING_COLUMNS
            }
            rows.append({**session_row, **reading_row})

    columns = SESSION_COLUMNS + [col for col in READING_COLUMNS if col not in SESSION_COLUMNS]
    return pd.DataFrame(rows, columns=columns)


def export_firestore_dataset(
    service_account_path: str,
    output_csv_path: str = "data/raw/firestore_sensor_readings_raw.csv",
) -> pd.DataFrame:
    """Connect to Firestore, load readings, save them as CSV, and return the DataFrame."""
    db = connect_firestore(service_account_path)
    df = load_sessions_and_readings(db)

    output_path = Path(output_csv_path)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(output_path, index=False)
    return df
