import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, Upload } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMCReports } from "../../api/medicalCenter";
import StatusPill from "../../components/ui/StatusPill";
import { parseServerDate } from "../../utils/dates";

const FILTERS = ["all", "approved", "pending"];

function MCMyReports() {
  const { token } = useAuth();
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  useEffect(() => {
    getMCReports(token)
      .then((res) => setReports(res.data))
      .catch(() => setReports([]))
      .finally(() => setLoading(false));
  }, [token]);

  const counts = {
    all: reports.length,
    approved: reports.filter((r) => r.is_approved).length,
    pending: reports.filter((r) => !r.is_approved).length,
  };
  const filtered = filter === "all" ? reports : reports.filter((r) => (filter === "approved" ? r.is_approved : !r.is_approved));

  return (
    <div className="mx-auto max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-line pb-3">
        <div>
          <h1 className="display text-3xl text-ink">
            Uploaded <em>reports</em>
          </h1>
          <p className="mt-1 text-sm text-muted">All diagnostic reports uploaded by your medical center.</p>
        </div>
        <Link to="/mc/upload" className="btn btn-primary btn-sm">
          <Upload aria-hidden="true" size={15} />
          Upload a report
        </Link>
      </div>

      <div role="group" aria-label="Filter reports" className="mt-5 inline-flex gap-1 rounded-md border border-line bg-surface p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`flex items-center gap-2 rounded px-3 py-1.5 text-sm font-semibold capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              filter === f ? "bg-deep text-deep-on" : "text-ink-soft hover:bg-inset hover:text-ink"
            }`}
          >
            {f}
            <span className="text-xs opacity-80">{counts[f]}</span>
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="mt-5 rounded-lg border border-dashed border-line-strong px-4 py-10 text-center">
          <FileText aria-hidden="true" size={24} className="mx-auto text-muted" />
          <p className="mt-2 text-base font-semibold text-ink">No reports found</p>
          {reports.length === 0 && (
            <>
              <p className="mx-auto mt-1 max-w-sm text-sm text-muted">Reports you upload for patients will appear here.</p>
              <Link to="/mc/upload" className="btn btn-primary btn-sm mt-4">
                Upload a report
              </Link>
            </>
          )}
        </div>
      ) : (
        <div className="mt-5 overflow-x-auto rounded-lg border border-line bg-surface">
          <table className="w-full text-sm">
            <caption className="sr-only">Reports uploaded by your medical center</caption>
            <thead className="bg-inset">
              <tr>
                {["File name", "Report type", "Patient", "Uploaded", "Status"].map((h) => (
                  <th key={h} scope="col" className="px-4 py-2 text-left text-xs font-bold uppercase tracking-wider text-muted">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((report) => (
                <tr key={report.id}>
                  <td className="px-4 py-3 font-semibold text-ink">{report.original_filename || "Report"}</td>
                  <td className="px-4 py-3 capitalize text-ink-soft">{report.report_type?.replace(/_/g, " ") || "-"}</td>
                  <td className="px-4 py-3 text-ink-soft">{report.patient_name || report.patient_email || "-"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                    {report.uploaded_at ? parseServerDate(report.uploaded_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-4 py-3">
                    <StatusPill tone={report.is_approved ? "ok" : "warn"}>
                      {report.is_approved ? "Approved" : "Pending approval"}
                    </StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default MCMyReports;
