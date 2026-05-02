"""Train the four CleanSight TinyML TensorFlow Lite models from Firestore data."""

from __future__ import annotations

import json
import os
import re
import shutil
import sys
from pathlib import Path
from typing import Iterable

import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import accuracy_score, mean_absolute_error
from sklearn.model_selection import train_test_split

CURRENT_DIR = Path(__file__).resolve().parent
BASE_DIR = CURRENT_DIR.parents[0]
if str(CURRENT_DIR) not in sys.path:
    sys.path.insert(0, str(CURRENT_DIR))

from firebase_loader import connect_firestore, load_sessions_and_readings


SERVICE_ACCOUNT_PATH = "/Users/vinushan/Downloads/cleansight-ai-new-firebase-adminsdk-fbsvc-1424350d32.json"
RAW_DATASET_PATH = BASE_DIR / "data" / "raw" / "firestore_four_model_readings.csv"
PROCESSED_DATASET_PATH = BASE_DIR / "data" / "processed" / "cleansight_four_model_dataset.csv"
OUTPUT_DIR = Path.home() / "Downloads" / "CleanSight_Four_TFLite_Models"

FEATURES = [
    "dust",
    "air_quality",
    "temperature",
    "humidity",
    "dust_rolling_mean_3",
    "air_quality_rolling_mean_3",
    "temperature_rolling_mean_3",
    "humidity_rolling_mean_3",
    "dust_delta",
    "air_quality_delta",
    "session_before",
    "session_during",
    "session_after",
]

CLEANLINESS_LABELS = ["clean", "needs_attention", "dirty"]
ANOMALY_LABELS = ["normal", "anomaly"]
URGENCY_LABELS = ["low", "medium", "high", "critical"]


def set_seed(seed: int = 42) -> None:
    np.random.seed(seed)
    tf.random.set_seed(seed)


def normalize_text(value) -> str | None:
    if pd.isna(value):
        return None
    return str(value).strip().lower().replace("-", "_").replace(" ", "_")


def derive_cleanliness_status(score: float) -> str:
    if score >= 85:
        return "clean"
    if score >= 55:
        return "needs_attention"
    return "dirty"


def derive_urgency(cleanliness_status: str, cleanliness_score: float, anomaly_status: str) -> str:
    if cleanliness_score < 40:
        urgency = "critical"
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


def prepare_dataset(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    for column in ["dust", "air_quality", "temperature", "humidity", "cleanliness_score", "timestamp_ms"]:
        data[column] = pd.to_numeric(data[column], errors="coerce")

    data = data.dropna(subset=["dust", "air_quality", "temperature", "humidity", "timestamp_ms"])
    data["timestamp"] = pd.to_datetime(data["timestamp_ms"], unit="ms", errors="coerce")
    data = data.dropna(subset=["timestamp"])

    data["cleanliness_status"] = data.get("cleanliness_status", pd.Series(index=data.index)).apply(normalize_text)
    data["anomaly_status"] = data.get("anomaly_status", pd.Series(index=data.index)).apply(normalize_text)
    data["cleaning_urgency"] = data.get("cleaning_urgency", pd.Series(index=data.index)).apply(normalize_text)

    if "cleanliness_prediction" in data.columns:
        prediction = data["cleanliness_prediction"].apply(normalize_text)
        data["cleanliness_status"] = data["cleanliness_status"].fillna(prediction)
    if "anomaly_prediction" in data.columns:
        prediction = data["anomaly_prediction"].apply(normalize_text)
        data["anomaly_status"] = data["anomaly_status"].fillna(prediction)

    data = data.dropna(subset=["cleanliness_score"])
    data["cleanliness_status"] = data["cleanliness_status"].fillna(
        data["cleanliness_score"].apply(derive_cleanliness_status)
    )
    data["anomaly_status"] = data["anomaly_status"].fillna("normal")
    data["cleaning_urgency"] = data["cleaning_urgency"].fillna(
        data.apply(
            lambda row: derive_urgency(
                row["cleanliness_status"],
                float(row["cleanliness_score"]),
                row["anomaly_status"],
            ),
            axis=1,
        )
    )

    data = data[
        data["cleanliness_status"].isin(CLEANLINESS_LABELS)
        & data["anomaly_status"].isin(ANOMALY_LABELS)
        & data["cleaning_urgency"].isin(URGENCY_LABELS)
    ].copy()

    sort_columns = [column for column in ["session_id", "timestamp"] if column in data.columns]
    data = data.sort_values(sort_columns or ["timestamp"]).reset_index(drop=True)
    group_key = "session_id" if "session_id" in data.columns else None

    for column in ["dust", "air_quality", "temperature", "humidity"]:
        rolling_name = f"{column}_rolling_mean_3"
        if group_key:
            data[rolling_name] = (
                data.groupby(group_key, group_keys=False)[column]
                .rolling(window=3, min_periods=1)
                .mean()
                .reset_index(level=0, drop=True)
            )
            data[f"{column}_delta"] = data.groupby(group_key)[column].diff().fillna(0.0)
        else:
            data[rolling_name] = data[column].rolling(window=3, min_periods=1).mean()
            data[f"{column}_delta"] = data[column].diff().fillna(0.0)

    session_type = data.get("session_type", pd.Series(["unknown"] * len(data))).astype(str).str.lower()
    data["session_before"] = (session_type == "before").astype(float)
    data["session_during"] = (session_type == "during").astype(float)
    data["session_after"] = (session_type == "after").astype(float)

    data = data.replace([np.inf, -np.inf], np.nan).dropna(subset=FEATURES)
    return data.reset_index(drop=True)


def load_firestore_dataset() -> pd.DataFrame:
    credential_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or SERVICE_ACCOUNT_PATH
    db = connect_firestore(credential_path)
    raw_df = load_sessions_and_readings(db)
    RAW_DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
    raw_df.to_csv(RAW_DATASET_PATH, index=False)

    prepared = prepare_dataset(raw_df)
    PROCESSED_DATASET_PATH.parent.mkdir(parents=True, exist_ok=True)
    prepared.to_csv(PROCESSED_DATASET_PATH, index=False)
    return prepared


def build_classifier(input_dim: int, output_dim: int) -> tf.keras.Model:
    return tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(24, activation="relu"),
            tf.keras.layers.Dense(12, activation="relu"),
            tf.keras.layers.Dense(output_dim, activation="softmax"),
        ]
    )


def build_binary_classifier(input_dim: int) -> tf.keras.Model:
    return tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(8, activation="relu"),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ]
    )


def build_regressor(input_dim: int) -> tf.keras.Model:
    return tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(24, activation="relu"),
            tf.keras.layers.Dense(12, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )


def add_normalization(base_model: tf.keras.Model, X_train: np.ndarray) -> tf.keras.Model:
    normalization = tf.keras.layers.Normalization(axis=-1)
    normalization.adapt(X_train.astype(np.float32))
    return tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(X_train.shape[1],)),
            normalization,
            base_model,
        ]
    )


def representative_dataset(X: np.ndarray) -> Iterable[list[np.ndarray]]:
    for row in X[: min(100, len(X))]:
        yield [np.asarray([row], dtype=np.float32)]


def convert_to_tflite(model: tf.keras.Model, X_reference: np.ndarray) -> tuple[bytes, str]:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = lambda: representative_dataset(X_reference)
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    try:
        return converter.convert(), "int8"
    except Exception:
        fallback = tf.lite.TFLiteConverter.from_keras_model(model)
        fallback.optimizations = [tf.lite.Optimize.DEFAULT]
        return fallback.convert(), "dynamic_range"


def to_c_identifier(filename_stem: str) -> str:
    normalized = re.sub(r"[^a-zA-Z0-9_]", "_", filename_stem)
    normalized = re.sub(r"_+", "_", normalized).strip("_")
    return f"g_cleansight_{normalized}_model"


def write_tflite_header(tflite_bytes: bytes, array_name: str, output_path: Path) -> None:
    hex_values = ", ".join(f"0x{byte:02x}" for byte in tflite_bytes)
    header = (
        "#pragma once\n"
        "#include <stddef.h>\n"
        "#include <stdint.h>\n\n"
        f"alignas(16) const unsigned char {array_name}[] = {{{hex_values}}};\n"
        f"const unsigned int {array_name}_len = {len(tflite_bytes)};\n"
    )
    output_path.write_text(header, encoding="utf-8")


def write_model_artifacts(output_stem: str, tflite_bytes: bytes) -> tuple[Path, Path]:
    tflite_path = OUTPUT_DIR / f"{output_stem}.tflite"
    header_path = OUTPUT_DIR / f"{output_stem}.h"
    tflite_path.write_bytes(tflite_bytes)
    write_tflite_header(tflite_bytes, to_c_identifier(output_stem), header_path)
    return tflite_path, header_path


def split_data(X: np.ndarray, y: np.ndarray, stratify: bool = True):
    stratify_y = y if stratify and len(np.unique(y)) > 1 and pd.Series(y).value_counts().min() >= 2 else None
    return train_test_split(X, y, test_size=0.2, random_state=42, stratify=stratify_y)


def train_multiclass_model(
    df: pd.DataFrame,
    target_column: str,
    labels: list[str],
    output_name: str,
) -> dict:
    X = df[FEATURES].to_numpy(dtype=np.float32)
    label_to_id = {label: index for index, label in enumerate(labels)}
    y = df[target_column].map(label_to_id).to_numpy(dtype=np.int32)
    X_train, X_test, y_train, y_test = split_data(X, y, stratify=True)

    model = add_normalization(build_classifier(X.shape[1], len(labels)), X_train)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.006),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        X_train,
        y_train,
        epochs=80,
        batch_size=16,
        validation_split=0.2,
        verbose=0,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True)],
    )

    predictions = np.argmax(model.predict(X_test, verbose=0), axis=1)
    tflite_bytes, quantization = convert_to_tflite(model, X_train)
    output_path, header_path = write_model_artifacts(output_name, tflite_bytes)

    return {
        "target": target_column,
        "labels": {str(index): label for index, label in enumerate(labels)},
        "features": FEATURES,
        "rows": int(len(df)),
        "test_accuracy": float(accuracy_score(y_test, predictions)),
        "quantization": quantization,
        "file": output_path.name,
        "header_file": header_path.name,
        "c_array_name": to_c_identifier(output_name),
        "size_bytes": output_path.stat().st_size,
    }


def train_binary_model(df: pd.DataFrame) -> dict:
    X = df[FEATURES].to_numpy(dtype=np.float32)
    y = (df["anomaly_status"] == "anomaly").astype(np.float32).to_numpy()
    X_train, X_test, y_train, y_test = split_data(X, y, stratify=True)

    model = add_normalization(build_binary_classifier(X.shape[1]), X_train)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.006),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        X_train,
        y_train,
        epochs=80,
        batch_size=16,
        validation_split=0.2,
        verbose=0,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=10, restore_best_weights=True)],
    )

    scores = model.predict(X_test, verbose=0).reshape(-1)
    predictions = (scores >= 0.5).astype(np.float32)
    tflite_bytes, quantization = convert_to_tflite(model, X_train)
    output_path, header_path = write_model_artifacts("anomaly_detector", tflite_bytes)

    return {
        "target": "anomaly_status",
        "labels": {"0": "normal", "1": "anomaly"},
        "features": FEATURES,
        "rows": int(len(df)),
        "test_accuracy": float(accuracy_score(y_test, predictions)),
        "quantization": quantization,
        "file": output_path.name,
        "header_file": header_path.name,
        "c_array_name": to_c_identifier("anomaly_detector"),
        "size_bytes": output_path.stat().st_size,
    }


def train_score_model(df: pd.DataFrame) -> dict:
    X = df[FEATURES].to_numpy(dtype=np.float32)
    y = df["cleanliness_score"].to_numpy(dtype=np.float32)
    X_train, X_test, y_train, y_test = split_data(X, y, stratify=False)

    model = add_normalization(build_regressor(X.shape[1]), X_train)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.006),
        loss="mse",
        metrics=["mae"],
    )
    model.fit(
        X_train,
        y_train,
        epochs=100,
        batch_size=16,
        validation_split=0.2,
        verbose=0,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=12, restore_best_weights=True)],
    )

    predictions = np.clip(model.predict(X_test, verbose=0).reshape(-1), 0.0, 100.0)
    tflite_bytes, quantization = convert_to_tflite(model, X_train)
    output_path, header_path = write_model_artifacts("cleanliness_score_regressor", tflite_bytes)

    return {
        "target": "cleanliness_score",
        "output_range": "0_to_100",
        "features": FEATURES,
        "rows": int(len(df)),
        "test_mae": float(mean_absolute_error(y_test, predictions)),
        "quantization": quantization,
        "file": output_path.name,
        "header_file": header_path.name,
        "c_array_name": to_c_identifier("cleanliness_score_regressor"),
        "size_bytes": output_path.stat().st_size,
    }


def main() -> None:
    set_seed()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    for old_file in OUTPUT_DIR.glob("*.tflite"):
        old_file.unlink()
    for old_file in OUTPUT_DIR.glob("*.h"):
        old_file.unlink()

    df = load_firestore_dataset()
    if len(df) < 20:
        raise ValueError(f"Need at least 20 labeled rows to train stable TinyML models. Found {len(df)}.")

    manifest = {
        "project": "CleanSight AI",
        "firebase_project": "cleansight-ai-new",
        "dataset_rows": int(len(df)),
        "raw_dataset": str(RAW_DATASET_PATH.relative_to(BASE_DIR)),
        "processed_dataset": str(PROCESSED_DATASET_PATH.relative_to(BASE_DIR)),
        "models": {
            "room_cleanliness_classification": train_multiclass_model(
                df,
                "cleanliness_status",
                CLEANLINESS_LABELS,
                "room_cleanliness_classifier",
            ),
            "anomaly_detection": train_binary_model(df),
            "room_cleanliness_score": train_score_model(df),
            "cleaning_urgency_prediction": train_multiclass_model(
                df,
                "cleaning_urgency",
                URGENCY_LABELS,
                "cleaning_urgency_classifier",
            ),
        },
    }

    manifest_path = OUTPUT_DIR / "tflite_model_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    local_copy_dir = BASE_DIR / "models" / "four_tflite"
    if local_copy_dir.exists():
        shutil.rmtree(local_copy_dir)
    shutil.copytree(OUTPUT_DIR, local_copy_dir)

    print("Four CleanSight TinyML models exported.")
    print(f"Rows used: {len(df)}")
    print(f"Downloads folder: {OUTPUT_DIR}")
    for model_name, info in manifest["models"].items():
        metric = info.get("test_accuracy", info.get("test_mae"))
        print(f"- {model_name}: {info['file']} ({info['quantization']}), metric={metric:.4f}")


if __name__ == "__main__":
    main()
