import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getAdminAuditLogs } from "../../api/admin";

const actionColors = {
  login: "bg-blue-100 text-blue-700",
  logout: "bg-gray-100 text-gray-600",
  upload: "bg-green-100 text-green-700",
  access_grant: "bg-purple-100 text-purple-700",
  access_deny: "bg-red-100 text-red-700",
  access_revoke: "bg-orange-100 text-orange-700",
  mc_approve: "bg-teal-100 text-teal-700",
  mc_reject: "bg-red-100 text-red-700",
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
    "", "login", "logout", "upload", "access_grant",
    "access_deny", "access_revoke", "mc_approve", "mc_reject"
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Audit Logs</h1>
        <p className="text-gray-500 text-sm mt-1">All system activity — read only.</p>
      </div>

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {actionTypes.map((a) => (
          <button
            key={a}
            onClick={() => setAction(a)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${action === a
                ? "bg-red-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
          >
            {a === "" ? "All" : a.replace("_", " ")}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : logs.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No logs found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Action</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">User</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Entity</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">IP Address</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {logs.map((log) => (
                <tr key={log.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${actionColors[log.action] || "bg-gray-100 text-gray-600"}`}>
                      {log.action?.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-500">{log.performed_by || "—"}</td>
                  <td className="px-5 py-4 text-gray-500">
                    {log.entity_type ? `${log.entity_type} #${log.entity_id}` : "—"}
                  </td>
                  <td className="px-5 py-4 text-gray-500">{log.ip_address || "—"}</td>
                  <td className="px-5 py-4 text-gray-500">
                    {log.created_at ? new Date(log.created_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        <div className="flex items-center justify-between px-5 py-4 border-t border-gray-100">
          <button
            onClick={() => { const o = Math.max(0, offset - LIMIT); setOffset(o); fetchLogs(o); }}
            disabled={offset === 0}
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            ← Previous
          </button>
          <span className="text-sm text-gray-400">Showing {offset + 1}–{offset + logs.length}</span>
          <button
            onClick={() => { const o = offset + LIMIT; setOffset(o); fetchLogs(o); }}
            disabled={logs.length < LIMIT}
            className="px-4 py-2 text-sm rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition"
          >
            Next →
          </button>
        </div>
      </div>
    </div>
  );
}

export default AuditLogs;