import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

// ── Status Badge ─────────────────────────────────────
function VerificationBadge({ status }) {
  const styles = {
    verified: "bg-green-100 text-green-700",
    tampered: "bg-red-100 text-red-700",
    pending: "bg-yellow-100 text-yellow-700",
  };
  const labels = {
    verified: "✓ Verified",
    tampered: "✗ Tampered",
    pending: "⏳ Pending",
  };
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-full 
                      ${styles[status] || styles.pending}`}>
      {labels[status] || "⏳ Pending"}
    </span>
  );
}


function MyReports() {
  const { token } = useAuth();
  const navigate = useNavigate();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");

  // ── Fetch Reports ────────────────────────────────────
  useEffect(() => {
    const fetchReports = async () => {
      try {
        const res = await api.get("/reports/my", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setReports(res.data);
      } catch {
        setReports([]);
      } finally {
        setLoading(false);
      }
    };
    fetchReports();
  }, [token]);

  // ── Filter + Search ──────────────────────────────────
  const reportTypes = ["All", ...new Set(reports.map((r) => r.report_type))];

  const filtered = reports.filter((r) => {
    const name = r.original_filename || r.name || "";
    const matchesSearch =
      name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      r.report_type.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === "All" || r.report_type === filterType;
    return matchesSearch && matchesType;
  });

  // ── Format Date ──────────────────────────────────────
  const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString("en-PK", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  // ── Truncate Hash ────────────────────────────────────
  const truncateHash = (hash) => {
    if (!hash) return "";
    return hash.slice(0, 10) + "..." + hash.slice(-8);
  };

  // ── Render ───────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">My Reports</h1>
          <p className="text-gray-500 text-sm mt-1">
            {reports.length} report{reports.length !== 1 ? "s" : ""} uploaded
          </p>
        </div>
        <button
          onClick={() => navigate("/patient/upload")}
          className="bg-blue-600 hover:bg-blue-700 text-white text-sm 
                     font-semibold px-4 py-2.5 rounded-xl transition 
                     flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor"
            viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Upload New
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <svg className="w-4 h-4 absolute left-3 top-3 text-gray-400"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search reports..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2.5 border border-gray-200 
                       rounded-xl text-sm focus:outline-none 
                       focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="px-4 py-2.5 border border-gray-200 rounded-xl 
                     text-sm focus:outline-none focus:ring-2 
                     focus:ring-blue-500 bg-white"
        >
          {reportTypes.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex items-center justify-center h-48">
          <svg className="animate-spin h-8 w-8 text-blue-500"
            xmlns="http://www.w3.org/2000/svg" fill="none"
            viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10"
              stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor"
              d="M4 12a8 8 0 018-8v8z" />
          </svg>
        </div>
      )}

      {/* Empty State */}
      {!loading && filtered.length === 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 
                        p-12 text-center shadow-sm">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-4"
            fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round"
              strokeWidth={2}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 
                 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 
                 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-400 font-medium">No reports found</p>
          <p className="text-gray-300 text-sm mt-1">
            {searchQuery
              ? "Try a different search term"
              : "Upload your first report to get started"}
          </p>
        </div>
      )}

      {/* Reports List */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((report) => (
            <div
              key={report.id}
              onClick={() => navigate(`/patient/reports/${report.id}`)}
              className="bg-white rounded-2xl border border-gray-100 p-5 
                         shadow-sm hover:shadow-md hover:border-blue-100 
                         cursor-pointer transition-all"
            >
              <div className="flex items-start justify-between gap-4">

                {/* File Icon + Info */}
                <div className="flex items-start gap-4 flex-1 min-w-0">
                  <div className="w-11 h-11 bg-blue-50 rounded-xl flex 
                                  items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-blue-500" fill="none"
                      stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round"
                        strokeWidth={2}
                        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 
                           00-.293-.707l-5.414-5.414A1 1 0 
                           0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 
                                  truncate">
                      {report.original_filename || report.name}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {report.report_type} · {formatDate(report.uploaded_at || report.upload_date)}
                    </p>

                    <p className="text-xs font-mono text-gray-300 mt-1.5">
                      SHA-256: {report.file_hash_sha256?.slice(0, 16)}…
                    </p>
                  </div>
                </div>

                {/* Arrow */}
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <svg className="w-4 h-4 text-gray-300" fill="none"
                    stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round"
                      strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyReports;