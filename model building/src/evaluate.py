"""Evaluation and plotting helpers for CleanSight AI models."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import numpy as np
import pandas as pd
import seaborn as sns
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    confusion_matrix,
    mean_absolute_error,
    mean_squared_error,
    r2_score,
)


def _ensure_dir(path: str | Path) -> Path:
    directory = Path(path)
    directory.mkdir(parents=True, exist_ok=True)
    return directory


def save_time_series_plots(df: pd.DataFrame, figures_dir: str = "reports/figures") -> None:
    """Save dust and air quality over time charts."""
    output = _ensure_dir(figures_dir)
    plot_df = df.sort_values("timestamp").copy()

    for column, filename, title in [
        ("dust", "dust_over_time.png", "Dust over Time"),
        ("air_quality", "air_quality_over_time.png", "Air Quality over Time"),
    ]:
        plt.figure(figsize=(10, 5))
        sns.lineplot(data=plot_df, x="timestamp", y=column)
        plt.title(title)
        plt.xlabel("Time")
        plt.ylabel(column.replace("_", " ").title())
        plt.xticks(rotation=30)
        plt.tight_layout()
        plt.savefig(output / filename, dpi=150)
        plt.close()


def evaluate_decision_tree(model, X_test, y_test, figures_dir: str = "reports/figures"):
    """Evaluate classifier and save confusion matrix plus feature importance."""
    output = _ensure_dir(figures_dir)
    predictions = model.predict(X_test)

    labels = sorted(set(y_test.dropna().unique().tolist()) | set(pd.Series(predictions).dropna().unique().tolist()))
    matrix = confusion_matrix(y_test, predictions, labels=labels)

    plt.figure(figsize=(7, 5))
    sns.heatmap(matrix, annot=True, fmt="d", cmap="Blues", xticklabels=labels, yticklabels=labels)
    plt.title("Cleanliness Confusion Matrix")
    plt.xlabel("Predicted")
    plt.ylabel("Actual")
    plt.tight_layout()
    plt.savefig(output / "cleanliness_confusion_matrix.png", dpi=150)
    plt.close()

    tree = model.named_steps["model"]
    importance = pd.DataFrame(
        {
            "feature": list(X_test.columns),
            "importance": tree.feature_importances_,
        }
    ).sort_values("importance", ascending=False)

    plt.figure(figsize=(9, 5))
    sns.barplot(data=importance, x="importance", y="feature")
    plt.title("Decision Tree Feature Importance")
    plt.xlabel("Importance")
    plt.ylabel("Feature")
    plt.tight_layout()
    plt.savefig(output / "decision_tree_feature_importance.png", dpi=150)
    plt.close()

    return {
        "accuracy": float(accuracy_score(y_test, predictions)),
        "classification_report": classification_report(y_test, predictions, output_dict=True),
    }


def evaluate_isolation_forest(
    model,
    df: pd.DataFrame,
    feature_columns: list[str],
    figures_dir: str = "reports/figures",
):
    """Evaluate anomaly counts and save anomalies-over-time chart."""
    output = _ensure_dir(figures_dir)
    evaluated = df.copy()
    predictions = model.predict(evaluated[feature_columns])
    evaluated["anomaly_status"] = np.where(predictions == -1, "anomaly", "normal")

    counts = evaluated["anomaly_status"].value_counts().to_dict()
    normal_count = int(counts.get("normal", 0))
    anomaly_count = int(counts.get("anomaly", 0))
    total = normal_count + anomaly_count
    anomaly_percentage = float((anomaly_count / total) * 100) if total else 0.0

    plt.figure(figsize=(10, 5))
    normal = evaluated[evaluated["anomaly_status"] == "normal"]
    anomalies = evaluated[evaluated["anomaly_status"] == "anomaly"]
    sns.lineplot(data=evaluated.sort_values("timestamp"), x="timestamp", y="dust", label="dust")
    plt.scatter(anomalies["timestamp"], anomalies["dust"], color="red", label="anomaly", zorder=3)
    plt.title("Anomalies over Time")
    plt.xlabel("Time")
    plt.ylabel("Dust")
    plt.xticks(rotation=30)
    plt.legend()
    plt.tight_layout()
    plt.savefig(output / "anomalies_over_time.png", dpi=150)
    plt.close()

    return {
        "normal_readings": normal_count,
        "anomaly_readings": anomaly_count,
        "anomaly_percentage": anomaly_percentage,
    }


def evaluate_linear_regression(model, X_test, y_test, figures_dir: str = "reports/figures"):
    """Evaluate dust forecasting model and save actual-vs-predicted chart."""
    output = _ensure_dir(figures_dir)
    predictions = model.predict(X_test)

    plt.figure(figsize=(7, 6))
    sns.scatterplot(x=y_test, y=predictions)
    min_value = min(float(y_test.min()), float(np.min(predictions)))
    max_value = max(float(y_test.max()), float(np.max(predictions)))
    plt.plot([min_value, max_value], [min_value, max_value], color="red", linestyle="--")
    plt.title("Actual vs Predicted Next Dust")
    plt.xlabel("Actual next dust")
    plt.ylabel("Predicted next dust")
    plt.tight_layout()
    plt.savefig(output / "regression_actual_vs_predicted.png", dpi=150)
    plt.close()

    return {
        "mae": float(mean_absolute_error(y_test, predictions)),
        "rmse": float(np.sqrt(mean_squared_error(y_test, predictions))),
        "r2": float(r2_score(y_test, predictions)),
    }


def save_metrics(metrics: dict, output_path: str = "reports/metrics/model_metrics.json") -> None:
    """Save model metrics as JSON."""
    path = Path(output_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        json.dump(metrics, file, indent=2)
