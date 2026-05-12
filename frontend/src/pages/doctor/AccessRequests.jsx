import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { getMyAccessRequests, submitAccessRequest } from "../../api/doctor";

const statusColors = {
  pending: "bg-yellow-100 text-yellow-700",
  approved: "bg-green-100 text-green-700",
  denied: "bg-red-100 text-red-700",
  revoked: "bg-gray-100 text-gray-600",
};

function DoctorAccessRequests() {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ report_id: "", reason: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const fetchRequests = () => {
    setLoading(true);
    getMyAccessRequests(token)
      .then((res) => setRequests(res.data))
      .catch(() => setRequests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchRequests(); }, [token]);

  const filtered = filter === "all"
    ? requests
    : requests.filter((r) => r.status === filter);

  const handleSubmit = async () => {
    if (!form.report_id.trim() || !form.reason.trim()) {
      setError("Both Report ID and reason are required.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      await submitAccessRequest(token, {
        report_id: form.report_id.trim(),
        reason: form.reason.trim(),
      });
      setSuccess("Access request submitted successfully.");
      setForm({ report_id: "", reason: "" });
      setShowForm(false);
      fetchRequests();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to submit request.");
    }
    setSubmitting(false);
  };

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Access Requests</h1>
          <p className="text-gray-500 text-sm mt-1">Submit and track your patient record access requests.</p>
        </div>
        <button
          onClick={() => { setShowForm(true); setError(""); setSuccess(""); }}
          className="px-4 py-2.5 bg-green-600 text-white text-sm font-medium rounded-xl hover:bg-green-700 transition"
        >
          + New Request
        </button>
      </div>

      {/* Success message */}
      {success && (
        <div className="mb-4 px-4 py-3 bg-green-50 border border-green-100 rounded-xl text-sm text-green-700">
          {success}
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "pending", "approved", "denied", "revoked"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${filter === f
                ? "bg-green-600 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No requests found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Report ID</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Reason</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Status</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Submitted</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Expires</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((req) => (
                <tr key={req.id} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 font-mono text-xs text-gray-600">
                    {req.report_id?.slice(0, 8)}...
                  </td>
                  <td className="px-5 py-4 text-gray-600 max-w-xs truncate">{req.reason}</td>
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${statusColors[req.status] || "bg-gray-100 text-gray-600"}`}>
                      {req.status}
                    </span>
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {req.created_at ? new Date(req.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td className="px-5 py-4 text-gray-500">
                    {req.expires_at ? new Date(req.expires_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New Request Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-bold text-gray-800 mb-1">New Access Request</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enter the Report ID and your clinical reason for requesting access.
            </p>

            {error && (
              <div className="mb-3 px-4 py-3 bg-red-50 border border-red-100 rounded-xl text-sm text-red-600">
                {error}
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Report ID</label>
                <input
                  type="text"
                  value={form.report_id}
                  onChange={(e) => setForm({ ...form, report_id: e.target.value })}
                  placeholder="Enter the patient's report ID"
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Clinical Reason</label>
                <textarea
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={3}
                  placeholder="State your clinical reason for requesting access..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-300 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-5">
              <button
                onClick={() => { setShowForm(false); setError(""); }}
                className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-xl text-sm font-medium hover:bg-green-700 transition disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Submit Request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorAccessRequests;