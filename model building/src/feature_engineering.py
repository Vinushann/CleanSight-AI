"""Feature engineering and weak-label creation for CleanSight AI."""

from __future__ import annotations

import re

import numpy as np
import pandas as pd


SENSOR_COLUMNS = ["dust", "air_quality", "temperature", "humidity"]
VALID_LABELS = {"clean", "needs_attention", "dirty"}


def create_time_features(df: pd.DataFrame, timestamp_col: str = "timestamp") -> pd.DataFrame:
    """Create simple time-of-day features from the reading timestamp."""
    featured = df.copy()
    featured[timestamp_col] = pd.to_datetime(featured[timestamp_col], errors="coerce")
    featured["hour_of_day"] = featured[timestamp_col].dt.hour
    featured["minute_of_hour"] = featured[timestamp_col].dt.minute
    return featured


def create_rolling_features(df: pd.DataFrame, window: int = 3) -> pd.DataFrame:
    """Create rolling mean features per session when session_id is available."""
    featured = df.copy()
    group_key = "session_id" if "session_id" in featured.columns else None
    sort_cols = [col for col in [group_key, "timestamp"] if col]
    featured = featured.sort_values(sort_cols or ["timestamp"]).copy()

    for column in SENSOR_COLUMNS:
        target = f"{column}_rolling_mean_{window}"
        if group_key:
            featured[target] = (
                featured.groupby(group_key, group_keys=False)[column]
                .rolling(window=window, min_periods=1)
                .mean()
                .reset_index(level=0, drop=True)
            )
        else:
            featured[target] = featured[column].rolling(window=window, min_periods=1).mean()

    return featured


def create_lag_features(df: pd.DataFrame, lag: int = 1) -> pd.DataFrame:
    """Create previous-reading features used by the dust forecasting model."""
    featured = df.copy()
    group_key = "session_id" if "session_id" in featured.columns else None
    sort_cols = [col for col in [group_key, "timestamp"] if col]
    featured = featured.sort_values(sort_cols or ["timestamp"]).copy()

    for column in SENSOR_COLUMNS:
        target = f"{column}_lag_{lag}"
        if group_key:
            featured[target] = featured.groupby(group_key)[column].shift(lag)
        else:
            featured[target] = featured[column].shift(lag)

        # For the first reading in a session, use the current value as a safe fallback.
        featured[target] = featured[target].fillna(featured[column])

    return featured


def create_next_dust_target(df: pd.DataFrame) -> pd.DataFrame:
    """Create the next_dust target for short-term dust forecasting."""
    featured = df.copy()
    group_key = "session_id" if "session_id" in featured.columns else None
    sort_cols = [col for col in [group_key, "timestamp"] if col]
    featured = featured.sort_values(sort_cols or ["timestamp"]).copy()

    if group_key:
        featured["next_dust"] = featured.groupby(group_key)["dust"].shift(-1)
    else:
        featured["next_dust"] = featured["dust"].shift(-1)

    return featured


def _normalize_label(value) -> str | None:
    if pd.isna(value):
        return None
    text = str(value).strip().lower().replace("-", "_").replace(" ", "_")
    if text in VALID_LABELS:
        return text
    return None


def _label_from_notes(notes) -> str | None:
    if pd.isna(notes):
        return None
    text = str(notes).lower()
    text = re.sub(r"[^a-z_ ]", " ", text)

    if "needs_attention" in text or "needs attention" in text or "moderate" in text:
        return "needs_attention"
    if "dirty" in text or "unclean" in text or "dusty" in text:
        return "dirty"
    if "clean" in text:
        return "clean"
    return None


def create_temporary_labels(df: pd.DataFrame) -> pd.DataFrame:
    """Create cleanliness_label using manual labels first, then weak labels.

    Weak labels are only a temporary training target. They should be replaced or
    validated later using real human cleaning observations.
    """
    labeled = df.copy()
    label = pd.Series([None] * len(labeled), index=labeled.index, dtype="object")

    for column in ["cleanliness_label", "manual_label", "label"]:
        if column in labeled.columns:
            normalized = labeled[column].apply(_normalize_label)
            label = label.where(label.notna(), normalized)

    if "notes" in labeled.columns:
        note_labels = labeled["notes"].apply(_label_from_notes)
        label = label.where(label.notna(), note_labels)

    needs_weak_label = label.isna()
    if needs_weak_label.any():
        dust_low = labeled["dust"].quantile(0.33)
        dust_high = labeled["dust"].quantile(0.66)
        aq_low = labeled["air_quality"].quantile(0.33)
        aq_high = labeled["air_quality"].quantile(0.66)

        weak = np.where(
            (labeled["dust"] <= dust_low) & (labeled["air_quality"] <= aq_low),
            "clean",
            np.where(
                (labeled["dust"] >= dust_high) | (labeled["air_quality"] >= aq_high),
                "dirty",
                "needs_attention",
            ),
        )
        label.loc[needs_weak_label] = weak[needs_weak_label]

    labeled["cleanliness_label"] = label
    labeled["label_source"] = np.where(needs_weak_label, "weak_sensor_rule", "manual")
    return labeled


def build_features(df: pd.DataFrame) -> pd.DataFrame:
    """Apply all standard CleanSight AI feature engineering steps."""
    featured = create_time_features(df)
    featured = create_rolling_features(featured, window=3)
    featured = create_lag_features(featured, lag=1)
    featured = create_next_dust_target(featured)
    featured = create_temporary_labels(featured)
    return featured.reset_index(drop=True)
