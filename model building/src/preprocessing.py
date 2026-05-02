"""Dataset cleaning utilities for CleanSight AI."""

from __future__ import annotations

import numpy as np
import pandas as pd


MAIN_SENSOR_COLUMNS = ["dust", "air_quality", "temperature", "humidity"]
REQUIRED_COLUMNS = MAIN_SENSOR_COLUMNS + ["timestamp_ms"]


def validate_sensor_ranges(
    df: pd.DataFrame,
    min_temperature: float = 0.0,
    max_temperature: float = 50.0,
) -> pd.DataFrame:
    """Keep only physically realistic indoor sensor readings."""
    cleaned = df.copy()

    for column in MAIN_SENSOR_COLUMNS + ["timestamp_ms"]:
        cleaned[column] = pd.to_numeric(cleaned[column], errors="coerce")

    valid_mask = (
        (cleaned["dust"] >= 0)
        & (cleaned["air_quality"] >= 0)
        & cleaned["temperature"].between(min_temperature, max_temperature)
        & cleaned["humidity"].between(0, 100)
    )
    return cleaned.loc[valid_mask].copy()


def clean_dataset(df: pd.DataFrame) -> pd.DataFrame:
    """Clean raw Firestore readings and prepare timestamp columns."""
    cleaned = df.copy()

    missing_required = [col for col in REQUIRED_COLUMNS if col not in cleaned.columns]
    if missing_required:
        raise ValueError(f"Missing required columns: {missing_required}")

    # Remove rows where the main ML inputs are missing.
    cleaned = cleaned.dropna(subset=REQUIRED_COLUMNS)

    # If sensor_status exists, keep OK readings and readings with no status.
    if "sensor_status" in cleaned.columns:
        status = cleaned["sensor_status"].astype(str).str.strip().str.upper()
        cleaned = cleaned[(status.eq("OK")) | (status.eq("")) | cleaned["sensor_status"].isna()]

    cleaned = validate_sensor_ranges(cleaned)

    # Convert millisecond timestamps to datetime for time-based features and plots.
    cleaned["timestamp"] = pd.to_datetime(cleaned["timestamp_ms"], unit="ms", errors="coerce")
    cleaned = cleaned.dropna(subset=["timestamp"])

    if "recorded_at" in cleaned.columns:
        cleaned["recorded_at"] = pd.to_datetime(cleaned["recorded_at"], errors="coerce")

    # Remove duplicate readings. reading_id is preferred, then session/time fallback.
    if "reading_id" in cleaned.columns:
        cleaned = cleaned.drop_duplicates(subset=["reading_id"], keep="first")
    elif {"session_id", "timestamp_ms"}.issubset(cleaned.columns):
        cleaned = cleaned.drop_duplicates(subset=["session_id", "timestamp_ms"], keep="first")
    else:
        cleaned = cleaned.drop_duplicates(keep="first")

    group_columns = [col for col in ["session_id", "timestamp"] if col in cleaned.columns]
    cleaned = cleaned.sort_values(group_columns or ["timestamp"]).reset_index(drop=True)

    # Replace infinite values that can appear after calculations in later notebooks.
    cleaned = cleaned.replace([np.inf, -np.inf], np.nan)
    return cleaned
