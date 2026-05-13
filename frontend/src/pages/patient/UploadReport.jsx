import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

const REPORT_TYPES = [
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
    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
      "image/tiff",
    ];
    const maxSize = 10 * 1024 * 1024;

    if (!allowedTypes.includes(selectedFile.type)) {
      return "Only PDF, JPEG, PNG, and TIFF files are allowed.";
    }
    if (selectedFile.size > maxSize) {
      return "File size must be under 10MB.";
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
    if (!reportType) newErrors.reportType = "Please select a report type.";
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

    const formData = new FormData();
    formData.append("file", file);
    formData.append("report_type", reportType);

    try {
      const response = await api.post("/reports/upload", formData, {
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
      if (err.response?.status === 415) {
        setServerError("File type not supported by the server.");
      } else if (err.response?.status === 413) {
        setServerError("File is too large. Maximum size is 50MB.");
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
    <div className="max-w-2xl mx-auto">

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Upload Report</h1>
        <p className="text-gray-500 text-sm mt-1">
          Your file will be encrypted with AES-256 and logged on the
          Ethereum blockchain automatically.
        </p>
      </div>

      {/* Upload Success Card */}
      {uploadResult && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-2xl p-5">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-green-600" fill="none"
                stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="font-semibold text-green-800">Upload Successful</p>
              <p className="text-sm text-green-600">
                Your report has been encrypted and recorded on the blockchain.
              </p>
            </div>
          </div>

          {/* TX Hash */}
          <div className="bg-white rounded-xl p-4 border border-green-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Blockchain Transaction Hash
            </p>
            <p className="text-sm font-mono text-gray-800 break-all">
              {uploadResult.tx_hash}
            </p>
          </div>

          {/* Block Number */}
          {uploadResult.block_number && (
            <div className="mt-3 bg-white rounded-xl p-4 border border-green-100">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                Block Number
              </p>
              <p className="text-sm font-mono text-gray-800">
                {uploadResult.block_number}
              </p>
            </div>
          )}

          <button
            onClick={() => setUploadResult(null)}
            className="mt-4 text-sm text-green-700 hover:underline"
          >
            Upload another report
          </button>
        </div>
      )}

      {/* Upload Form */}
      {!uploadResult && (
        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6"
        >

          {/* Server Error */}
          {serverError && (
            <div className="mb-5 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
              {serverError}
            </div>
          )}

          {/* Drop Zone */}
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Medical Report File
            </label>

            <div
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
              onClick={() => document.getElementById("fileInput").click()}
              className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${dragOver ? "border-blue-400 bg-blue-50" : errors.file ? "border-red-300 bg-red-50" : "border-gray-200 hover:border-blue-300 hover:bg-gray-50"}`}
            >
              <input
                id="fileInput"
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.docx,.doc"
                onChange={(e) => {
                  if (e.target.files[0]) handleFileSelect(e.target.files[0]);
                }}
              />

              {file ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-600" fill="none"
                      stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-medium text-gray-800 truncate max-w-xs">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatSize(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setFile(null);
                    }}
                    className="ml-2 text-gray-400 hover:text-red-500 transition"
                  >
                    <svg className="w-5 h-5" fill="none"
                      stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg className="w-10 h-10 text-gray-300 mx-auto mb-3"
                    fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                  <p className="text-sm font-medium text-gray-600">
                    Drag and drop your file here, or{" "}
                    <span className="text-blue-600">browse</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PDF, JPEG, PNG, TIFF — max 10MB
                  </p>
                </>
              )}
            </div>

            {errors.file && (
              <p className="text-red-500 text-xs mt-1">{errors.file}</p>
            )}
          </div>

          {/* Report Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Report Type
            </label>
            <select
              value={reportType}
              onChange={(e) => {
                setReportType(e.target.value);
                setErrors({ ...errors, reportType: "" });
              }}
              className={`w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white transition ${errors.reportType ? "border-red-400" : "border-gray-300"}`}
            >
              <option value="">Select report type...</option>
              {REPORT_TYPES.map((type) => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
            {errors.reportType && (
              <p className="text-red-500 text-xs mt-1">{errors.reportType}</p>
            )}
          </div>

          {/* Progress Bar */}
          {uploading && (
            <div className="mb-5">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Uploading and encrypting...</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <p className="text-xs text-gray-400 mt-2">
                Please wait — encrypting with AES-256 and recording on blockchain...
              </p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={uploading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {uploading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white"
                  xmlns="http://www.w3.org/2000/svg" fill="none"
                  viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10"
                    stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor"
                    d="M4 12a8 8 0 018-8v8z" />
                </svg>
                Uploading...
              </>
            ) : (
              <>
                <svg className="w-5 h-5" fill="none" stroke="currentColor"
                  viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round"
                    strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload and Encrypt Report
              </>
            )}
          </button>

        </form>
      )}
    </div>
  );
}

export default UploadReport;