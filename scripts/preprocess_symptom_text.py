from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "symptoms" / "Symptom2Disease.csv"
OUT = ROOT / "data" / "symptoms" / "symptom_text_manifest.json"


def main() -> None:
    if not PATH.exists():
        payload = {"name": PATH.name, "status": "Dataset not found"}
    else:
        with PATH.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
            rows = list(csv.DictReader(handle))
        labels = {row.get("label", "").strip() for row in rows if row.get("label")}
        payload = {
            "name": PATH.name,
            "status": "ready",
            "rows": len(rows),
            "disease_classes": len(labels),
            "purpose": "Improve natural-language symptom understanding",
        }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
