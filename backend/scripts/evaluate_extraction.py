#!/usr/bin/env python3
"""
Measure how accurately MedLock reads lab reports (for the FYP evaluation chapter).

Each report in the gold folder needs an answer file with the same name and .json,
written by a person reading the report (see gold/README.md for the format). Reports
are read exactly the way uploads are, then compared with the answers.

Usage (from the backend/ directory):
  python scripts/evaluate_extraction.py                  # the gold/ folder
  python scripts/evaluate_extraction.py --synthetic      # also the generated sample reports
  python scripts/evaluate_extraction.py --folder path/   # another folder
  python scripts/evaluate_extraction.py --json results.json
  python scripts/evaluate_extraction.py --units          # the unit to write each test's value in
"""
import argparse
import json
import sys
from pathlib import Path

# Allow importing from backend/app
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.services import extraction_evaluation as ev  # noqa: E402
from app.services import lab_catalog as catalog  # noqa: E402

DEFAULT_FOLDER = Path(__file__).parent.parent / "gold"


def _pct(value) -> str:
    return "-" if value is None else f"{value * 100:.1f}%"


def _print_units() -> None:
    print(f"{'code':<18} {'unit':<16} name")
    for test in catalog.TESTS.values():
        if not test.derived:
            print(f"{test.code:<18} {test.unit:<16} {test.name}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Evaluate lab report extraction against a gold set")
    parser.add_argument("--folder", type=Path, default=DEFAULT_FOLDER, help="gold folder (default: backend/gold)")
    parser.add_argument("--synthetic", action="store_true", help="also evaluate the generated sample reports")
    parser.add_argument("--json", type=Path, help="write full results to this file")
    parser.add_argument("--units", action="store_true", help="list test codes and units for answer files")
    args = parser.parse_args()

    if args.units:
        _print_units()
        return 0

    cases = ev.load_cases(args.folder) if args.folder.exists() else []
    if args.synthetic:
        cases += ev.synthetic_cases()
    if not cases:
        print(f"No gold cases in {args.folder}. Add reports with answer files, or use --synthetic.")
        return 1

    outcomes = []
    for case in cases:
        o = ev.evaluate_case(case)
        outcomes.append(o)
        right = len(o["correct"])
        total = right + len(o["wrong"]) + len(o["missed"])
        print(f"{case.name}  [{o['engine']}]  {right}/{total} correct")
        for w in o["wrong"]:
            print(f"    WRONG   {w['test']}: expected {w['expected']}, read {w['got']} ({w['confidence']})  <- {w['source']}")
        for code in o["missed"]:
            print(f"    MISSED  {code}")
        for x in o["extra"]:
            print(f"    EXTRA   {x['test']}: {x['got']} ({x['confidence']})  <- {x['source']}")
        for name in ("document_kind", "collected_on", "lab_name"):
            f = o[name]
            if f["expected"] is not None and f["expected"] != f["got"]:
                print(f"    {name}: expected {f['expected']}, got {f['got']}")

    s = ev.summarize(outcomes)
    print("\n-- Summary ------------------------------")
    print(f"Reports:                 {s['cases']}")
    print(f"Values read correctly:   {s['correct_values']}/{s['expected_values']}  (recall {_pct(s['recall'])})")
    print(f"Values produced correct: precision {_pct(s['precision'])}")
    print(f"Wrong / missed / extra:  {s['wrong_values']} / {s['missed_values']} / {s['extra_values']}")
    print(f"Wrong but trusted:       {s['wrong_but_trusted']}  (wrong values shown as reliable; should be 0)")
    for name, label in (("document_kind", "Lab report detection"), ("collected_on", "Collection date"),
                        ("lab_name", "Lab name")):
        f = s[name]
        if f:
            print(f"{label + ':':<25}{f['right']}/{f['checked']}  ({_pct(f['rate'])})")

    if args.json:
        args.json.write_text(json.dumps({"summary": s, "cases": outcomes}, indent=2, default=str), encoding="utf-8")
        print(f"\nFull results written to {args.json}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
