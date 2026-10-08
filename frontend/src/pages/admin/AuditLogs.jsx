import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getAdminAuditLogs } from "../../api/admin";
import FilterChips from "../../components/ui/FilterChips";

const actionTone = {
  login: "pill-ok",
  logout: "pill-plain",
  report_upload: "pill-ok",
  mc_report_upload: "pill-ok",
  access_approved: "pill-ok",
  access_denied: "pill-bad",
  access_revoked: "pill-warn",
  medical_center_approved: "pill-brand",
  medical_center_rejected: "pill-bad",
  doctor_verified: "pill-ok",
  doctor_unverified: "pill-warn",
  register: "pill-brand",
};

function AuditLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  const fetchLogs = (newOffset = 0) => {
    setLoading(true);
    getAdminAuditLogs(token, action, LIMIT, newOffset)
      .then((res) => setLogs(res.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setOffset(0);
    fetchLogs(0);
  }, [token, action]);

  const actionTypes = [
    "", "login", "logout", "report_upload", "mc_report_upload",
    "access_approved", "access_denied", "access_revoked",
    "medical_center_approved", "medical_center_rejected",
    "doctor_verified", "doctor_unverified", "register"
  ];

  const actionOptions = actionTypes.map((a) => ({ value: a, label: a === "" ? "All" : a.replaceAll("_", " ") }));

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Audit <em>logs</em>
      </h1>
      <p className="mt-3 text-sm text-muted">
        Activity across the platform. Read only, and it never includes record content.
      </p>

      <div className="mt-8">
        <FilterChips label="Filter by action" options={actionOptions} value={action} onChange={setAction} />
      </div>

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : logs.length === 0 ? (
        <div className="card card-pad mt-6 text-center text-sm text-muted">No logs found.</div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Audit log entries</caption>
            <thead className="!bg-inset">
              <tr>
                {["Action", "User", "Entity", "IP address", "Time"].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 text-left text-[13px] font-bold !text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {logs.map((log) => (
                <tr key={log.id}>
                  <td className="px-5 py-4">
                    <span className={`pill capitalize ${actionTone[log.action] || "pill-plain"}`}>
                      {log.action?.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-soft">{log.performer_name || log.performed_by || "-"}</td>
                  <td className="px-5 py-4 text-ink-soft">
                    {log.entity_type ? `${log.entity_type} #${log.entity_id}` : "-"}
                  </td>
                  <td className="px-5 py-4 font-mono text-[13px] text-ink-soft">{log.ip_address || "-"}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-ink-soft">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      <div className="mt-4 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => { const o = Math.max(0, offset - LIMIT); setOffset(o); fetchLogs(o); }}
          disabled={offset === 0}
          className="btn btn-secondary btn-sm"
        >
          <ChevronLeft aria-hidden="true" size={16} />
          Previous
        </button>
        <span className="text-sm text-muted" aria-live="polite">
          Showing {offset + 1} to {offset + logs.length}
        </span>
        <button
          type="button"
          onClick={() => { const o = offset + LIMIT; setOffset(o); fetchLogs(o); }}
          disabled={logs.length < LIMIT}
          className="btn btn-secondary btn-sm"
        >
          Next
          <ChevronRight aria-hidden="true" size={16} />
        </button>
      </div>
    </div>
  );
}

export default AuditLogs;
