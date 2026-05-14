import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

function BlockchainBadge({ logs }) {
  if (!logs || logs.length === 0) return null;

  const confirmed = logs.some((l) => l.status === "confirmed");
  const pending = logs.some((l) => l.status === "pending");

  if (confirmed) return (
    <span className="text-sm font-semibold px-3 py-1.5 rounded-full border bg-green-100 text-green-700 border-green-200">
      ✓ Blockchain Verified
    </span>
  );
  if (pending) return (
    <span className="text-sm font-semibold px-3 py-1.5 rounded-full border bg-yellow-100 text-yellow-700 border-yellow-200">
      ⏳ Blockchain Pending
    </span>
  );
  return (
    <span className="text-sm font-semibold px-3 py-1.5 rounded-full border bg-gray-100 text-gray-600 border-gray-200">
      — Not on Chain
    </span>
  );
}

function ReportDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [ocrData, setOcrData] = useState(null);
  const [blockchainLogs, setBlockchainLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const abnormalRows = ocrData?.abnormal_values || [];

  // ── Fetch Report + OCR + Blockchain ──────────────────
  useEffect(() => {
    const headers = { Authorization: `Bearer ${token}` };
    const fetchAll = async () => {
      try {
        const res = await api.get(`/reports/${id}`, { headers });
        setReport(res.data);
        try {
          const ocrRes = await api.get(`/reports/${id}/ocr`, { headers });
          setOcrData(ocrRes.data);
        } catch {
          setOcrData(null);
        }
        try {
          const chainRes = await api.get(`/reports/${id}/blockchain`, { headers });
          let logs = chainRes.data;
          // Auto-confirm any pending transactions
          if (logs.some((l) => l.status === "pending")) {
            try {
              await api.post(`/reports/${id}/blockchain/confirm`, {}, { headers });
              const refreshed = await api.get(`/reports/${id}/blockchain`, { headers });
              logs = refreshed.data;
            } catch {}
          }
          setBlockchainLogs(logs);
        } catch {
          setBlockchainLogs([]);
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
            <BlockchainBadge logs={blockchainLogs} />
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
        {blockchainLogs.length > 0 && (
          <div className="mt-3 space-y-2">
            {blockchainLogs.map((log) => (
              <div key={log.id} className="flex items-center justify-between text-xs text-gray-500 bg-gray-50 rounded-xl px-4 py-2">
                <span className="capitalize font-medium">{log.event_type?.replace("_", " ")}</span>
                <span className={`font-semibold ${log.status === "confirmed" ? "text-green-600" : "text-yellow-600"}`}>
                  {log.status}
                </span>
                {log.transaction_hash && (
                  <a
                    href={`https://sepolia.etherscan.io/tx/${log.transaction_hash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-500 hover:underline"
                  >
                    View on Etherscan →
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Extracted Report Data */}
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
            Extracted Report Data
          </h2>

          {/* Abnormal Evidence Table */}
          {abnormalRows.length > 0 && (
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
                      Report Reference
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">
                      Source Evidence
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {abnormalRows.map((row, i) => (
                    <tr key={i}>
                      <td className="px-4 py-3 font-medium text-gray-700 capitalize">
                        {row.test}
                      </td>
                      <td className="px-4 py-3 font-semibold text-red-600">
                        {row.value} {row.unit}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        <p>{row.normal_range || "-"}</p>
                        {row.reference_text && (
                          <p className="mt-1 text-[11px] text-gray-400">
                            {row.reference_text}
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500">
                        {row.source_text ? (
                          <details>
                            <summary className="cursor-pointer font-medium text-gray-500">
                              OCR line
                            </summary>
                            <p className="mt-2 max-w-xs whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-gray-500">
                              {row.source_text}
                            </p>
                          </details>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {ocrData.structured_data?.length > 0 && abnormalRows.length === 0 && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-4 text-sm text-gray-600">
              No abnormal values were identified from report-provided flags or reference ranges.
            </div>
          )}

          {ocrData.structured_data?.length === 0 && (
            <div className="rounded-xl border border-yellow-100 bg-yellow-50 p-4 text-sm text-yellow-800">
              Text was extracted, but no report-evidence abnormal lab values matched the current parser.
            </div>
          )}

          <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50 p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
              Extraction Details
            </p>
            <p className="text-xs text-gray-500">
              Engine: {ocrData.ocr_engine || "unknown"} · Parser: {ocrData.parser_version || "unknown"} · Parsed rows: {ocrData.structured_count ?? ocrData.structured_data?.length ?? 0}
            </p>
            {ocrData.error_message && (
              <p className="text-xs text-red-500 mt-2">{ocrData.error_message}</p>
            )}
            {ocrData.extracted_text && (
              <pre className="mt-3 max-h-56 overflow-auto whitespace-pre-wrap text-xs text-gray-600 font-mono">
                {ocrData.extracted_text}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default ReportDetail;
