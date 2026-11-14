#!/usr/bin/env python3
"""Small fixed retrieval evaluation, not a coding or token-cost benchmark."""
import argparse
import hashlib
import json
import platform
from pathlib import Path
import sqlite3
import statistics
import tempfile
import time
import cortex

CASES = [
    ("physics import entry point", "importPhysicsCourse", "apps/web/src/courses/physics/import.ts"),
    ("physics pack validation", "PhysicsImportSchema", "apps/web/src/courses/physics/import.ts"),
    ("learner evidence projection", "projectLearningEvidence", "packages/lesson-os/src/learning-evidence.ts"),
    ("resume interrupted imports", "importazione interrotta duplicare materiali", "apps/web/src/courses/physics/PhysicsCatalog.tsx"),
    ("scientific review in course catalog", "revisione scientifica umana sotto obiettivi", "apps/web/src/courses/physics/PhysicsCatalog.tsx"),
]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--repo", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    repo = cortex.repository(args.repo)
    with tempfile.TemporaryDirectory(prefix="cortex-benchmark-") as tmp:
        db_path = Path(tmp) / "index.sqlite3"
        db = cortex.connect(db_path, repo)
        cold = cortex.refresh(db, repo)
        warm = cortex.refresh(db, repo)
        cases = []
        for label, query, expected in CASES:
            durations = []
            result = None
            for _ in range(3):
                began = time.perf_counter()
                result = cortex.search(db, repo, query, budget_bytes=8000, limit=8)
                durations.append((time.perf_counter() - began) * 1000)
            files = sorted({item["path"] for item in result["results"]})
            full_files_bytes = sum((repo / path).stat().st_size for path in files)
            cases.append({"task": label, "query": query, "expected_file": expected,
                          "hit": expected in files, "returned_files": files,
                          "evidence_bytes": result["evidence_bytes"],
                          "full_returned_files_bytes": full_files_bytes,
                          "median_ms_including_hash_refresh": round(statistics.median(durations), 3),
                          "durations_ms": [round(n, 3) for n in durations]})
        db_bytes = db_path.stat().st_size
        db.close()
    report = {"kind": "cortex-fixed-retrieval-pilot", "environment": {"platform": platform.platform(),
              "machine": platform.machine(), "python": platform.python_version(), "sqlite": sqlite3.sqlite_version},
              "implementation_sha256": hashlib.sha256(Path(cortex.__file__).read_bytes()).hexdigest(),
              "cold_index": cold, "warm_index": warm, "database_bytes": db_bytes,
              "cases": cases, "hits": sum(row["hit"] for row in cases), "total_cases": len(cases),
              "limits": ["Five hand-selected queries, not a representative coding evaluation",
                         "No cloud calls, no measured cloud-token savings or defect reduction",
                         "Entire permitted corpus rehashed before each search; chunking/index updates incremental",
                         "Hardware and runtime are the observed environment above; no cross-host performance claim",
                         "Byte budget covers evidence text plus provenance, excludes JSON envelope",
                         "Expected-file hit is localization, not proof that context is sufficient for a correct patch"]}
    Path(args.output).write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"hits": report["hits"], "total": len(cases), "output": args.output}))


if __name__ == "__main__":
    main()
