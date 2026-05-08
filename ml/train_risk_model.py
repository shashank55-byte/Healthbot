from __future__ import annotations

import sys

import pandas as pd
from sklearn.compose import ColumnTransformer
from sklearn.impute import SimpleImputer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import confusion_matrix
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler

from common import DATA_ROOT, metric_payload, read_csv_dicts, save_model_bundle


def main() -> None:
    path = DATA_ROOT / "vitals" / "hypertension_dataset.csv"
    rows = read_csv_dicts(path)
    if not rows:
        print(f"Dataset not found or empty: {path}")
        return

    target = "Hypertension"
    feature_names = [name for name in rows[0].keys() if name != target]
    numeric = [
        "Age", "BMI", "Cholesterol", "Systolic_BP", "Diastolic_BP", "Alcohol_Intake",
        "Stress_Level", "Salt_Intake", "Sleep_Duration", "Heart_Rate", "LDL", "HDL",
        "Triglycerides", "Glucose"
    ]
    categorical = [name for name in feature_names if name not in numeric]
    clean_rows = [row for row in rows if row.get(target)]
    x = pd.DataFrame([{name: row.get(name) for name in feature_names} for row in clean_rows])
    y = [row[target] for row in clean_rows]

    preprocessor = ColumnTransformer([
        ("num", Pipeline([("imputer", SimpleImputer(strategy="median")), ("scale", StandardScaler())]), numeric),
        ("cat", Pipeline([("imputer", SimpleImputer(strategy="most_frequent")), ("onehot", OneHotEncoder(handle_unknown="ignore"))]), categorical),
    ])
    model = Pipeline([
        ("preprocessor", preprocessor),
        ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced")),
    ])
    x_train, x_val, y_train, y_val = train_test_split(
        x, y, test_size=0.2, random_state=42, shuffle=True, stratify=y
    )
    model.fit(x_train, y_train)
    preds = model.predict(x_val)
    metrics = metric_payload(y_val, preds, labels=sorted(set(y)))
    payload = save_model_bundle(
        "risk_model",
        model,
        metrics,
        {
            "role": "Vitals and lifestyle risk refinement using hypertension-related health indicators.",
            "dataset": str(path.relative_to(DATA_ROOT.parents[0])),
            "samples": len(x),
            "training_samples": len(x_train),
            "validation_samples": len(x_val),
            "disease_classes": len(set(y)),
            "features": len(feature_names),
            "algorithm": "Logistic Regression classifier with numeric/categorical preprocessing",
        },
    )
    print(payload["metrics"])


if __name__ == "__main__":
    sys.exit(main())
