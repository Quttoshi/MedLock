import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import { downloadReport, getPatientReports } from "../../api/doctor";

function ReportViewer() {
  const { token } = useAuth();
  const { patientId, reportId } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewType, setPreviewType] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState("");

  // ── Fetch report metadata ────────────────────────────
  useEffect(() => {
    getPatientReports(token, patientId)
      .then((res) => {
        const found = res.data.find((r) => r.id === reportId);
        setReport(found || null);
      })
      .catch(() => setReport(null))
      .finally(() => setLoading(false));
  }, [token, patientId, reportId]);

  // ── Load preview ─────────────────────────────────────
  useEffect(() => {
    if (!report) return;
    setPreviewLoading(true);
    downloadReport(token, patientId, reportId)
      .then((res) => {
        const filename = report.original_filename || "";
        let mimeType = "application/octet-stream";
        let type = "unknown";
        if (filename.endsWith(".pdf")) {
          mimeType = "application/pdf";
          type = "pdf";
        } else if (filename.endsWith(".jpg") || filename.endsWith(".jpeg")) {
          mimeType = "image/jpeg";
          type = "image";
        } else if (filename.endsWith(".png")) {
          mimeType = "image/png";
          type = "image";
        } else if (filename.endsWith(".tiff") || filename.endsWith(".tif")) {
          mimeType = "image/tiff";
          type = "image";
        }
        const blob = new Blob([res.data], { type: mimeType });
        const url = window.URL.createObjectURL(blob);
        setPreviewUrl(url);
        setPreviewType(type);
      })
      .catch(() => {
        setError("Could not load preview. You can still download the file.");
        setPreviewType("unknown");
      })
      .finally(() => setPreviewLoading(false));

    // Cleanup blob URL on unmount
    return () => {
      if (previewUrl) window.URL.revokeObjectURL(previewUrl);
    };
  }, [report]);

  // ── Download ─────────────────────────────────────────
  const handleDownload = async () => {
    setDownloading(true);
    try {
      const res = await downloadReport(token, patientId, reportId);
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = report?.original_filename || "report";
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    }
    setDownloading(false);
  };

  const formatDate = (dateStr) =>
    dateStr
      ? new Date(dateStr).toLocaleDateString("en-PK", {
          day: "numeric",
          month: "long",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "—";

  // ── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-green-500"
          xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  // ── Not found ─────────────────────────────────────────
  if (!report) {
    return (
      <div className="max-w-4xl mx-auto text-center py-24">
        <p className="text-gray-400 font-medium text-lg">Report not found.</p>
        <button
          onClick={() => navigate(`/doctor/patients/${patientId}/reports`)}
          className="mt-4 text-green-600 hover:underline text-sm"
        >
          Back to Reports
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto">

      {/* Back Button */}
      <button
        onClick={() => navigate(`/doctor/patients/${patientId}/reports`)}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 mb-6 transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Reports
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {report.original_filename || "Medical Report"}
            </h1>
            <p className="text-sm text-gray-500 mt-1 capitalize">
              {report.report_type?.replace(/_/g, " ") || "Report"} · Uploaded {formatDate(report.created_at)}
            </p>
            <p className="text-xs text-gray-400 mt-1 capitalize">
              Source: {report.upload_source?.replace("_", " ") || "—"}
            </p>
          </div>

          {/* Download Button */}
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            {downloading ? "Downloading..." : "Download Report"}
          </button>
        </div>

        {/* Report Metadata */}
        <div className="mt-5 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Report Type
            </p>
            <p className="text-sm font-medium text-gray-700 capitalize">
              {report.report_type?.replace(/_/g, " ") || "—"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              Upload Source
            </p>
            <p className="text-sm font-medium text-gray-700 capitalize">
              {report.upload_source?.replace("_", " ") || "—"}
            </p>
          </div>
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">
              SHA-256 Hash
            </p>
            <p className="text-xs font-mono text-gray-600 break-all">
              {report.file_hash_sha256
                ? `${report.file_hash_sha256.slice(0, 20)}...`
                : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* Preview Card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          Report Preview
        </h2>

        {/* Error */}
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
            {error}
          </div>
        )}

        {/* Preview Loading */}
        {previewLoading && (
          <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl">
            <div className="text-center">
              <svg className="animate-spin h-8 w-8 text-green-500 mx-auto mb-2"
                xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
              </svg>
              <p className="text-sm text-gray-400">Loading preview...</p>
            </div>
          </div>
        )}

        {/* PDF Preview */}
        {!previewLoading && previewType === "pdf" && previewUrl && (
          <div className="rounded-xl overflow-hidden border border-gray-100">
            <iframe
              src={previewUrl}
              title="Report Preview"
              className="w-full"
              style={{ height: "700px" }}
            />
          </div>
        )}

        {/* Image Preview */}
        {!previewLoading && previewType === "image" && previewUrl && (
          <div className="flex items-center justify-center bg-gray-50 rounded-xl p-4">
            <img
              src={previewUrl}
              alt="Report"
              className="max-w-full max-h-[700px] rounded-xl shadow-sm object-contain"
            />
          </div>
        )}

        {/* Unknown / Unsupported */}
        {!previewLoading && previewType === "unknown" && (
          <div className="flex flex-col items-center justify-center h-64 bg-gray-50 rounded-xl">
            <div className="w-14 h-14 bg-gray-100 rounded-2xl flex items-center justify-center mb-3">
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <p className="text-gray-500 text-sm font-medium">Preview not available</p>
            <p className="text-gray-400 text-xs mt-1 mb-4">
              This file type cannot be previewed in the browser.
            </p>
            <button
              onClick={handleDownload}
              disabled={downloading}
              className="px-4 py-2 bg-green-600 text-white text-sm rounded-xl hover:bg-green-700 transition disabled:opacity-50"
            >
              {downloading ? "Downloading..." : "Download to View"}
            </button>
          </div>
        )}
      </div>

      {/* Security Notice */}
      <div className="mt-4 bg-green-50 border border-green-100 rounded-2xl p-4 flex gap-3 items-start">
        <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <div>
          <p className="text-sm font-semibold text-green-800">Encrypted Access</p>
          <p className="text-xs text-green-600 mt-0.5">
            This report was decrypted on-the-fly using the patient's encryption key.
            Your access to this record is logged on the Ethereum blockchain and
            can be revoked by the patient at any time.
          </p>
        </div>
      </div>

    </div>
  );
}

export default ReportViewer;