"""Train TensorFlow Lite models and export them as .tflite and .h files.

This script rebuilds ESP32-friendly TensorFlow models from the processed
CleanSight dataset, converts them to TensorFlow Lite, and writes matching
header files that can be embedded in Arduino / ESP32 projects.
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Iterable

import joblib
import numpy as np
import pandas as pd
import tensorflow as tf
from sklearn.metrics import accuracy_score, mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import train_test_split


BASE_DIR = Path(__file__).resolve().parents[1]
DATASET_PATH = BASE_DIR / "data" / "processed" / "cleansight_processed_dataset.csv"
MODELS_DIR = BASE_DIR / "models"
TFLITE_DIR = MODELS_DIR / "tflite"
DOWNLOADS_DIR = Path.home() / "Downloads" / "CleanSight_TFLite_Models"

CLASSIFIER_FEATURES = [
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

CLASS_LABELS = ["clean", "needs_attention", "dirty"]
CLASS_TO_ID = {label: index for index, label in enumerate(CLASS_LABELS)}
ID_TO_CLASS = {index: label for label, index in CLASS_TO_ID.items()}


def set_seed(seed: int = 42) -> None:
    np.random.seed(seed)
    tf.random.set_seed(seed)


def load_dataset() -> pd.DataFrame:
    return pd.read_csv(DATASET_PATH)


def build_classifier_model(input_dim: int) -> tf.keras.Model:
    return tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(12, activation="relu"),
            tf.keras.layers.Dense(len(CLASS_LABELS), activation="softmax"),
        ]
    )


def build_binary_model(input_dim: int) -> tf.keras.Model:
    return tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(12, activation="relu"),
            tf.keras.layers.Dense(8, activation="relu"),
            tf.keras.layers.Dense(1, activation="sigmoid"),
        ]
    )


def build_regression_model(input_dim: int) -> tf.keras.Model:
    return tf.keras.Sequential(
        [
            tf.keras.layers.Input(shape=(input_dim,)),
            tf.keras.layers.Dense(16, activation="relu"),
            tf.keras.layers.Dense(8, activation="relu"),
            tf.keras.layers.Dense(1),
        ]
    )


def make_normalized_model(base_model: tf.keras.Model, X_train: np.ndarray) -> tuple[tf.keras.Model, dict]:
    normalization = tf.keras.layers.Normalization(axis=-1)
    normalization.adapt(X_train.astype(np.float32))

    model = tf.keras.Sequential([tf.keras.layers.Input(shape=(X_train.shape[1],)), normalization, base_model])
    stats = {
        "mean": normalization.mean.numpy().flatten().astype(float).tolist(),
        "variance": normalization.variance.numpy().flatten().astype(float).tolist(),
    }
    return model, stats


def representative_dataset(X: np.ndarray) -> Iterable[list[np.ndarray]]:
    sample_count = min(100, len(X))
    for row in X[:sample_count]:
        yield [np.asarray([row], dtype=np.float32)]


def convert_to_tflite(model: tf.keras.Model, X_reference: np.ndarray) -> bytes:
    converter = tf.lite.TFLiteConverter.from_keras_model(model)
    converter.optimizations = [tf.lite.Optimize.DEFAULT]
    converter.representative_dataset = lambda: representative_dataset(X_reference)
    converter.target_spec.supported_ops = [tf.lite.OpsSet.TFLITE_BUILTINS_INT8]
    converter.inference_input_type = tf.int8
    converter.inference_output_type = tf.int8
    return converter.convert()


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


def export_classifier(df: pd.DataFrame) -> dict:
    model_df = df.dropna(subset=CLASSIFIER_FEATURES + ["cleanliness_label"]).copy()
    model_df = model_df[model_df["cleanliness_label"].isin(CLASS_TO_ID)].copy()

    X = model_df[CLASSIFIER_FEATURES].to_numpy(dtype=np.float32)
    y = model_df["cleanliness_label"].map(CLASS_TO_ID).to_numpy(dtype=np.int32)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    base_model = build_classifier_model(X.shape[1])
    model, normalization = make_normalized_model(base_model, X_train)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.01),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        X_train,
        y_train,
        epochs=40,
        batch_size=32,
        validation_split=0.2,
        verbose=0,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=6, restore_best_weights=True)],
    )

    probabilities = model.predict(X_test, verbose=0)
    y_pred = np.argmax(probabilities, axis=1)
    accuracy = float(accuracy_score(y_test, y_pred))

    tflite_bytes = convert_to_tflite(model, X_train)
    tflite_path = TFLITE_DIR / "cleanliness_classifier.tflite"
    header_path = TFLITE_DIR / "cleanliness_classifier_model.h"
    tflite_path.write_bytes(tflite_bytes)
    write_tflite_header(tflite_bytes, "g_cleansight_cleanliness_classifier_model", header_path)

    return {
        "model_type": "tensorflow_classifier",
        "features": CLASSIFIER_FEATURES,
        "labels": ID_TO_CLASS,
        "metrics": {"accuracy": accuracy},
        "normalization": normalization,
        "tflite_path": str(tflite_path.relative_to(BASE_DIR)),
        "header_path": str(header_path.relative_to(BASE_DIR)),
    }


def export_anomaly_model(df: pd.DataFrame) -> dict:
    model_df = df.dropna(subset=ANOMALY_FEATURES).copy()
    X = model_df[ANOMALY_FEATURES].to_numpy(dtype=np.float32)

    sklearn_bundle = joblib.load(MODELS_DIR / "isolation_forest_anomaly.pkl")
    raw_predictions = sklearn_bundle.predict(model_df[ANOMALY_FEATURES])
    y = np.where(raw_predictions == -1, 1, 0).astype(np.float32)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )

    base_model = build_binary_model(X.shape[1])
    model, normalization = make_normalized_model(base_model, X_train)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.01),
        loss="binary_crossentropy",
        metrics=["accuracy"],
    )
    model.fit(
        X_train,
        y_train,
        epochs=40,
        batch_size=32,
        validation_split=0.2,
        verbose=0,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=6, restore_best_weights=True)],
    )

    scores = model.predict(X_test, verbose=0).reshape(-1)
    y_pred = (scores >= 0.5).astype(np.float32)
    accuracy = float(accuracy_score(y_test, y_pred))

    tflite_bytes = convert_to_tflite(model, X_train)
    tflite_path = TFLITE_DIR / "anomaly_detector.tflite"
    header_path = TFLITE_DIR / "anomaly_detector_model.h"
    tflite_path.write_bytes(tflite_bytes)
    write_tflite_header(tflite_bytes, "g_cleansight_anomaly_detector_model", header_path)

    return {
        "model_type": "tensorflow_binary_classifier",
        "features": ANOMALY_FEATURES,
        "labels": {"0": "normal", "1": "anomaly"},
        "distilled_from": "isolation_forest_anomaly.pkl",
        "metrics": {"accuracy_against_original_model": accuracy},
        "normalization": normalization,
        "tflite_path": str(tflite_path.relative_to(BASE_DIR)),
        "header_path": str(header_path.relative_to(BASE_DIR)),
    }


def export_regression_model(df: pd.DataFrame) -> dict:
    model_df = df.dropna(subset=REGRESSION_FEATURES + ["next_dust"]).copy()
    X = model_df[REGRESSION_FEATURES].to_numpy(dtype=np.float32)
    y = model_df["next_dust"].to_numpy(dtype=np.float32)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    base_model = build_regression_model(X.shape[1])
    model, normalization = make_normalized_model(base_model, X_train)
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=0.01),
        loss="mse",
        metrics=["mae"],
    )
    model.fit(
        X_train,
        y_train,
        epochs=50,
        batch_size=32,
        validation_split=0.2,
        verbose=0,
        callbacks=[tf.keras.callbacks.EarlyStopping(patience=8, restore_best_weights=True)],
    )

    predictions = model.predict(X_test, verbose=0).reshape(-1)
    mae = float(mean_absolute_error(y_test, predictions))
    rmse = float(np.sqrt(mean_squared_error(y_test, predictions)))
    r2 = float(r2_score(y_test, predictions))

    tflite_bytes = convert_to_tflite(model, X_train)
    tflite_path = TFLITE_DIR / "dust_forecaster.tflite"
    header_path = TFLITE_DIR / "dust_forecaster_model.h"
    tflite_path.write_bytes(tflite_bytes)
    write_tflite_header(tflite_bytes, "g_cleansight_dust_forecaster_model", header_path)

    return {
        "model_type": "tensorflow_regressor",
        "features": REGRESSION_FEATURES,
        "target": "next_dust",
        "metrics": {"mae": mae, "rmse": rmse, "r2": r2},
        "normalization": normalization,
        "tflite_path": str(tflite_path.relative_to(BASE_DIR)),
        "header_path": str(header_path.relative_to(BASE_DIR)),
    }


def main() -> None:
    set_seed()
    TFLITE_DIR.mkdir(parents=True, exist_ok=True)
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

    df = load_dataset()
    manifest = {
        "project": "CleanSight AI",
        "pipeline": "training -> model.tflite -> model.h -> ESP32",
        "dataset": str(DATASET_PATH.relative_to(BASE_DIR)),
        "models": {
            "cleanliness_classifier": export_classifier(df),
            "anomaly_detector": export_anomaly_model(df),
            "dust_forecaster": export_regression_model(df),
        },
    }

    manifest_path = TFLITE_DIR / "tflite_export_manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    for path in TFLITE_DIR.iterdir():
        if path.is_file():
            target = DOWNLOADS_DIR / path.name
            target.write_bytes(path.read_bytes())

    print("TensorFlow Lite export completed.")
    print(f"Output directory: {TFLITE_DIR}")
    print(f"Downloads package: {DOWNLOADS_DIR}")


if __name__ == "__main__":
    main()
