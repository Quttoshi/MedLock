import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getAdminAuditLogs } from "../../api/admin";
import FilterChips from "../../components/ui/FilterChips";
import { parseServerDate } from "../../utils/dates";

// Filters are groups of related actions; the backend knows which actions each covers.
const CATEGORY_OPTIONS = [
  { value: "", label: "All" },
  { value: "accounts", label: "Accounts" },
  { value: "reports", label: "Reports" },
  { value: "access", label: "Access" },
  { value: "doctors", label: "Doctors" },
  { value: "centers", label: "Centers" },
  { value: "questions", label: "Questions" },
];

// Colour by outcome: approvals green, refusals red, removals amber, the rest plain.
const actionTone = (action = "") => {
  if (/(rejected|denied|failed)$/.test(action)) return "pill-bad";
  if (/(revoked|unverified|removed|left)$/.test(action)) return "pill-warn";
  if (/(approved|verified|upload|register)/.test(action)) return "pill-ok";
  return "pill-plain";
};

function AuditLogs() {
  const { token } = useAuth();
  const [logs, setLogs] = useState([]);
  const [category, setCategory] = useState("");
  const [loading, setLoading] = useState(true);
  const [offset, setOffset] = useState(0);
  const LIMIT = 50;

  useEffect(() => {
    getAdminAuditLogs(token, category, LIMIT, offset)
      .then((res) => setLogs(res.data))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [token, category, offset]);

  // A new filter starts from the first page.
  const changeCategory = (value) => {
    setLoading(true);
    setCategory(value);
    setOffset(0);
  };
  const changePage = (value) => {
    setLoading(true);
    setOffset(value);
  };

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Audit <em>logs</em>
      </h1>
      <p className="mt-3 text-sm text-muted">
        Activity across the platform. Read only, and it never includes record content.
      </p>

      <div className="mt-8">
        <FilterChips label="Filter by activity" options={CATEGORY_OPTIONS} value={category} onChange={changeCategory} />
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
                    <span className={`pill capitalize ${actionTone(log.action)}`}>
                      {log.action?.replaceAll("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-ink-soft">{log.performer_name || log.performed_by || "-"}</td>
                  <td className="px-5 py-4 text-ink-soft">
                    {log.entity_type ? `${log.entity_type} #${log.entity_id}` : "-"}
                  </td>
                  <td className="px-5 py-4 font-mono text-[13px] text-ink-soft">{log.ip_address || "-"}</td>
                  <td className="whitespace-nowrap px-5 py-4 text-ink-soft">
                    {log.created_at ? parseServerDate(log.created_at).toLocaleString() : "-"}
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
          onClick={() => changePage(Math.max(0, offset - LIMIT))}
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
          onClick={() => changePage(offset + LIMIT)}
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
