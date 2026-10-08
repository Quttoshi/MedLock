import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FileText, Plus, Search, Clock, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import { sourceLabel } from "../../adapters/patientStory";

function MyReports() {
  const { token } = useAuth();

  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("All");
  const [actionLoading, setActionLoading] = useState(null);

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

  // ── Fetch Reports ────────────────────────────────────
  useEffect(() => {
    fetchReports();
  }, [token]);

  const handleApprove = async (reportId) => {
    setActionLoading(reportId + "_approve");
    try {
      await api.patch(`/reports/${reportId}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchReports();
    } catch {}
    setActionLoading(null);
  };

  const handleReject = async (reportId) => {
    setActionLoading(reportId + "_reject");
    try {
      await api.patch(`/reports/${reportId}/reject`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      await fetchReports();
    } catch {}
    setActionLoading(null);
  };

  // ── Split pending vs approved ─────────────────────────
  const pendingReports = reports.filter((r) => !r.is_approved);
  const approvedReports = reports.filter((r) => r.is_approved);

  // ── Filter + Search (approved only) ──────────────────
  const reportTypes = ["All", ...new Set(approvedReports.map((r) => r.report_type))];

  const filtered = approvedReports.filter((r) => {
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

  // ── Render ───────────────────────────────────────────
  return (
    <div className="mx-auto max-w-4xl">

      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
            Your <em>records</em>
          </h1>
          <p className="mt-2 text-sm text-muted">
            {approvedReports.length} report{approvedReports.length !== 1 ? "s" : ""} in your record
          </p>
        </div>
        <Link to="/patient/upload" className="btn btn-primary">
          <Plus aria-hidden="true" size={18} />
          Upload a record
        </Link>
      </div>

      {/* Pending approval */}
      {!loading && pendingReports.length > 0 && (
        <section className="mt-8" aria-labelledby="pending-heading">
          <h2 id="pending-heading" className="eyebrow mb-3 flex items-center gap-2">
            <Clock aria-hidden="true" size={14} />
            Waiting for your approval
          </h2>
          <ul className="space-y-3">
            {pendingReports.map((report) => (
              <li key={report.id} className="card border-warn/40 bg-warn-subtle/40 p-5">
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="flex min-w-0 flex-1 items-start gap-4">
                    <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-warn-subtle text-warn-ink">
                      <FileText aria-hidden="true" size={20} />
                    </span>
                    <div className="min-w-0">
                      <p className="break-words text-[16px] font-bold text-ink">{report.original_filename}</p>
                      <p className="mt-0.5 text-sm text-muted">
                        {report.report_type} · {sourceLabel(report.upload_source)}
                      </p>
                      <p className="mt-1 text-sm text-warn-ink">
                        Review this report before it is added to your medical record.
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => handleReject(report.id)}
                      disabled={!!actionLoading}
                      className="btn btn-sm border-bad bg-transparent text-bad-ink hover:bg-bad-subtle"
                    >
                      {actionLoading === report.id + "_reject" ? "..." : "Reject"}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleApprove(report.id)}
                      disabled={!!actionLoading}
                      className="btn btn-sm btn-primary"
                    >
                      {actionLoading === report.id + "_approve" ? "..." : "Approve"}
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Search + filter */}
      <div className="mt-8 space-y-4">
        <div className="relative">
          <Search aria-hidden="true" size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="search"
            aria-label="Search reports"
            placeholder="Search reports"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="field !pl-10"
          />
        </div>
        {reportTypes.length > 1 && (
          <div role="group" aria-label="Filter by record type" className="inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
            {reportTypes.map((t) => (
              <button
                key={t}
                type="button"
                aria-pressed={filterType === t}
                onClick={() => setFilterType(t)}
                className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                  filterType === t ? "bg-deep text-deep-on" : "text-ink-soft hover:bg-inset hover:text-ink"
                }`}
              >
                {t === "All" ? "Everything" : t}
              </button>
            ))}
          </div>
        )}
      </div>

      {loading && <p className="mt-10 text-center text-muted">Loading your records...</p>}

      {!loading && filtered.length === 0 && (
        <div className="card card-pad mt-8 text-center">
          <FileText aria-hidden="true" size={28} className="mx-auto text-muted" />
          <p className="display mt-3 text-xl text-ink">No records found</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
            {searchQuery ? "Try a different search term." : "Upload your first report to get started."}
          </p>
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <ul className="mt-6 space-y-3">
          {filtered.map((report) => (
            <li key={report.id}>
              <Link
                to={`/patient/reports/${report.id}`}
                className="card flex items-center gap-4 p-5 transition-colors hover:border-line-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
              >
                <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-brand-subtle text-brand">
                  <FileText aria-hidden="true" size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[16px] font-bold leading-snug text-ink">
                    {report.original_filename || report.name}
                  </span>
                  <span className="mt-0.5 block text-sm text-muted">
                    {formatDate(report.uploaded_at || report.upload_date)} · {sourceLabel(report.upload_source)}
                  </span>
                  <span className="mt-2 flex flex-wrap items-center gap-2">
                    <span className="pill pill-plain">{report.report_type}</span>
                    <span className="hash">SHA-256 {report.file_hash_sha256?.slice(0, 16)}...</span>
                  </span>
                </span>
                <ChevronRight aria-hidden="true" size={18} className="flex-shrink-0 text-muted" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default MyReports;
