from __future__ import annotations

import csv
import json
from pathlib import Path


ROOT = Path(__file__).resolve().parents[1]
SPECIALIZED = ROOT / "data" / "specialized"
OUT = SPECIALIZED / "specialized_manifest.json"


def count_csv(path: Path) -> tuple[int, int]:
    if not path.exists():
        return 0, 0
    with path.open("r", encoding="utf-8", errors="ignore", newline="") as handle:
        reader = csv.DictReader(handle)
        rows = list(reader)
        return len(rows), len(reader.fieldnames or [])


def count_heart(folder: Path) -> int:
    total = 0
    for path in folder.glob("processed.*.data"):
        total += len([line for line in path.read_text(encoding="utf-8", errors="ignore").splitlines() if line.strip()])
    return total


def main() -> None:
    diabetes_rows, diabetes_columns = count_csv(SPECIALIZED / "diabetes" / "diabetes.csv")
    payload = {
        "datasets": [
            {
                "name": "diabetes.csv",
                "status": "ready" if diabetes_rows else "Dataset not found",
                "rows": diabetes_rows,
                "features": max(0, diabetes_columns - 1),
                "purpose": "Specialized diabetes-risk refinement",
            },
            {
                "name": "UCI processed heart disease files",
                "status": "ready" if count_heart(SPECIALIZED / "heart") else "Dataset not found",
                "rows": count_heart(SPECIALIZED / "heart"),
                "features": 13,
                "purpose": "Specialized heart-risk refinement",
            },
        ]
    }
    OUT.write_text(json.dumps(payload, indent=2), encoding="utf-8")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
