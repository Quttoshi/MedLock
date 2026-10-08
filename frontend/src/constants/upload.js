// Upload rules for the patient upload page, kept in one place so the screen
// copy, the validation and the file picker always agree. The values are the
// same ones that were hardcoded in UploadReport.jsx. The backend is still the
// authority; these only decide what the browser checks before sending.

// Normal reports (PDF and images)
export const STANDARD_MAX_MB = 10;
export const STANDARD_MIME_TYPES = ["application/pdf", "image/jpeg", "image/png", "image/tiff"];
export const STANDARD_TYPES_LABEL = "PDF, JPEG, PNG and TIFF";

// DICOM studies (.dcm, or a .zip of a whole CT or MRI series)
export const IMAGING_MAX_MB = 300;
export const IMAGING_NAME_PATTERN = /.(dcm|dicom|zip)$/i;
export const IMAGING_TYPES_LABEL = "DICOM (.dcm or a .zip study)";

// What the file picker offers
export const FILE_INPUT_ACCEPT = ".pdf,.jpg,.jpeg,.png,.tif,.tiff,.docx,.doc,.dcm,.dicom,.zip";

// Report types offered for normal reports
export const REPORT_TYPES = [
  "Blood Test",
  "X-Ray",
  "MRI Scan",
  "CT Scan",
  "Ultrasound",
  "ECG",
  "Urine Test",
  "Pathology Report",
  "Prescription",
  "Other",
];

// Report types offered on the medical center upload page. These are the exact
// values that page already submitted (snake_case), kept as they were.
export const MC_REPORT_TYPES = [
  "blood_test",
  "urine_test",
  "xray",
  "mri",
  "ct_scan",
  "ecg",
  "ultrasound",
  "prescription",
  "discharge_summary",
  "other",
];
