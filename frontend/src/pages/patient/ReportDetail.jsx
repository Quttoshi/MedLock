import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

function VerificationBadge({ status }) {
  const styles = {
    verified: "bg-green-100 text-green-700 border-green-200",
    tampered: "bg-red-100 text-red-700 border-red-200",
    pending: "bg-yellow-100 text-yellow-700 border-yellow-200",
  };
  const labels = {
    verified: "✓ Blockchain Verified",
    tampered: "✗ Integrity Compromised",
    pending: "⏳ Verification Pending",
  };
  return (
    <span className={`text-sm font-semibold px-3 py-1.5 rounded-full 
                      border ${styles[status] || styles.pending}`}>
      {labels[status] || "⏳ Pending"}
    </span>
  );
}


function ReportDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [loading, setLoading] = useState(true);

  // ── Fetch Report + OCR ───────────────────────────────
  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    const fetchAll = async () => {
      try {
        const res = await api.get(`/reports/${id}`, { headers });
        setReport(res.data);
        // fetch OCR separately — may not exist for all reports
        try {
          const ocrRes = await api.get(`/reports/${id}/ocr`, { headers });
          setOcrData(ocrRes.data);
        } catch {
          setOcrData(null);
        }
      } catch {
        setReport(null);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [id, token]);

  // ── Download Report ──────────────────────────────────
  const handleDownload = async () => {
    try {
      const res = await api.get(`/reports/${id}/download`, {
        headers: { Authorization: `Bearer ${token}` },
        responseType: "blob",
      });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", report.original_filename || "report");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch {
      alert("Download failed. Please try again.");
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-PK", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

  // ── Not found ────────────────────────────────────────
  if (!loading && !report) {
    return (
      <div className="max-w-4xl mx-auto text-center py-24">
        <p className="text-gray-400 font-medium text-lg">Report not found.</p>
        <button onClick={() => navigate("/patient/reports")} className="mt-4 text-blue-600 hover:underline text-sm">
          Back to Reports
        </button>
      </div>
    );
  }

  // ── Loading ───────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-blue-500"
          xmlns="http://www.w3.org/2000/svg" fill="none"
          viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10"
            stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">

      {/* Back Button */}
      <button
        onClick={() => navigate("/patient/reports")}
        className="flex items-center gap-2 text-sm text-gray-500 
                   hover:text-gray-700 mb-6 transition"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor"
          viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round"
            strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Reports
      </button>

      {/* Header Card */}
      <div className="bg-white rounded-2xl border border-gray-100 
                      shadow-sm p-6 mb-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-xl font-bold text-gray-800">
              {report.original_filename || report.name}
            </h1>
            <p className="text-sm text-gray-500 mt-1">
              {report.report_type} · Uploaded {formatDate(report.uploaded_at || report.upload_date)}
            </p>
            <p className="text-xs text-gray-400 mt-1 capitalize">
              Source: {report.upload_source?.replace("_", " ")}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <VerificationBadge status={report.verification_status || "pending"} />
            <button
              onClick={handleDownload}
              className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium transition"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              Download Original
            </button>
          </div>
        </div>
      </div>

      {/* Integrity Info */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
          </svg>
          File Integrity
        </h2>
        <div className="bg-gray-50 rounded-xl p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">SHA-256 Hash</p>
          <p className="text-sm font-mono text-gray-700 break-all">{report.file_hash_sha256}</p>
        </div>
        <p className="text-xs text-gray-400 mt-3">
          Blockchain verification will be available once the Ethereum integration is complete.
        </p>
      </div>

      {/* OCR Clinical Data */}
      {ocrData && (
        <div className="bg-white rounded-2xl border border-gray-100
                        shadow-sm p-6 mb-5">
          <h2 className="text-base font-semibold text-gray-700 mb-4
                         flex items-center gap-2">
            <svg className="w-5 h-5 text-green-500" fill="none"
              stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0
                   002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0
                   002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            OCR Extracted Clinical Data
          </h2>

          {/* Abnormal Values Warning */}
          {ocrData.abnormal_values?.length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-100 rounded-xl">
              <p className="text-sm font-semibold text-red-700 mb-2">
                Abnormal Values Detected
              </p>
              <div className="space-y-1">
                {ocrData.abnormal_values.map((val, i) => (
                  <p key={i} className="text-sm text-red-600">
                    <span className="font-semibold capitalize">{val.test}:</span>{" "}
                    {val.value} {val.unit}
                    <span className="ml-2 text-xs text-red-400">
                      (Normal: {val.normal_range})
                    </span>
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Structured Data Table */}
          {ocrData.structured_data?.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Parameter
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Value
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {ocrData.structured_data.map((row, i) => {
                    const isAbnormal = ocrData.abnormal_values?.some(
                      (a) => a.test === row.test
                    );
                    return (
                      <tr key={i} className={isAbnormal ? "bg-red-50" : ""}>
                        <td className="px-4 py-3 font-medium text-gray-700 capitalize">
                          {row.test}
                        </td>
                        <td className={`px-4 py-3 font-semibold ${isAbnormal ? "text-red-600" : "text-gray-800"}`}>
                          {row.value} {row.unit}
                        </td>
                        <td className="px-4 py-3">
                          {isAbnormal ? (
                            <span className="text-xs font-bold text-red-500 bg-red-100 px-2 py-0.5 rounded-full">
                              ABNORMAL
                            </span>
                          ) : (
                            <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-0.5 rounded-full">
                              NORMAL
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ReportDetail;