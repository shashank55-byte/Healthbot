from __future__ import annotations

import sys

from sklearn.ensemble import RandomForestClassifier
from sklearn.impute import SimpleImputer
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

from common import DATA_ROOT, metric_payload, read_csv_dicts, save_model_bundle


def main() -> None:
    path = DATA_ROOT / "specialized" / "diabetes" / "diabetes.csv"
    rows = read_csv_dicts(path)
    if not rows:
        print(f"Dataset not found or empty: {path}")
        return

    target = "Outcome"
    features = [name for name in rows[0].keys() if name != target]
    x = [[float(row.get(name) or 0) for name in features] for row in rows if row.get(target) != ""]
    y = [int(float(row[target])) for row in rows if row.get(target) != ""]
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
        "diabetes_model",
        model,
        metrics,
        {
            "role": "Specialized diabetes-risk refinement when glucose or diabetes-related symptoms/history are present.",
            "dataset": str(path.relative_to(DATA_ROOT.parents[0])),
            "samples": len(x),
            "training_samples": len(x_train),
            "validation_samples": len(x_val),
            "disease_classes": 2,
            "features": len(features),
            "algorithm": "Random Forest classifier",
            "feature_names": features,
        },
    )
    print(payload["metrics"])


if __name__ == "__main__":
    sys.exit(main())
