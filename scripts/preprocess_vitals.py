from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "data" / "vitals" / "hypertension_dataset.csv"
OUT = ROOT / "data" / "vitals" / "vitals_manifest.json"


def main() -> None:
    if not PATH.exists():
        payload = {"name": PATH.name, "status": "Dataset not found"}
    else:
        with PATH.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
            reader = csv.DictReader(handle)
            rows = list(reader)
            fields = reader.fieldnames or []
        payload = {
            "name": PATH.name,
            "status": "ready",
            "rows": len(rows),
            "features": max(0, len(fields) - 1),
            "target": "Hypertension",
            "purpose": "Improve health risk score using BP, heart rate, age, lifestyle and vitals",
        }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
