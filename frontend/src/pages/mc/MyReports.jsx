import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FileText } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMCReports } from "../../api/medicalCenter";
import StatusPill from "../../components/ui/StatusPill";

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

  const filtered = filter === "all"
    ? reports
    : filter === "approved"
    ? reports.filter((r) => r.is_approved)
    : reports.filter((r) => !r.is_approved);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Uploaded <em>reports</em>
      </h1>
      <p className="mt-3 text-sm text-muted">All diagnostic reports uploaded by your medical center.</p>

      <div role="group" aria-label="Filter reports" className="mt-8 inline-flex gap-1 rounded-full bg-inset p-1">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            aria-pressed={filter === f}
            className={`rounded-full px-4 py-2 text-sm font-bold capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              filter === f ? "bg-deep text-deep-on" : "text-muted hover:text-ink"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : filtered.length === 0 ? (
        <div className="card card-pad mt-6 text-center">
          <FileText aria-hidden="true" size={28} className="mx-auto text-muted" />
          <p className="display mt-3 text-xl text-ink">No reports found</p>
          {reports.length === 0 && (
            <>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-muted">
                Reports you upload for patients will appear here.
              </p>
              <Link to="/mc/upload" className="btn btn-primary mt-5">Upload a report</Link>
            </>
          )}
        </div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Reports uploaded by your medical center</caption>
            <thead className="!bg-inset">
              <tr>
                {["File name", "Report type", "Patient", "Uploaded", "Status"].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 text-left text-[13px] font-bold !text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((report) => (
                <tr key={report.id}>
                  <td className="px-5 py-4 font-bold text-ink">{report.original_filename || "Report"}</td>
                  <td className="px-5 py-4 capitalize text-ink-soft">{report.report_type?.replace(/_/g, " ") || "-"}</td>
                  <td className="px-5 py-4 text-ink-soft">{report.patient_name || report.patient_email || "-"}</td>
                  <td className="px-5 py-4 text-ink-soft">
                    {report.uploaded_at ? new Date(report.uploaded_at).toLocaleDateString() : "-"}
                  </td>
                  <td className="px-5 py-4">
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
