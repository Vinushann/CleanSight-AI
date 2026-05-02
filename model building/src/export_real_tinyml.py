"""Export trained CleanSight models into a TinyML C/C++ header.

This exporter uses the actual models produced by notebook 03:
- DecisionTreeClassifier pipeline
- IsolationForest pipeline
- LinearRegression pipeline

The output is a C/C++ header that can be included from ESP32/Arduino code.
It is not a dummy model: all thresholds, tree structures, imputation values,
scaling values, and regression coefficients are read from the trained model
artifacts in the models/ folder.
"""

from __future__ import annotations

import json
import math
import shutil
from pathlib import Path

import joblib
import numpy as np
import pandas as pd


BASE_DIR = Path(__file__).resolve().parents[1]
MODELS_DIR = BASE_DIR / "models"
REPORTS_DIR = BASE_DIR / "reports"
DOWNLOADS_DIR = Path.home() / "Downloads" / "CleanSight_TinyML_Models"


def c_float(value: float) -> str:
    if math.isnan(float(value)):
        return "0.0f"
    return f"{float(value):.8f}f"


def c_array(name: str, values, c_type: str = "float") -> str:
    if c_type == "float":
        body = ", ".join(c_float(value) for value in values)
    elif c_type == "int":
        body = ", ".join(str(int(value)) for value in values)
    elif c_type == "const char*":
        body = ", ".join(f'"{value}"' for value in values)
        return f"static const char* {name}[] = {{{body}}};"
    else:
        raise ValueError(f"Unsupported C type: {c_type}")
    return f"static const {c_type} {name}[] = {{{body}}};"


def average_path_length(n_samples: int | float) -> float:
    n = float(n_samples)
    if n <= 1:
        return 0.0
    if n == 2:
        return 1.0
    return 2.0 * (math.log(n - 1.0) + 0.5772156649) - (2.0 * (n - 1.0) / n)


def export_decision_tree(decision_tree_pipeline):
    imputer = decision_tree_pipeline.named_steps["imputer"]
    tree_model = decision_tree_pipeline.named_steps["model"]
    tree = tree_model.tree_

    return {
        "classes": [str(value) for value in tree_model.classes_],
        "imputer_median": imputer.statistics_.astype(float).tolist(),
        "children_left": tree.children_left.astype(int).tolist(),
        "children_right": tree.children_right.astype(int).tolist(),
        "feature": tree.feature.astype(int).tolist(),
        "threshold": tree.threshold.astype(float).tolist(),
        "value": np.argmax(tree.value.squeeze(axis=1), axis=1).astype(int).tolist(),
        "node_count": int(tree.node_count),
    }


def export_linear_regression(linear_regression_pipeline):
    imputer = linear_regression_pipeline.named_steps["imputer"]
    scaler = linear_regression_pipeline.named_steps["scaler"]
    model = linear_regression_pipeline.named_steps["model"]

    return {
        "imputer_median": imputer.statistics_.astype(float).tolist(),
        "scaler_mean": scaler.mean_.astype(float).tolist(),
        "scaler_scale": scaler.scale_.astype(float).tolist(),
        "coef": model.coef_.astype(float).tolist(),
        "intercept": float(model.intercept_),
    }


def isolation_tree_path_length(tree, x: np.ndarray) -> float:
    node = 0
    depth = 0
    while tree.children_left[node] != tree.children_right[node]:
        feature = tree.feature[node]
        threshold = tree.threshold[node]
        if x[feature] <= threshold:
            node = tree.children_left[node]
        else:
            node = tree.children_right[node]
        depth += 1
    return depth + average_path_length(tree.n_node_samples[node])


def isolation_scores(isolation_pipeline, X: pd.DataFrame, feature_names: list[str]) -> np.ndarray:
    imputer = isolation_pipeline.named_steps["imputer"]
    scaler = isolation_pipeline.named_steps["scaler"]
    model = isolation_pipeline.named_steps["model"]

    X_values = X[feature_names].to_numpy(dtype=float)
    X_values = imputer.transform(X_values)
    X_scaled = scaler.transform(X_values)

    denominator = len(model.estimators_) * average_path_length(model.max_samples_)
    scores = []
    for row in X_scaled:
        total_path = 0.0
        for estimator, feature_indices in zip(model.estimators_, model.estimators_features_):
            tree_input = row[np.asarray(feature_indices, dtype=int)]
            total_path += isolation_tree_path_length(estimator.tree_, tree_input)
        scores.append(2.0 ** (-total_path / denominator))
    return np.array(scores, dtype=float)


def export_isolation_forest(isolation_pipeline, training_df: pd.DataFrame, feature_names: list[str]):
    imputer = isolation_pipeline.named_steps["imputer"]
    scaler = isolation_pipeline.named_steps["scaler"]
    model = isolation_pipeline.named_steps["model"]

    scores = isolation_scores(isolation_pipeline, training_df, feature_names)
    contamination = float(model.contamination)
    threshold = float(np.quantile(scores, 1.0 - contamination))

    forest = {
        "imputer_median": imputer.statistics_.astype(float).tolist(),
        "scaler_mean": scaler.mean_.astype(float).tolist(),
        "scaler_scale": scaler.scale_.astype(float).tolist(),
        "max_samples": int(model.max_samples_),
        "estimator_count": len(model.estimators_),
        "score_threshold": threshold,
        "feature_offsets": [],
        "feature_values": [],
        "tree_offsets": [],
        "children_left": [],
        "children_right": [],
        "feature": [],
        "threshold": [],
        "n_node_samples": [],
    }

    feature_cursor = 0
    node_cursor = 0
    for estimator, feature_indices in zip(model.estimators_, model.estimators_features_):
        feature_indices = np.asarray(feature_indices, dtype=int)
        tree = estimator.tree_

        forest["feature_offsets"].append(feature_cursor)
        forest["feature_values"].extend(feature_indices.tolist())
        feature_cursor += len(feature_indices)

        forest["tree_offsets"].append(node_cursor)
        forest["children_left"].extend((tree.children_left + node_cursor).astype(int).tolist())
        forest["children_right"].extend((tree.children_right + node_cursor).astype(int).tolist())
        forest["feature"].extend(tree.feature.astype(int).tolist())
        forest["threshold"].extend(tree.threshold.astype(float).tolist())
        forest["n_node_samples"].extend(tree.n_node_samples.astype(int).tolist())
        node_cursor += int(tree.node_count)

    forest["feature_offsets"].append(feature_cursor)
    forest["tree_offsets"].append(node_cursor)
    forest["node_count"] = node_cursor
    forest["feature_value_count"] = feature_cursor
    return forest


def make_header(metadata: dict) -> str:
    dt = metadata["decision_tree"]
    iso = metadata["isolation_forest"]
    reg = metadata["linear_regression"]

    return f"""#pragma once
// CleanSight AI real TinyML export.
// Generated from the trained notebook models in model building/models.
// Source data: Firestore sessions/readings exported by notebook 01.

#include <math.h>

#define CLEANSIGHT_CLASS_COUNT {len(dt["classes"])}
#define CLEANSIGHT_DT_FEATURE_COUNT {len(metadata["feature_columns"]["decision_tree_cleanliness"])}
#define CLEANSIGHT_DT_NODE_COUNT {dt["node_count"]}
#define CLEANSIGHT_ISO_FEATURE_COUNT {len(metadata["feature_columns"]["isolation_forest_anomaly"])}
#define CLEANSIGHT_ISO_TREE_COUNT {iso["estimator_count"]}
#define CLEANSIGHT_ISO_NODE_COUNT {iso["node_count"]}
#define CLEANSIGHT_ISO_FEATURE_VALUE_COUNT {iso["feature_value_count"]}
#define CLEANSIGHT_REG_FEATURE_COUNT {len(metadata["feature_columns"]["linear_regression_dust_forecast"])}

{c_array("CLEANSIGHT_CLASS_NAMES", dt["classes"], "const char*")}

{c_array("CLEANSIGHT_DT_IMPUTER_MEDIAN", dt["imputer_median"])}
{c_array("CLEANSIGHT_DT_CHILDREN_LEFT", dt["children_left"], "int")}
{c_array("CLEANSIGHT_DT_CHILDREN_RIGHT", dt["children_right"], "int")}
{c_array("CLEANSIGHT_DT_FEATURE", dt["feature"], "int")}
{c_array("CLEANSIGHT_DT_THRESHOLD", dt["threshold"])}
{c_array("CLEANSIGHT_DT_VALUE", dt["value"], "int")}

{c_array("CLEANSIGHT_ISO_IMPUTER_MEDIAN", iso["imputer_median"])}
{c_array("CLEANSIGHT_ISO_SCALER_MEAN", iso["scaler_mean"])}
{c_array("CLEANSIGHT_ISO_SCALER_SCALE", iso["scaler_scale"])}
{c_array("CLEANSIGHT_ISO_FEATURE_OFFSETS", iso["feature_offsets"], "int")}
{c_array("CLEANSIGHT_ISO_FEATURE_VALUES", iso["feature_values"], "int")}
{c_array("CLEANSIGHT_ISO_TREE_OFFSETS", iso["tree_offsets"], "int")}
{c_array("CLEANSIGHT_ISO_CHILDREN_LEFT", iso["children_left"], "int")}
{c_array("CLEANSIGHT_ISO_CHILDREN_RIGHT", iso["children_right"], "int")}
{c_array("CLEANSIGHT_ISO_FEATURE", iso["feature"], "int")}
{c_array("CLEANSIGHT_ISO_THRESHOLD", iso["threshold"])}
{c_array("CLEANSIGHT_ISO_NODE_SAMPLES", iso["n_node_samples"], "int")}
static const float CLEANSIGHT_ISO_SCORE_THRESHOLD = {c_float(iso["score_threshold"])};
static const float CLEANSIGHT_ISO_AVG_PATH_MAX_SAMPLES = {c_float(average_path_length(iso["max_samples"]))};

{c_array("CLEANSIGHT_REG_IMPUTER_MEDIAN", reg["imputer_median"])}
{c_array("CLEANSIGHT_REG_SCALER_MEAN", reg["scaler_mean"])}
{c_array("CLEANSIGHT_REG_SCALER_SCALE", reg["scaler_scale"])}
{c_array("CLEANSIGHT_REG_COEF", reg["coef"])}
static const float CLEANSIGHT_REG_INTERCEPT = {c_float(reg["intercept"])};

static inline float cleansight_avg_path_length(float n) {{
    if (n <= 1.0f) return 0.0f;
    if (n == 2.0f) return 1.0f;
    return 2.0f * (logf(n - 1.0f) + 0.5772156649f) - (2.0f * (n - 1.0f) / n);
}}

static inline int cleansight_predict_cleanliness_class(
    float dust,
    float air_quality,
    float temperature,
    float humidity,
    float hour_of_day,
    float dust_rolling_mean_3,
    float air_quality_rolling_mean_3
) {{
    float x[CLEANSIGHT_DT_FEATURE_COUNT] = {{
        dust,
        air_quality,
        temperature,
        humidity,
        hour_of_day,
        dust_rolling_mean_3,
        air_quality_rolling_mean_3
    }};
    for (int i = 0; i < CLEANSIGHT_DT_FEATURE_COUNT; i++) {{
        if (isnan(x[i])) x[i] = CLEANSIGHT_DT_IMPUTER_MEDIAN[i];
    }}

    int node = 0;
    while (CLEANSIGHT_DT_CHILDREN_LEFT[node] != CLEANSIGHT_DT_CHILDREN_RIGHT[node]) {{
        int feature = CLEANSIGHT_DT_FEATURE[node];
        if (x[feature] <= CLEANSIGHT_DT_THRESHOLD[node]) {{
            node = CLEANSIGHT_DT_CHILDREN_LEFT[node];
        }} else {{
            node = CLEANSIGHT_DT_CHILDREN_RIGHT[node];
        }}
    }}
    return CLEANSIGHT_DT_VALUE[node];
}}

static inline const char* cleansight_predict_cleanliness_label(
    float dust,
    float air_quality,
    float temperature,
    float humidity,
    float hour_of_day,
    float dust_rolling_mean_3,
    float air_quality_rolling_mean_3
) {{
    int class_id = cleansight_predict_cleanliness_class(
        dust, air_quality, temperature, humidity, hour_of_day,
        dust_rolling_mean_3, air_quality_rolling_mean_3
    );
    if (class_id < 0 || class_id >= CLEANSIGHT_CLASS_COUNT) return "unknown";
    return CLEANSIGHT_CLASS_NAMES[class_id];
}}

static inline float cleansight_isolation_score(
    float dust,
    float air_quality,
    float temperature,
    float humidity
) {{
    float raw[CLEANSIGHT_ISO_FEATURE_COUNT] = {{dust, air_quality, temperature, humidity}};
    float scaled[CLEANSIGHT_ISO_FEATURE_COUNT];
    for (int i = 0; i < CLEANSIGHT_ISO_FEATURE_COUNT; i++) {{
        if (isnan(raw[i])) raw[i] = CLEANSIGHT_ISO_IMPUTER_MEDIAN[i];
        scaled[i] = (raw[i] - CLEANSIGHT_ISO_SCALER_MEAN[i]) / CLEANSIGHT_ISO_SCALER_SCALE[i];
    }}

    float total_path = 0.0f;
    for (int tree_index = 0; tree_index < CLEANSIGHT_ISO_TREE_COUNT; tree_index++) {{
        int node = CLEANSIGHT_ISO_TREE_OFFSETS[tree_index];
        int feature_start = CLEANSIGHT_ISO_FEATURE_OFFSETS[tree_index];

        int depth = 0;
        while (CLEANSIGHT_ISO_CHILDREN_LEFT[node] != CLEANSIGHT_ISO_CHILDREN_RIGHT[node]) {{
            int local_feature = CLEANSIGHT_ISO_FEATURE[node];
            int original_feature = CLEANSIGHT_ISO_FEATURE_VALUES[feature_start + local_feature];
            if (scaled[original_feature] <= CLEANSIGHT_ISO_THRESHOLD[node]) {{
                node = CLEANSIGHT_ISO_CHILDREN_LEFT[node];
            }} else {{
                node = CLEANSIGHT_ISO_CHILDREN_RIGHT[node];
            }}
            depth++;
        }}
        total_path += depth + cleansight_avg_path_length((float)CLEANSIGHT_ISO_NODE_SAMPLES[node]);
    }}

    float denominator = CLEANSIGHT_ISO_TREE_COUNT * CLEANSIGHT_ISO_AVG_PATH_MAX_SAMPLES;
    return powf(2.0f, -total_path / denominator);
}}

static inline int cleansight_is_anomaly(
    float dust,
    float air_quality,
    float temperature,
    float humidity
) {{
    return cleansight_isolation_score(dust, air_quality, temperature, humidity)
        > CLEANSIGHT_ISO_SCORE_THRESHOLD ? 1 : 0;
}}

static inline float cleansight_forecast_next_dust(
    float dust_lag_1,
    float air_quality_lag_1,
    float temperature_lag_1,
    float humidity_lag_1,
    float hour_of_day
) {{
    float x[CLEANSIGHT_REG_FEATURE_COUNT] = {{
        dust_lag_1,
        air_quality_lag_1,
        temperature_lag_1,
        humidity_lag_1,
        hour_of_day
    }};
    float y = CLEANSIGHT_REG_INTERCEPT;
    for (int i = 0; i < CLEANSIGHT_REG_FEATURE_COUNT; i++) {{
        if (isnan(x[i])) x[i] = CLEANSIGHT_REG_IMPUTER_MEDIAN[i];
        float scaled = (x[i] - CLEANSIGHT_REG_SCALER_MEAN[i]) / CLEANSIGHT_REG_SCALER_SCALE[i];
        y += scaled * CLEANSIGHT_REG_COEF[i];
    }}
    return y;
}}
"""


def write_readme(output_path: Path, metadata: dict) -> None:
    metrics = metadata.get("metrics", {})
    readme = f"""# CleanSight AI Real TinyML Export

This folder contains real embedded/TinyML exports generated from the trained notebook models.

Main embedded model file:

```text
cleansight_real_tinyml_models.h
```

The header contains:

- Decision Tree cleanliness classifier exported from `models/decision_tree_cleanliness.pkl`
- Isolation Forest anomaly detector exported from `models/isolation_forest_anomaly.pkl`
- Linear Regression dust forecast model exported from `models/linear_regression_dust_forecast.pkl`

Training data source:

```text
data/raw/firestore_sensor_readings_raw.csv
```

Rows used after preparation: {metadata["processed_rows"]}

Evaluation metrics:

```json
{json.dumps(metrics, indent=2)}
```

Important: this is a C/C++ TinyML header export, not a `.tflite` file. TensorFlow was not available for the current Python 3.14 environment, so the trained scikit-learn models were exported directly into embedded C arrays and inference functions.

Arduino/ESP32 functions:

```cpp
cleansight_predict_cleanliness_label(...)
cleansight_is_anomaly(...)
cleansight_forecast_next_dust(...)
```
"""
    output_path.write_text(readme, encoding="utf-8")


def main() -> None:
    feature_map = json.loads((MODELS_DIR / "model_features.json").read_text(encoding="utf-8"))
    metrics_path = REPORTS_DIR / "metrics" / "model_metrics.json"
    metrics = json.loads(metrics_path.read_text(encoding="utf-8")) if metrics_path.exists() else {}

    processed_df = pd.read_csv(BASE_DIR / "data" / "processed" / "cleansight_processed_dataset.csv")
    decision_tree = joblib.load(MODELS_DIR / "decision_tree_cleanliness.pkl")
    isolation_forest = joblib.load(MODELS_DIR / "isolation_forest_anomaly.pkl")
    linear_regression = joblib.load(MODELS_DIR / "linear_regression_dust_forecast.pkl")

    metadata = {
        "project": "CleanSight AI",
        "source": "Firestore exported through notebook 01",
        "processed_rows": int(len(processed_df)),
        "feature_columns": feature_map,
        "metrics": metrics,
        "decision_tree": export_decision_tree(decision_tree),
        "isolation_forest": export_isolation_forest(
            isolation_forest,
            processed_df,
            feature_map["isolation_forest_anomaly"],
        ),
        "linear_regression": export_linear_regression(linear_regression),
    }

    header = make_header(metadata)

    MODELS_DIR.mkdir(parents=True, exist_ok=True)
    DOWNLOADS_DIR.mkdir(parents=True, exist_ok=True)

    model_header_path = MODELS_DIR / "cleansight_real_tinyml_models.h"
    model_metadata_path = MODELS_DIR / "cleansight_real_tinyml_metadata.json"
    model_header_path.write_text(header, encoding="utf-8")
    model_metadata_path.write_text(json.dumps(metadata, indent=2), encoding="utf-8")

    shutil.copy2(model_header_path, DOWNLOADS_DIR / model_header_path.name)
    shutil.copy2(model_metadata_path, DOWNLOADS_DIR / model_metadata_path.name)
    shutil.copy2(BASE_DIR / "data" / "raw" / "firestore_sensor_readings_raw.csv", DOWNLOADS_DIR / "firestore_sensor_readings_raw.csv")
    shutil.copy2(BASE_DIR / "data" / "processed" / "cleansight_processed_dataset.csv", DOWNLOADS_DIR / "cleansight_processed_dataset.csv")
    shutil.copy2(metrics_path, DOWNLOADS_DIR / "model_metrics.json")
    shutil.copy2(MODELS_DIR / "model_features.json", DOWNLOADS_DIR / "model_features.json")
    for filename in [
        "decision_tree_cleanliness.pkl",
        "isolation_forest_anomaly.pkl",
        "linear_regression_dust_forecast.pkl",
    ]:
        shutil.copy2(MODELS_DIR / filename, DOWNLOADS_DIR / filename)

    write_readme(DOWNLOADS_DIR / "README_REAL_TinyML.md", metadata)

    print("Real TinyML export completed.")
    print(f"Processed rows: {metadata['processed_rows']}")
    print(f"Decision tree nodes: {metadata['decision_tree']['node_count']}")
    print(f"Isolation forest trees: {metadata['isolation_forest']['estimator_count']}")
    print(f"Isolation forest nodes: {metadata['isolation_forest']['node_count']}")
    print(f"Downloads folder: {DOWNLOADS_DIR}")


if __name__ == "__main__":
    main()
