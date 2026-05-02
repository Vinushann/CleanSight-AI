"""Training functions for the three CleanSight AI models."""

from __future__ import annotations

import json
from pathlib import Path

import joblib
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LinearRegression
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.tree import DecisionTreeClassifier


CLASSIFICATION_FEATURES = [
    "dust",
    "air_quality",
    "temperature",
    "humidity",
    "hour_of_day",
    "dust_rolling_mean_3",
    "air_quality_rolling_mean_3",
]

ANOMALY_FEATURES = ["dust", "air_quality", "temperature", "humidity"]

REGRESSION_FEATURES = [
    "dust_lag_1",
    "air_quality_lag_1",
    "temperature_lag_1",
    "humidity_lag_1",
    "hour_of_day",
]


def _check_columns(df: pd.DataFrame, columns: list[str]) -> None:
    missing = [column for column in columns if column not in df.columns]
    if missing:
        raise ValueError(f"Missing required columns: {missing}")


def train_decision_tree(df: pd.DataFrame, random_state: int = 42):
    """Train a Decision Tree classifier for cleanliness labels."""
    _check_columns(df, CLASSIFICATION_FEATURES + ["cleanliness_label"])
    model_df = df.dropna(subset=CLASSIFICATION_FEATURES + ["cleanliness_label"]).copy()

    X = model_df[CLASSIFICATION_FEATURES]
    y = model_df["cleanliness_label"]
    stratify = y if y.value_counts().min() >= 2 and y.nunique() > 1 else None

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=random_state, stratify=stratify
    )

    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            (
                "model",
                DecisionTreeClassifier(
                    max_depth=5,
                    class_weight="balanced",
                    random_state=random_state,
                ),
            ),
        ]
    )
    pipeline.fit(X_train, y_train)
    return pipeline, X_test, y_test


def train_isolation_forest(
    df: pd.DataFrame,
    random_state: int = 42,
    contamination: float = 0.08,
):
    """Train an Isolation Forest model for unusual sensor patterns."""
    _check_columns(df, ANOMALY_FEATURES)
    model_df = df.dropna(subset=ANOMALY_FEATURES).copy()
    X = model_df[ANOMALY_FEATURES]

    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            (
                "model",
                IsolationForest(
                    contamination=contamination,
                    random_state=random_state,
                ),
            ),
        ]
    )
    pipeline.fit(X)
    return pipeline, model_df


def train_linear_regression(df: pd.DataFrame, random_state: int = 42):
    """Train a Linear Regression model to forecast the next dust reading."""
    _check_columns(df, REGRESSION_FEATURES + ["next_dust"])
    model_df = df.dropna(subset=REGRESSION_FEATURES + ["next_dust"]).copy()

    X = model_df[REGRESSION_FEATURES]
    y = model_df["next_dust"]

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=random_state
    )

    pipeline = Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", LinearRegression()),
        ]
    )
    pipeline.fit(X_train, y_train)
    return pipeline, X_test, y_test


def save_models(
    decision_tree_model,
    isolation_forest_model,
    linear_regression_model,
    model_dir: str = "models",
) -> dict[str, list[str]]:
    """Save trained models and the feature lists used by each model."""
    path = Path(model_dir)
    path.mkdir(parents=True, exist_ok=True)

    joblib.dump(decision_tree_model, path / "decision_tree_cleanliness.pkl")
    joblib.dump(isolation_forest_model, path / "isolation_forest_anomaly.pkl")
    joblib.dump(linear_regression_model, path / "linear_regression_dust_forecast.pkl")

    feature_map = {
        "decision_tree_cleanliness": CLASSIFICATION_FEATURES,
        "isolation_forest_anomaly": ANOMALY_FEATURES,
        "linear_regression_dust_forecast": REGRESSION_FEATURES,
    }
    with (path / "model_features.json").open("w", encoding="utf-8") as file:
        json.dump(feature_map, file, indent=2)

    return feature_map
