#!/usr/bin/env python3
"""
Re-process reports uploaded before the lab results feature (or before a parser or
catalog improvement), so their values appear in Health trends.

Each report's file is downloaded, decrypted and read again with the current parser,
then its lab results are rebuilt. Values people already confirmed or corrected are
rebuilt too, so run this before people start confirming values, or use --only-new.

Usage (from the backend/ directory):
  python scripts/rebuild_lab_results.py                    # every report
  python scripts/rebuild_lab_results.py --email a@b.com    # one patient's reports
  python scripts/rebuild_lab_results.py --results-only     # skip re-reading files; rebuild from saved OCR text
  python scripts/rebuild_lab_results.py --only-new         # only reports that have no lab results yet
"""
import argparse
import sys
from pathlib import Path

# Allow importing from backend/app
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
from sqlalchemy import func
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import SessionLocal  # noqa: E402
import app.models  # noqa: E402,F401  (registers every model)
from app.models.lab_result import LabResult  # noqa: E402
from app.models.medical_report import MedicalReport  # noqa: E402
from app.models.patient import Patient  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services import imaging_service  # noqa: E402
from app.services.encryption_service import decrypt_file  # noqa: E402
from app.services.lab_results_service import ingest  # noqa: E402
from app.services.ocr_service import run_ocr  # noqa: E402
from app.services.storage_service import download_file  # noqa: E402


def main() -> int:
    parser = argparse.ArgumentParser(description="Rebuild lab results from reports")
    parser.add_argument("--email", help="only this patient's reports")
    parser.add_argument("--results-only", action="store_true", help="rebuild from saved OCR output without re-reading files")
    parser.add_argument("--only-new", action="store_true", help="skip reports that already have lab results")
    args = parser.parse_args()

    db = SessionLocal()
    try:
        q = db.query(MedicalReport).filter(MedicalReport.report_type != imaging_service.IMAGING_REPORT_TYPE)
        if args.email:
            patient = db.query(Patient).join(User, User.id == Patient.user_id).filter(func.lower(User.email) == args.email.lower()).first()
            if not patient:
                print(f"No patient with email {args.email}")
                return 1
            q = q.filter(MedicalReport.patient_id == patient.id)
        if args.only_new:
            q = q.filter(~MedicalReport.lab_results.any())
        reports = q.order_by(MedicalReport.uploaded_at).all()
        print(f"{len(reports)} report(s) to process")

        totals = {"lab_report": 0, "other": 0, "failed": 0, "results": 0}
        for n, report in enumerate(reports, 1):
            label = f"[{n}/{len(reports)}] {report.original_filename}"
            try:
                if args.results_only:
                    if not report.ocr_result:
                        print(f"{label}: no OCR output saved, skipped")
                        continue
                    created = ingest(report, report.ocr_result, db)
                else:
                    file_bytes = decrypt_file(download_file(report.file_url), report.encryption_key_ref)
                    # run_ocr re-reads the file and rebuilds the lab results
                    run_ocr(report, file_bytes, db, existing=report.ocr_result)
                    created = db.query(LabResult).filter(LabResult.report_id == report.id).all()
            except Exception as exc:
                db.rollback()
                totals["failed"] += 1
                print(f"{label}: FAILED ({exc})")
                continue
            kind = report.document_kind or "other"
            totals[kind if kind in totals else "other"] += 1
            totals["results"] += len(created)
            extra = f", collected {report.collected_on}, {report.lab_name or 'lab unknown'}" if kind == "lab_report" else ""
            print(f"{label}: {kind}, {len(created)} result(s){extra}")

        print(
            f"\nDone. {totals['lab_report']} lab report(s) with {totals['results']} result(s); "
            f"{totals['other']} other document(s); {totals['failed']} failed."
        )
        return 0 if totals["failed"] == 0 else 2
    finally:
        db.close()


if __name__ == "__main__":
    sys.exit(main())
