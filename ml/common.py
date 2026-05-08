from __future__ import annotations

import csv
import json
import pickle
from pathlib import Path

from sklearn.metrics import accuracy_score, confusion_matrix, f1_score, precision_score, recall_score


PROJECT_ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = PROJECT_ROOT / "data"
MODEL_ROOT = PROJECT_ROOT / "models"
BACKEND_MODEL_ROOT = PROJECT_ROOT / "backend" / "models"
EVALUATION_NOTE = (
    "The datasets are structured academic datasets, so normal holdout accuracy may be high. "
    "Use validation limitations before making claims about real-world performance."
)
SAFETY_DISCLAIMER = (
    "This system is for educational and decision-support purposes only and does not replace "
    "professional medical diagnosis or treatment."
)


def ensure_model_dirs() -> None:
    MODEL_ROOT.mkdir(parents=True, exist_ok=True)
    BACKEND_MODEL_ROOT.mkdir(parents=True, exist_ok=True)


def read_csv_dicts(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
        return list(csv.DictReader(handle))


def write_json(path: Path, payload: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def save_pickle(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as handle:
        pickle.dump(payload, handle)


def metric_payload(y_true, y_pred, labels=None) -> dict:
    labels = labels or sorted(set(y_true) | set(y_pred))
    accuracy = round(float(accuracy_score(y_true, y_pred)), 4)
    validation_per_class = round(len(y_true) / len(labels), 2) if labels else 0
    warnings = []
    if accuracy >= 0.9:
        warnings.append(
            "High accuracy may be inflated by structured academic data and disease-specific feature patterns."
        )
    if validation_per_class and validation_per_class < 3:
        warnings.append(
            "Validation samples per class are low, so per-class performance should be treated cautiously."
        )

    return {
        "accuracy": accuracy,
        "precision": round(float(precision_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "recall": round(float(recall_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "f1_score": round(float(f1_score(y_true, y_pred, average="weighted", zero_division=0)), 4),
        "confusion_matrix": {
            "labels": [str(label) for label in labels],
            "matrix": confusion_matrix(y_true, y_pred, labels=labels).tolist(),
            "note": "Rows represent actual classes and columns represent predicted classes.",
        },
        "evaluation_note": EVALUATION_NOTE,
        "validation_audit": {
            "overfitting_risk": "medium" if accuracy >= 0.9 else "low",
            "dataset_simplicity_risk": "high" if accuracy >= 0.85 else "medium",
            "validation_samples_per_class": validation_per_class,
            "recommended_claim": (
                "Use as a clinical decision-support prototype, not a clinically validated diagnostic model."
            ),
            "warnings": warnings,
        },
    }


def save_model_bundle(name: str, estimator, metrics: dict, metadata: dict) -> dict:
    ensure_model_dirs()
    pkl_path = MODEL_ROOT / f"{name}.pkl"
    metrics_path = MODEL_ROOT / f"{name}.metrics.json"
    backend_metrics_path = BACKEND_MODEL_ROOT / f"{name}.metrics.json"

    bundle = {
        "estimator": estimator,
        "metadata": metadata,
        "metrics": metrics,
        "safety_disclaimer": SAFETY_DISCLAIMER,
    }
    save_pickle(pkl_path, bundle)

    public_payload = {
        "model_name": name,
        **metadata,
        "metrics": metrics,
        "evaluation_note": EVALUATION_NOTE,
        "safety_disclaimer": SAFETY_DISCLAIMER,
        "model_path": str(pkl_path.relative_to(PROJECT_ROOT)),
    }
    write_json(metrics_path, public_payload)
    write_json(backend_metrics_path, public_payload)
    return public_payload
