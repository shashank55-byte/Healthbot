from __future__ import annotations

import sys

from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.model_selection import train_test_split
from sklearn.naive_bayes import ComplementNB
from sklearn.pipeline import Pipeline

from common import DATA_ROOT, metric_payload, read_csv_dicts, save_model_bundle


def main() -> None:
    path = DATA_ROOT / "symptoms" / "Symptom2Disease.csv"
    rows = read_csv_dicts(path)
    if not rows:
        print(f"Dataset not found or empty: {path}")
        return

    texts = [(row.get("text") or "").strip() for row in rows]
    labels = [(row.get("label") or "").strip() for row in rows]
    pairs = [(text, label) for text, label in zip(texts, labels) if text and label]
    texts, labels = zip(*pairs)

    x_train, x_val, y_train, y_val = train_test_split(
        list(texts),
        list(labels),
        test_size=0.2,
        random_state=42,
        shuffle=True,
        stratify=list(labels),
    )
    model = Pipeline([
        ("tfidf", TfidfVectorizer(ngram_range=(1, 2), min_df=2, stop_words="english")),
        ("classifier", ComplementNB()),
    ])
    model.fit(x_train, y_train)
    preds = model.predict(x_val)
    metrics = metric_payload(y_val, preds, labels=sorted(set(labels)))
    payload = save_model_bundle(
        "symptom_text_model",
        model,
        metrics,
        {
            "role": "Natural-language symptom understanding from free-text patient messages.",
            "dataset": str(path.relative_to(DATA_ROOT.parents[0])),
            "samples": len(texts),
            "training_samples": len(x_train),
            "validation_samples": len(x_val),
            "disease_classes": len(set(labels)),
            "features": len(model.named_steps["tfidf"].vocabulary_),
            "algorithm": "TF-IDF + Complement Naive Bayes",
        },
    )
    print(payload["metrics"])


if __name__ == "__main__":
    sys.exit(main())
