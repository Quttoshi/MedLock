import { useState } from "react";
import { FileText, Upload, X, ShieldCheck, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import PatientLookupFields from "../../components/PatientLookupFields";
import { EMPTY_LOOKUP, lookupComplete, lookupPayload } from "../../utils/patientLookup";
import { uploadPatientImaging, uploadPatientReport } from "../../api/medicalCenter";
import {
  STANDARD_MAX_MB,
  STANDARD_TYPES_LABEL,
  IMAGING_MAX_MB,
  IMAGING_NAME_PATTERN,
  IMAGING_TYPES_LABEL,
  FILE_INPUT_ACCEPT,
  MC_REPORT_TYPES,
} from "../../constants/upload";

// DICOM studies (.dcm, or a .zip of a whole CT/MRI series) go through imaging upload.
const isDicomFile = (f) => Boolean(f) && IMAGING_NAME_PATTERN.test(f.name);

const typeLabel = (type) => type.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function MCUploadReport() {
  const { token } = useAuth();
  const [patient, setPatient] = useState(EMPTY_LOOKUP);
  const [form, setForm] = useState({
    report_type: "",
  });
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    const imaging = isDicomFile(file);
    if (!lookupComplete(patient) || (!form.report_type && !imaging) || !file) {
      setError("All fields are required: the patient (email, or CNIC and date of birth), report type and file.");
      return;
    }
    if (imaging && file.size > IMAGING_MAX_MB * 1024 * 1024) {
      setError(`Imaging studies must be under ${IMAGING_MAX_MB}MB.`);
      return;
    }

    setUploading(true);
    setError("");
    setSuccess("");

    try {
      const formData = new FormData();
      Object.entries(lookupPayload(patient)).forEach(([key, value]) => formData.append(key, value));
      if (!imaging) formData.append("report_type", form.report_type);
      formData.append("file", file);

      if (imaging) {
        await uploadPatientImaging(token, formData);
        setSuccess(
          "Imaging study uploaded. It is being encrypted and processed; the patient will be notified to approve it once it's ready."
        );
      } else {
        await uploadPatientReport(token, formData);
        setSuccess(
          "Report uploaded successfully. The patient has been notified and must approve it before it appears in their record."
        );
      }
      setForm({ report_type: "" });
      setPatient(EMPTY_LOOKUP);
      setFile(null);
      document.getElementById("file-input").value = "";
    } catch (e) {
      setError(e?.response?.data?.detail || "Upload failed. Please try again.");
    }

    setUploading(false);
  };

  const formatSize = (bytes) => {
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Upload a <em>report</em>
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Upload a diagnostic report to a patient's profile. The file is encrypted with AES 256 before storage.
      </p>

      <div className="card card-pad mt-8">
        <div className="space-y-6">
          <PatientLookupFields idPrefix="upload-patient" value={patient} onChange={setPatient} />

          {/* Report type (imaging studies carry their own scan type) */}
          {isDicomFile(file) ? (
            <div className="rounded-xl bg-brand-subtle p-3.5 text-sm text-brand-strong">
              DICOM imaging study detected. The scan type, date and series are read from the files.
            </div>
          ) : (
            <div>
              <label htmlFor="report-type" className="field-label">Report type</label>
              <select
                id="report-type"
                value={form.report_type}
                onChange={(e) => setForm({ ...form, report_type: e.target.value })}
                className="field"
              >
                <option value="">Select report type</option>
                {MC_REPORT_TYPES.map((type) => (
                  <option key={type} value={type}>{typeLabel(type)}</option>
                ))}
              </select>
            </div>
          )}

          {/* File */}
          <div>
            <span className="field-label" id="file-label">Report file</span>
            <input
              id="file-input"
              type="file"
              accept={FILE_INPUT_ACCEPT}
              onChange={(e) => setFile(e.target.files[0])}
              className="sr-only peer"
              aria-labelledby="file-label"
              aria-describedby="file-hint"
            />
            <label
              htmlFor="file-input"
              className="block cursor-pointer rounded-card border-2 border-dashed border-line-strong p-8 text-center transition-colors hover:bg-inset peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand"
            >
              {file ? (
                <span className="flex flex-wrap items-center justify-center gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                    <FileText aria-hidden="true" size={20} />
                  </span>
                  <span className="min-w-0 text-left">
                    <span className="block max-w-[16rem] truncate text-sm font-bold text-ink">{file.name}</span>
                    <span className="block text-sm text-muted">{formatSize(file.size)}</span>
                  </span>
                </span>
              ) : (
                <>
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-brand">
                    <Upload aria-hidden="true" size={22} />
                  </span>
                  <span className="mt-3 block text-sm font-bold text-ink">
                    Click to <span className="text-brand underline underline-offset-2">choose a file</span>
                  </span>
                </>
              )}
            </label>
            {file && (
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  document.getElementById("file-input").value = "";
                }}
                className="btn btn-ghost btn-sm mt-2"
              >
                <X aria-hidden="true" size={16} />
                Remove file
              </button>
            )}
            <p id="file-hint" className="field-hint mt-2">
              {STANDARD_TYPES_LABEL}, up to {STANDARD_MAX_MB}MB. {IMAGING_TYPES_LABEL}, up to {IMAGING_MAX_MB}MB.
            </p>
          </div>

          {error && (
            <div role="alert" className="rounded-xl bg-bad-subtle p-3.5 text-sm font-semibold text-bad-ink">
              {error}
            </div>
          )}

          {success && (
            <div role="status" className="flex items-start gap-3 rounded-xl bg-ok-subtle p-3.5 text-sm font-semibold text-ok-ink">
              <CheckCircle2 aria-hidden="true" size={18} className="mt-0.5 flex-shrink-0" />
              <span>{success}</span>
            </div>
          )}

          <button type="button" onClick={handleSubmit} disabled={uploading} className="btn btn-primary btn-lg w-full">
            {uploading ? (
              "Uploading..."
            ) : (
              <>
                <ShieldCheck aria-hidden="true" size={20} />
                Encrypt and upload
              </>
            )}
          </button>
        </div>
      </div>

      <div className="card-inset mt-5 p-5">
        <p className="text-sm font-bold text-ink">What happens after upload</p>
        <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm leading-6 text-ink-soft">
          <li>The file is encrypted with AES 256 before storage.</li>
          <li>A SHA 256 fingerprint of the file is recorded on Ethereum Sepolia testnet.</li>
          <li>The patient is notified and can approve or reject the report.</li>
          <li>The report joins their record only after they approve it.</li>
        </ul>
      </div>
    </div>
  );
}

export default MCUploadReport;
