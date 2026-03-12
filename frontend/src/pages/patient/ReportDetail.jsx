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

// ── Sample detail data ───────────────────────────────
const SAMPLE_DETAIL = {
  id: 1,
  name: "Blood_Test_Jan2025.pdf",
  report_type: "Blood Test",
  upload_date: "2025-01-15T10:30:00Z",
  upload_source: "patient",
  verification_status: "verified",
  tx_hash:
    "0xabc123def456abc123def456abc123def456abc123def456abc123def456abc1",
  block_number: 19482031,
  ocr_data: {
    extracted_text:
      "Complete Blood Count Report\nPatient: John Doe\nDate: 15 Jan 2025",
    structured_data: {
      Hemoglobin: { value: "13.5", unit: "g/dL", normal: "13.0-17.0" },
      WBC: { value: "7.2", unit: "K/uL", normal: "4.5-11.0" },
      Platelets: { value: "210", unit: "K/uL", normal: "150-400" },
      RBC: { value: "4.1", unit: "M/uL", normal: "4.5-5.9" },
      Hematocrit: { value: "41", unit: "%", normal: "41-53" },
    },
    abnormal_values: {
      RBC: { value: "4.1", unit: "M/uL", normal: "4.5-5.9", flag: "LOW" },
    },
  },
};

function ReportDetail() {
  const { id } = useParams();
  const { token } = useAuth();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  // ── Fetch Report ─────────────────────────────────────
  useEffect(() => {
    const fetchReport = async () => {
      try {
        const res = await api.get(`/reports/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        setReport(res.data);
      } catch {
        setReport(SAMPLE_DETAIL);
      } finally {
        setLoading(false);
      }
    };
    fetchReport();
  }, [id, token]);

  // ── Verify Integrity ─────────────────────────────────
  const handleVerify = async () => {
    setVerifying(true);
    setVerifyResult(null);
    try {
      const res = await api.get(`/reports/${id}/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setVerifyResult({ success: true, message: res.data.message });
    } catch {
      setVerifyResult({
        success: false,
        message: "Verification failed. Could not connect to blockchain.",
      });
    } finally {
      setVerifying(false);
    }
  };

  const formatDate = (dateStr) =>
    new Date(dateStr).toLocaleDateString("en-PK", {
      day: "numeric", month: "long", year: "numeric",
      hour: "2-digit", minute: "2-digit",
    });

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
            <h1 className="text-xl font-bold text-gray-800">{report.name}</h1>
            <p className="text-sm text-gray-500 mt-1">
              {report.report_type} · Uploaded {formatDate(report.upload_date)}
            </p>
            <p className="text-xs text-gray-400 mt-1 capitalize">
              Source: {report.upload_source?.replace("_", " ")}
            </p>
          </div>
          <VerificationBadge status={report.verification_status} />
        </div>
      </div>

      {/* Blockchain Info */}
      <div className="bg-white rounded-2xl border border-gray-100 
                      shadow-sm p-6 mb-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4 
                       flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-500" fill="none"
            stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              strokeWidth={2}
              d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 
                 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" />
          </svg>
          Blockchain Record
        </h2>

        <div className="space-y-3">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-xs font-semibold text-gray-400 uppercase 
                          tracking-wide mb-1">
              Transaction Hash
            </p>
            <p className="text-sm font-mono text-gray-700 break-all">
              {report.tx_hash}
            </p>
          </div>

          {report.block_number && (
            <div className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs font-semibold text-gray-400 uppercase 
                            tracking-wide mb-1">
                Block Number
              </p>
              <p className="text-sm font-mono text-gray-700">
                {report.block_number.toLocaleString()}
              </p>
            </div>
          )}
        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          disabled={verifying}
          className="mt-4 flex items-center gap-2 bg-blue-600 
                     hover:bg-blue-700 text-white text-sm font-semibold 
                     px-5 py-2.5 rounded-xl transition 
                     disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {verifying ? (
            <>
              <svg className="animate-spin h-4 w-4" fill="none"
                viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10"
                  stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor"
                  d="M4 12a8 8 0 018-8v8z" />
              </svg>
              Verifying...
            </>
          ) : (
            <>
              <svg className="w-4 h-4" fill="none" stroke="currentColor"
                viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 
                     0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 
                     12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 
                     5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052
                     -.382-3.016z" />
              </svg>
              Verify Integrity on Blockchain
            </>
          )}
        </button>

        {/* Verify Result */}
        {verifyResult && (
          <div className={`mt-3 p-3 rounded-xl text-sm font-medium
                          ${verifyResult.success
                            ? "bg-green-50 text-green-700"
                            : "bg-red-50 text-red-600"
                          }`}>
            {verifyResult.message}
          </div>
        )}
      </div>

      {/* OCR Clinical Data */}
      {report.ocr_data && (
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
          {Object.keys(report.ocr_data.abnormal_values || {}).length > 0 && (
            <div className="mb-4 p-4 bg-red-50 border border-red-100 
                            rounded-xl">
              <p className="text-sm font-semibold text-red-700 mb-2">
                ⚠ Abnormal Values Detected
              </p>
              <div className="space-y-1">
                {Object.entries(report.ocr_data.abnormal_values).map(
                  ([key, val]) => (
                    <p key={key} className="text-sm text-red-600">
                      <span className="font-semibold">{key}:</span>{" "}
                      {val.value} {val.unit}
                      <span className="ml-2 text-xs bg-red-100 px-2 py-0.5 
                                       rounded-full font-bold">
                        {val.flag}
                      </span>
                      <span className="ml-2 text-xs text-red-400">
                        (Normal: {val.normal})
                      </span>
                    </p>
                  )
                )}
              </div>
            </div>
          )}

          {/* Structured Data Table */}
          {report.ocr_data.structured_data && (
            <div className="overflow-x-auto rounded-xl border 
                            border-gray-100">
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold 
                                   text-gray-500 uppercase tracking-wide">
                      Parameter
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold 
                                   text-gray-500 uppercase tracking-wide">
                      Value
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold 
                                   text-gray-500 uppercase tracking-wide">
                      Normal Range
                    </th>
                    <th className="text-left px-4 py-3 text-xs font-semibold 
                                   text-gray-500 uppercase tracking-wide">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {Object.entries(report.ocr_data.structured_data).map(
                    ([key, val]) => {
                      const isAbnormal =
                        report.ocr_data.abnormal_values?.[key];
                      return (
                        <tr key={key}
                          className={isAbnormal ? "bg-red-50" : ""}>
                          <td className="px-4 py-3 font-medium text-gray-700">
                            {key}
                          </td>
                          <td className={`px-4 py-3 font-semibold
                                         ${isAbnormal
                                           ? "text-red-600"
                                           : "text-gray-800"
                                         }`}>
                            {val.value} {val.unit}
                          </td>
                          <td className="px-4 py-3 text-gray-400 text-xs">
                            {val.normal} {val.unit}
                          </td>
                          <td className="px-4 py-3">
                            {isAbnormal ? (
                              <span className="text-xs font-bold text-red-500 
                                               bg-red-100 px-2 py-0.5 
                                               rounded-full">
                                {isAbnormal.flag}
                              </span>
                            ) : (
                              <span className="text-xs font-bold 
                                               text-green-600 bg-green-50 
                                               px-2 py-0.5 rounded-full">
                                NORMAL
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    }
                  )}
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