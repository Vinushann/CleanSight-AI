# CleanSight AI - Model Building Pipeline

CleanSight AI is an IoT room cleanliness monitoring project. This folder contains only the machine learning pipeline for extracting Firestore data, preparing datasets, training explainable models, evaluating results, and running a demo prediction.

## Folder Structure

```text
model building/
├── notebooks/
├── data/
│   ├── raw/
│   └── processed/
├── models/
├── reports/
│   ├── figures/
│   └── metrics/
├── src/
├── requirements.txt
├── README.md
└── .gitignore
```

## Firestore Data Structure

The current Firestore structure is:

```text
sessions/{session_id}
sessions/{session_id}/readings/{reading_id}
```

Session documents contain metadata such as `house_id`, `room_id`, `session_type`, `device_id`, `start_time`, `end_time`, and reading interval information.

Reading documents contain the ML sensor values:

- `dust`
- `air_quality`
- `temperature`
- `humidity`
- `timestamp_ms`
- optional fields such as `dust_level`, `sensor_status`, and `notes`

## Firebase Service Account Key

Do not commit Firebase private keys to Git.

Place your Firebase service account JSON file somewhere local, for example:

```text
model building/secrets/firebase-service-account.json
```

This folder's `.gitignore` ignores JSON and environment files so credentials are not committed.

You can either set the path inside notebook 01 or use an environment variable:

```bash
export FIREBASE_SERVICE_ACCOUNT_PATH="secrets/firebase-service-account.json"
```

## How To Run

Install dependencies from inside this folder:

```bash
pip install -r requirements.txt
```

Run the notebooks in order:

1. `notebooks/01_extract_firestore_data.ipynb`
2. `notebooks/02_prepare_dataset.ipynb`
3. `notebooks/03_train_models.ipynb`
4. `notebooks/04_evaluate_models.ipynb`
5. `notebooks/05_inference_demo.ipynb`

## Models Trained

### 1. Decision Tree Classifier

Predicts `cleanliness_label` as:

- `clean`
- `needs_attention`
- `dirty`

This supports learned cleanliness prediction and alerting instead of relying only on fixed sensor thresholds. It is also easy to explain during viva because feature importance can be shown.

### 2. Isolation Forest

Detects unusual sensor patterns as:

- `normal`
- `anomaly`

This helps identify sudden dust spikes, abnormal air quality readings, or sensor behavior that does not match the normal pattern.

### 3. Linear Regression

Predicts `next_dust`, the next expected dust value. This gives a simple short-term trend forecast for predictive cleaning decisions.

## Important Label Note

If manual labels exist in `notes`, `manual_label`, `label`, or `cleanliness_label`, the pipeline uses them first.

If manual labels do not exist, the pipeline creates temporary weak labels using dust and air quality. These weak labels are useful for building the demo pipeline, but they should be improved later with real cleaning observations.

## Output Files

The notebooks generate:

- `data/raw/firestore_sensor_readings_raw.csv`
- `data/processed/cleansight_processed_dataset.csv`
- `models/decision_tree_cleanliness.pkl`
- `models/isolation_forest_anomaly.pkl`
- `models/linear_regression_dust_forecast.pkl`
- `models/model_features.json`
- `reports/metrics/model_metrics.json`
- figures in `reports/figures/`

Required figures:

- `dust_over_time.png`
- `air_quality_over_time.png`
- `cleanliness_confusion_matrix.png`
- `decision_tree_feature_importance.png`
- `anomalies_over_time.png`
- `regression_actual_vs_predicted.png`

## Backend And Dashboard Use Later

After training, the backend or dashboard can load the saved `.pkl` files and call the reusable functions in `src/inference.py`.

Example:

```python
from src.inference import predict_all

sample = {
    "dust": 35.5,
    "air_quality": 128,
    "temperature": 31.2,
    "humidity": 78.4,
}

result = predict_all(sample, model_dir="models")
print(result)
```

For production use, rolling and lag features should be calculated from the latest readings in the same room or session before calling the model.

## Real TinyML Export

After running notebooks 01 to 05, export the real trained models into ESP32-ready C/C++ code:

```bash
.venv/bin/python src/export_real_tinyml.py
```

This creates:

- `models/cleansight_real_tinyml_models.h`
- `models/cleansight_real_tinyml_metadata.json`

It also copies the final package to:

```text
~/Downloads/CleanSight_TinyML_Models/
```

Use `cleansight_real_tinyml_models.h` in Arduino/PlatformIO code. It contains embedded inference functions for the trained Decision Tree, Isolation Forest, and Linear Regression models.
