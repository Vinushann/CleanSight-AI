"""Inference helpers for saved CleanSight AI models."""

from __future__ import annotations

import json
from datetime import datetime
from pathlib import Path

import joblib
import pandas as pd


def load_models(model_dir: str = "models") -> dict:
    """Load trained models and their feature lists from disk."""
    path = Path(model_dir)
    with (path / "model_features.json").open("r", encoding="utf-8") as file:
        features = json.load(file)

    return {
        "decision_tree": joblib.load(path / "decision_tree_cleanliness.pkl"),
        "isolation_forest": joblib.load(path / "isolation_forest_anomaly.pkl"),
        "linear_regression": joblib.load(path / "linear_regression_dust_forecast.pkl"),
        "features": features,
    }


def _build_feature_row(sample: dict, feature_columns: list[str]) -> pd.DataFrame:
    """Create a one-row feature frame for demo inference.

    In production, rolling and lag values should come from the latest readings in
    the same room/session. For this demo, the current sample is used as a safe
    fallback for those features.
    """
    row = dict(sample)
    now = datetime.now()
    row.setdefault("hour_of_day", now.hour)
    row.setdefault("minute_of_hour", now.minute)

    for sensor in ["dust", "air_quality", "temperature", "humidity"]:
        row.setdefault(f"{sensor}_rolling_mean_3", row.get(sensor))
        row.setdefault(f"{sensor}_lag_1", row.get(sensor))

    return pd.DataFrame([{column: row.get(column) for column in feature_columns}])


def predict_cleanliness(sample: dict, models_bundle: dict | None = None, model_dir: str = "models") -> str:
    """Predict clean, needs_attention, or dirty for a single sensor sample."""
    bundle = models_bundle or load_models(model_dir)
    features = bundle["features"]["decision_tree_cleanliness"]
    X = _build_feature_row(sample, features)
    return str(bundle["decision_tree"].predict(X)[0])


def detect_anomaly(sample: dict, models_bundle: dict | None = None, model_dir: str = "models") -> str:
    """Detect whether a single sensor sample is normal or anomalous."""
    bundle = models_bundle or load_models(model_dir)
    features = bundle["features"]["isolation_forest_anomaly"]
    X = _build_feature_row(sample, features)
    prediction = int(bundle["isolation_forest"].predict(X)[0])
    return "anomaly" if prediction == -1 else "normal"


def forecast_next_dust(sample: dict, models_bundle: dict | None = None, model_dir: str = "models") -> float:
    """Forecast the next dust value for a single sensor sample."""
    bundle = models_bundle or load_models(model_dir)
    features = bundle["features"]["linear_regression_dust_forecast"]
    X = _build_feature_row(sample, features)
    return float(bundle["linear_regression"].predict(X)[0])


def predict_all(sample: dict, model_dir: str = "models") -> dict:
    """Run all three saved models and return dashboard-friendly output."""
    bundle = load_models(model_dir)
    cleanliness = predict_cleanliness(sample, bundle)
    anomaly = detect_anomaly(sample, bundle)
    next_dust = forecast_next_dust(sample, bundle)

    if anomaly == "anomaly":
        recommendation = "Unusual sensor pattern detected. Inspect the room and sensor."
    elif cleanliness == "dirty":
        recommendation = "Room likely needs cleaning soon."
    elif cleanliness == "needs_attention":
        recommendation = "Monitor room condition. Dust may be increasing."
    else:
        recommendation = "Room condition looks clean."

    return {
        "cleanliness_prediction": cleanliness,
        "anomaly_status": anomaly,
        "next_dust_prediction": round(next_dust, 2),
        "recommendation": recommendation,
    }
