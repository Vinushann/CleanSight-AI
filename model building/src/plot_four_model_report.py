"""Create lecturer-friendly figures for the four CleanSight TinyML models."""

from __future__ import annotations

import json
from pathlib import Path

import matplotlib.pyplot as plt
import pandas as pd
import seaborn as sns


BASE_DIR = Path(__file__).resolve().parents[1]
MANIFEST_PATH = Path.home() / "Downloads" / "CleanSight_Four_TFLite_Models" / "tflite_model_manifest.json"
OUTPUT_DIR = BASE_DIR / "reports" / "figures" / "four_models"


def _load_manifest(path: Path) -> dict:
    if not path.exists():
        raise FileNotFoundError(f"Manifest not found: {path}")
    return json.loads(path.read_text(encoding="utf-8"))


def _flatten_manifest(manifest: dict) -> pd.DataFrame:
    rows: list[dict] = []
    for name, info in manifest["models"].items():
        metric_name = "test_accuracy" if "test_accuracy" in info else "test_mae"
        metric_value = info.get(metric_name)
        rows.append(
            {
                "model": name.replace("_", " ").title(),
                "target": info.get("target", ""),
                "metric_name": metric_name,
                "metric_value": metric_value,
                "rows": info.get("rows", 0),
                "quantization": info.get("quantization", ""),
                "file": info.get("file", ""),
                "size_kb": round(info.get("size_bytes", 0) / 1024, 2),
            }
        )
    return pd.DataFrame(rows)


def _style_figure() -> None:
    sns.set_theme(style="whitegrid")
    plt.rcParams.update(
        {
            "figure.facecolor": "white",
            "axes.facecolor": "white",
            "axes.edgecolor": "#333333",
            "axes.labelcolor": "#222222",
            "text.color": "#111111",
            "xtick.color": "#222222",
            "ytick.color": "#222222",
            "font.size": 11,
        }
    )


def plot_metric_figure(df: pd.DataFrame, output_path: Path) -> None:
    classification = df[df["metric_name"] == "test_accuracy"].copy()
    regression = df[df["metric_name"] == "test_mae"].copy()

    fig, axes = plt.subplots(1, 2, figsize=(14, 6))

    bars = axes[0].bar(classification["model"], classification["metric_value"], color="#1f77b4", width=0.6)
    axes[0].set_title("Classification Accuracy", fontsize=14, weight="bold")
    axes[0].set_xlabel("Model")
    axes[0].set_ylabel("Accuracy")
    axes[0].set_ylim(0, 1)
    axes[0].tick_params(axis="x", rotation=18)
    for bar, value in zip(bars, classification["metric_value"]):
        axes[0].text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + 0.03,
            f"{value * 100:.1f}%",
            ha="center",
            va="bottom",
            fontsize=10,
            weight="bold",
        )

    bars = axes[1].bar(regression["model"], regression["metric_value"], color="#d62728", width=0.6)
    axes[1].set_title("Cleanliness Score Regression", fontsize=14, weight="bold")
    axes[1].set_xlabel("Model")
    axes[1].set_ylabel("MAE")
    axes[1].tick_params(axis="x", rotation=18)
    max_mae = float(regression["metric_value"].max()) if not regression.empty else 1.0
    axes[1].set_ylim(0, max_mae * 1.25)
    for bar, value in zip(bars, regression["metric_value"]):
        axes[1].text(
            bar.get_x() + bar.get_width() / 2,
            bar.get_height() + max_mae * 0.03,
            f"{value:.2f}",
            ha="center",
            va="bottom",
            fontsize=10,
            weight="bold",
        )

    fig.suptitle("CleanSight TinyML Model Performance", fontsize=16, weight="bold")
    fig.text(0.5, 0.02, "Accuracy for classification models and MAE for the score regressor", ha="center", fontsize=11, color="#555555")
    fig.tight_layout(rect=(0, 0.04, 1, 0.95))
    fig.savefig(output_path, dpi=220, bbox_inches="tight")
    plt.close(fig)


def plot_size_figure(df: pd.DataFrame, output_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(12, 6))
    bars = ax.barh(df["model"], df["size_kb"], color="#2ca02c", height=0.6)
    ax.set_title("Exported TFLite Model Sizes", fontsize=16, weight="bold")
    ax.set_xlabel("File size (KB)")
    ax.set_ylabel("Model")

    for bar, size in zip(bars, df["size_kb"]):
        ax.text(
            bar.get_width() + 0.15,
            bar.get_y() + bar.get_height() / 2,
            f"{size:.2f} KB",
            va="center",
            fontsize=10,
            weight="bold",
        )

    fig.tight_layout()
    fig.savefig(output_path, dpi=220, bbox_inches="tight")
    plt.close(fig)


def plot_summary_table(df: pd.DataFrame, output_path: Path) -> None:
    fig, ax = plt.subplots(figsize=(14, 4.8))
    ax.axis("off")

    display = df.copy()
    display["metric_value"] = display.apply(
        lambda row: f"{row.metric_value * 100:.2f}%" if row.metric_name == "test_accuracy" else f"{row.metric_value:.2f}",
        axis=1,
    )
    table_df = display[["model", "target", "metric_value", "rows", "quantization", "file"]]
    table = ax.table(
        cellText=table_df.values,
        colLabels=["Model", "Target", "Metric", "Rows", "Quantization", "File"],
        loc="center",
        cellLoc="center",
    )
    table.auto_set_font_size(False)
    table.set_fontsize(10)
    table.scale(1, 1.55)
    ax.set_title("CleanSight TinyML Training Summary", fontsize=16, weight="bold", pad=18)
    fig.tight_layout()
    fig.savefig(output_path, dpi=220, bbox_inches="tight")
    plt.close(fig)


def main() -> None:
    _style_figure()
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

    manifest = _load_manifest(MANIFEST_PATH)
    df = _flatten_manifest(manifest)

    plot_metric_figure(df, OUTPUT_DIR / "four_model_performance.png")
    plot_size_figure(df, OUTPUT_DIR / "four_model_sizes.png")
    plot_summary_table(df, OUTPUT_DIR / "four_model_summary_table.png")

    summary_path = OUTPUT_DIR / "four_model_summary.json"
    summary_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"Created figures in: {OUTPUT_DIR}")
    for file in sorted(OUTPUT_DIR.iterdir()):
        if file.is_file():
            print(file.name)


if __name__ == "__main__":
    main()
