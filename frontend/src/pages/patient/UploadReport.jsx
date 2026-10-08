import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { Upload, FileText, X, CheckCircle2, ShieldCheck } from "lucide-react";
import api from "../../api/axios";
import {
  STANDARD_MAX_MB,
  STANDARD_MIME_TYPES,
  STANDARD_TYPES_LABEL,
  IMAGING_MAX_MB,
  IMAGING_NAME_PATTERN,
  IMAGING_TYPES_LABEL,
  FILE_INPUT_ACCEPT,
  REPORT_TYPES,
} from "../../constants/upload";

const isDicomFile = (f) => Boolean(f) && IMAGING_NAME_PATTERN.test(f.name);

function UploadReport() {
  const { token } = useAuth();

  const [file, setFile] = useState(null);
  const [reportType, setReportType] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState("");
  const [uploadResult, setUploadResult] = useState(null);

  // ── File Validation ──────────────────────────────────
  const validateFile = (selectedFile) => {
    if (isDicomFile(selectedFile)) {
      return selectedFile.size > IMAGING_MAX_MB * 1024 * 1024
        ? `Imaging studies must be under ${IMAGING_MAX_MB}MB.`
        : null;
    }
    const maxSize = STANDARD_MAX_MB * 1024 * 1024;

    if (!STANDARD_MIME_TYPES.includes(selectedFile.type)) {
      return `Only ${STANDARD_TYPES_LABEL} files are allowed.`;
    }
    if (selectedFile.size > maxSize) {
      return `File size must be under ${STANDARD_MAX_MB}MB.`;
    }
    return null;
  };

  // ── Handle File Select ───────────────────────────────
  const handleFileSelect = (selectedFile) => {
    const error = validateFile(selectedFile);
    if (error) {
      setErrors({ ...errors, file: error });
      setFile(null);
      return;
    }
    setFile(selectedFile);
    setErrors({ ...errors, file: "" });
    setUploadResult(null);
  };

  // ── Drag and Drop ────────────────────────────────────
  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped) handleFileSelect(dropped);
  };

  // ── Form Validation ──────────────────────────────────
  const validate = () => {
    const newErrors = {};
    if (!file) newErrors.file = "Please select a file to upload.";
    if (!reportType && !isDicomFile(file)) newErrors.reportType = "Please select a report type.";
    return newErrors;
  };

  // ── Handle Submit ────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    setUploading(true);
    setProgress(0);
    setServerError("");

    const imaging = isDicomFile(file);
    const formData = new FormData();
    formData.append("file", file);
    if (!imaging) formData.append("report_type", reportType);

    try {
      const response = await api.post(imaging ? "/reports/imaging/upload" : "/reports/upload", formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "multipart/form-data",
        },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round(
            (progressEvent.loaded * 100) / progressEvent.total
          );
          setProgress(percent);
        },
      });
      setUploadResult(response.data);
      setFile(null);
      setReportType("");
      setProgress(0);
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (detail) {
        setServerError(detail);
      } else if (err.response?.status === 413) {
        setServerError(`File is too large. Maximum size is ${STANDARD_MAX_MB}MB.`);
      } else {
        setServerError("Upload failed. Please check your connection and try again.");
      }
    } finally {
      setUploading(false);
    }
  };

  // ── Format file size ─────────────────────────────────
  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="mx-auto max-w-2xl">

      {/* Header */}
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Add a <em>record</em>
      </h1>
      <p className="mt-3 text-sm leading-6 text-muted">
        Your file is encrypted with AES 256 before storage, and its fingerprint is recorded on Ethereum Sepolia testnet.
      </p>

      {/* Upload Success */}
      {uploadResult && (
        <section className="card card-pad mt-8" role="status">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-ok-subtle text-ok-ink">
              <CheckCircle2 aria-hidden="true" size={22} />
            </span>
            <div>
              <h2 className="display text-xl text-ink">Upload complete</h2>
              <p className="mt-1 text-sm leading-6 text-ink-soft">
                {uploadResult.report_type === "imaging"
                  ? `Your imaging study (${uploadResult.instance_count} files) is being encrypted and processed. You'll get a notification when it's ready.`
                  : "Your report has been encrypted and its fingerprint recorded on Ethereum Sepolia testnet."}
              </p>
            </div>
          </div>

          {uploadResult.report_type === "imaging" && (
            <Link to={`/patient/reports/${uploadResult.id}`} className="link mt-4 inline-block text-sm">
              View study
            </Link>
          )}

          {uploadResult.tx_hash && (
            <div className="card-inset mt-5 p-4">
              <p className="eyebrow mb-1.5">Blockchain transaction hash</p>
              <p className="hash !text-ink-soft">{uploadResult.tx_hash}</p>
            </div>
          )}

          {uploadResult.block_number && (
            <div className="card-inset mt-3 p-4">
              <p className="eyebrow mb-1.5">Block number</p>
              <p className="hash !text-ink-soft">{uploadResult.block_number}</p>
            </div>
          )}

          <button type="button" onClick={() => setUploadResult(null)} className="btn btn-secondary mt-5">
            Add another record
          </button>
        </section>
      )}

      {/* Upload Form */}
      {!uploadResult && (
        <form onSubmit={handleSubmit} className="card card-pad mt-8" noValidate>

          {serverError && (
            <div role="alert" className="mb-5 rounded-xl bg-bad-subtle p-3.5 text-sm font-semibold text-bad-ink">
              {serverError}
            </div>
          )}

          {/* Drop Zone */}
          <div className="mb-6">
            <span className="field-label" id="file-label">Medical report file</span>

            <div
              role="button"
              tabIndex={0}
              aria-labelledby="file-label"
              aria-describedby={errors.file ? "file-error" : "file-hint"}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("fileInput").click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  document.getElementById("fileInput").click();
                }
              }}
              className={`cursor-pointer rounded-card border-2 border-dashed p-8 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                dragOver
                  ? "border-brand bg-brand-subtle"
                  : errors.file
                    ? "border-bad bg-bad-subtle"
                    : "border-line-strong hover:bg-inset"
              }`}
            >
              <input
                id="fileInput"
                type="file"
                tabIndex={-1}
                className="hidden"
                accept={FILE_INPUT_ACCEPT}
                onChange={(e) => {
                  if (e.target.files[0]) handleFileSelect(e.target.files[0]);
                }}
              />

              {file ? (
                <div className="flex flex-wrap items-center justify-center gap-3">
                  <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                    <FileText aria-hidden="true" size={20} />
                  </span>
                  <div className="min-w-0 text-left">
                    <p className="max-w-[16rem] truncate text-sm font-bold text-ink">{file.name}</p>
                    <p className="text-sm text-muted">{formatSize(file.size)}</p>
                  </div>
                  <button
                    type="button"
                    aria-label="Remove file"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-muted transition-colors hover:bg-bad-subtle hover:text-bad-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <X aria-hidden="true" size={18} />
                  </button>
                </div>
              ) : (
                <>
                  <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-surface text-brand">
                    <Upload aria-hidden="true" size={22} />
                  </span>
                  <p className="mt-3 text-sm font-bold text-ink">
                    Drag your file here, or <span className="text-brand underline underline-offset-2">browse</span>
                  </p>
                  <p id="file-hint" className="mt-1 text-sm leading-5 text-muted">
                    {STANDARD_TYPES_LABEL}, up to {STANDARD_MAX_MB}MB. {IMAGING_TYPES_LABEL}, up to {IMAGING_MAX_MB}MB.
                  </p>
                </>
              )}
            </div>

            {errors.file && <p id="file-error" className="field-error">{errors.file}</p>}
          </div>

          {/* Report Type (imaging studies carry their own scan type) */}
          {isDicomFile(file) ? (
            <div className="mb-6 rounded-xl bg-brand-subtle p-3.5 text-sm text-brand-strong">
              DICOM imaging study detected. The scan type, date and series are read from the files.
            </div>
          ) : (
            <div className="mb-6">
              <label className="field-label" htmlFor="reportType">Report type</label>
              <select
                id="reportType"
                value={reportType}
                aria-invalid={errors.reportType ? "true" : undefined}
                onChange={(e) => {
                  setReportType(e.target.value);
                  setErrors({ ...errors, reportType: "" });
                }}
                className="field"
              >
                <option value="">Select report type</option>
                {REPORT_TYPES.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {errors.reportType && <p className="field-error">{errors.reportType}</p>}
            </div>
          )}

          {/* Progress */}
          {uploading && (
            <div className="mb-6" role="status">
              <div className="mb-1.5 flex justify-between text-sm text-muted">
                <span>Uploading and encrypting</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-inset">
                <div className="h-2 rounded-full bg-brand transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
              <p className="mt-2 text-sm text-muted">
                Please wait. Encrypting with AES 256 and recording the fingerprint on Sepolia testnet.
              </p>
            </div>
          )}

          <button type="submit" disabled={uploading} className="btn btn-primary btn-lg w-full">
            {uploading ? (
              "Uploading..."
            ) : (
              <>
                <ShieldCheck aria-hidden="true" size={20} />
                Encrypt and upload
              </>
            )}
          </button>
        </form>
      )}
    </div>
  );
}

export default UploadReport;
