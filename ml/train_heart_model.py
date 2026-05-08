from __future__ import annotations

import sys
from pathlib import Path

from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from common import DATA_ROOT, metric_payload, save_model_bundle


HEART_COLUMNS = [
    "age", "sex", "cp", "trestbps", "chol", "fbs", "restecg", "thalach",
    "exang", "oldpeak", "slope", "ca", "thal", "target"
]


def read_heart_rows(folder: Path):
    rows = []
    for path in folder.glob("processed.*.data"):
        for line in path.read_text(encoding="utf-8", errors="ignore").splitlines():
            parts = [part.strip() for part in line.split(",")]
            if len(parts) != len(HEART_COLUMNS) or "?" in parts:
                continue
            values = [float(part) for part in parts]
            rows.append(values)
    return rows


def main() -> None:
    folder = DATA_ROOT / "specialized" / "heart"
    rows = read_heart_rows(folder)
    if not rows:
        print(f"Dataset not found or empty: {folder}")
        return

    x = [row[:-1] for row in rows]
    y = [1 if row[-1] > 0 else 0 for row in rows]
    x_train, x_val, y_train, y_val = train_test_split(
        x, y, test_size=0.2, random_state=42, shuffle=True, stratify=y
    )
    model = Pipeline([
        ("imputer", SimpleImputer(strategy="median")),
        ("scale", StandardScaler()),
        ("classifier", RandomForestClassifier(n_estimators=120, random_state=42, class_weight="balanced")),
    ])
    model.fit(x_train, y_train)
    preds = model.predict(x_val)
    metrics = metric_payload(y_val, preds, labels=[0, 1])
    payload = save_model_bundle(
        "heart_model",
        model,
        metrics,
        {
            "role": "Specialized heart-risk refinement when cardiac symptoms or abnormal vitals are present.",
            "dataset": str(folder.relative_to(DATA_ROOT.parents[0])),
            "samples": len(x),
            "training_samples": len(x_train),
            "validation_samples": len(x_val),
            "disease_classes": 2,
            "features": len(HEART_COLUMNS) - 1,
            "algorithm": "Random Forest classifier",
            "feature_names": HEART_COLUMNS[:-1],
        },
    )
    print(payload["metrics"])


if __name__ == "__main__":
    sys.exit(main())
