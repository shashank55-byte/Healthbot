"""
Simple symptom classifier stub.

Replace the dummy logic in `predict` with a trained classifier.
Implement training in `train` by loading data from CSV and saving a model
artifact (e.g., with joblib). You can then load the artifact in `load_model`.

Usage (CLI):
  python symptom_classifier.py --text "fever and cough"
Outputs a JSON object to stdout.
"""

import argparse
import json
from typing import Dict


def load_model():
    """
    Load a trained model artifact here (e.g., joblib.load('model.joblib')).
    Currently returns None and the code uses dummy rules in `predict`.
    """
    return None


def train(data_path: str, model_out: str):
    """
    Implement training pipeline here:
      - Load CSV at `data_path`
      - Vectorize text (e.g., TF-IDF)
      - Train classifier (e.g., LogisticRegression)
      - Persist model to `model_out` with joblib
    """
    raise NotImplementedError("Training pipeline is not implemented yet.")


def sequenceDiagram
    participant FE as Frontend (React)
    participant U as User

    FE->>FE: Detect severe level or emergency_signs
    FE->>U: Show Emergency Banner + Actions
    U->>FE: Click "Call Helpline"
    FE->>U: Open tel: link
    U->>FE: Click "Find Nearby Hospital"
    FE->>U: Open maps search in browserpredict(text: str, _model) -> Dict:
    """
    Dummy rule-based classification. Replace with model.predict_proba.
    """
    t = (text or "").lower()
    if any(k in t for k in ["chest pain", "shortness of breath", "sob"]):
        return {"label": "emergency", "confidence": 0.9}
    if any(k in t for k in ["fever", "cough"]):
        return {"label": "flu_like", "confidence": 0.7}
    if "headache" in t:
        return {"label": "migraine_like", "confidence": 0.6}
    return {"label": "unknown", "confidence": 0.2}


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", type=str, default="")
    args = parser.parse_args()

    model = load_model()
    result = predict(args.text, model)
    print(json.dumps(result))


if __name__ == "__main__":
    main()

