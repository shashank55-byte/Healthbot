from __future__ import annotations

import sys

from sklearn.feature_extraction.text import CountVectorizer
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import MultinomialNB
from sklearn.pipeline import Pipeline

from common import DATA_ROOT, metric_payload, save_model_bundle


def row_to_text(row: dict[str, str]) -> str:
    values = []
    for key, value in row.items():
        if key.lower() == "disease":
            continue
        if key.lower().startswith("symptom") and value:
            values.append(value.replace("_", " "))
    return " ".join(values).strip()


def main() -> None:
    import csv

    path = DATA_ROOT / "symptoms" / "DiseaseAndSymptoms.csv"
    if not path.exists():
      print(f"Dataset not found: {path}")
      return

    with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
        rows = list(csv.DictReader(handle))

    seen = set()
    texts, labels = [], []
    for row in rows:
        label = (row.get("Disease") or "").strip()
        text = row_to_text(row)
        key = (label.lower(), " ".join(sorted(text.lower().split())))
        if not label or not text or key in seen:
            continue
        seen.add(key)
        labels.append(label)
        texts.append(text)

    if len(set(labels)) < 2:
        print("Not enough disease classes to train general model.")
        return

    x_train, x_val, y_train, y_val = train_test_split(
        texts,
        labels,
        test_size=0.2,
        random_state=42,
        shuffle=True,
        stratify=labels,
    )
    model = Pipeline([
        ("vectorizer", CountVectorizer(ngram_range=(1, 2))),
        ("classifier", MultinomialNB()),
    ])
    model.fit(x_train, y_train)
    preds = model.predict(x_val)
    metrics = metric_payload(y_val, preds, labels=sorted(set(labels)))
    payload = save_model_bundle(
        "general_disease_model",
        model,
        metrics,
        {
            "role": "General disease prediction from selected or extracted symptoms.",
            "dataset": str(path.relative_to(DATA_ROOT.parents[0])),
            "samples": len(texts),
            "training_samples": len(x_train),
            "validation_samples": len(x_val),
            "disease_classes": len(set(labels)),
            "features": len(model.named_steps["vectorizer"].vocabulary_),
            "algorithm": "CountVectorizer + Multinomial Naive Bayes",
        },
    )
    print(payload["metrics"])


if __name__ == "__main__":
    sys.exit(main())
