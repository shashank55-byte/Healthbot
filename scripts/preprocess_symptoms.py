from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / "data" / "symptoms"
OUT = ROOT / "data" / "symptoms" / "symptoms_manifest.json"


def inspect_csv(path: Path) -> dict:
    if not path.exists():
        return {"name": path.name, "status": "Dataset not found"}
    with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
    diseases = {row.get("Disease", "").strip() for row in rows if row.get("Disease")}
    symptoms = set()
    for row in rows:
        for key, value in row.items():
            if key.lower().startswith("symptom") and value:
                symptoms.add(value.strip().lower().replace("_", " "))
    return {
        "name": path.name,
        "status": "ready",
        "rows": len(rows),
        "disease_classes": len(diseases),
        "symptoms": len(symptoms),
        "purpose": "General disease prediction from symptoms",
    }


def main() -> None:
    payload = {
        "datasets": [
            inspect_csv(DATA / "DiseaseAndSymptoms.csv"),
            inspect_csv(DATA / "Disease precaution.csv"),
        ]
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
