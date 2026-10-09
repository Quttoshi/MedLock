# Gold set for extraction accuracy

Real lab reports with the answers a person read from them. `scripts/evaluate_extraction.py`
reads each report exactly the way an upload is read and compares the result with the answers.

## Adding a report

1. **Remove personal details first.** Black out the patient's name, CNIC, phone, MR/lab
   numbers and address (on a photo, cover them before taking it; on a PDF, use a redaction
   tool or print-and-scan). Leave the lab name, dates, test names, values, units and ranges.
2. Put the file here (`.pdf`, `.jpg`, `.png`, `.tif` or `.docx`), e.g. `chughtai_cbc_01.pdf`.
3. Next to it, create `chughtai_cbc_01.json` with what the report says:

```json
{
  "sex": "female",
  "document_kind": "lab_report",
  "collected_on": "2026-03-12",
  "lab_name": "Chughtai Lab",
  "results": {
    "hemoglobin": 10.9,
    "wbc": 7.2,
    "platelets": 250,
    "glucose_fasting": 112
  }
}
```

- `sex`: the patient's sex as printed (`male`/`female`), or `null`.
- `document_kind`: `lab_report`, or `other` for prescriptions, discharge summaries, scans, etc.
  (Use `other` with empty `results` to check MedLock does *not* invent values from them.)
- `collected_on`: the sample collection date (or the report date if no collection date is printed).
- `lab_name`: as MedLock names it (Chughtai Lab, Excel Labs, Islamabad Diagnostic Centre,
  Shaukat Khanum, Aga Khan University Hospital, ...), or `null` if it is not printed.
- `results`: every test on the report that MedLock knows, **in MedLock's unit**. Run
  `python scripts/evaluate_extraction.py --units` for the codes and units. For example a
  TLC of 7,200 /cumm is `"wbc": 7.2`, platelets of 2.5 lac/cumm are `"platelets": 250`,
  and a fasting glucose of 6.2 mmol/L is `"glucose_fasting": 111.7`.

Aim for 10 to 15 reports: a mix of labs, digital PDFs, scanned PDFs and phone photos.

## Running

From `backend/`:

```
python scripts/evaluate_extraction.py               # this folder
python scripts/evaluate_extraction.py --synthetic   # plus the generated sample reports
python scripts/evaluate_extraction.py --json results.json
```

The most important number is **wrong but trusted**: values MedLock got wrong but would show
as reliable. It should be 0. Wrong values with lower confidence are shown to patients as
"not yet checked" and are left out of the summary.
