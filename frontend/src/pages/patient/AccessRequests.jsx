import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";

// ── Status Badge ─────────────────────────────────────
function StatusBadge({ status }) {
  const config = {
    pending: "bg-yellow-100 text-yellow-700",
    approved: "bg-green-100 text-green-700",
    denied: "bg-red-100 text-red-700",
    revoked: "bg-gray-100 text-gray-600",
  };
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${config[status] || "bg-gray-100 text-gray-600"}`}>
      {status}
    </span>
  );
}

// ── Doctor Avatar ────────────────────────────────────
function DoctorAvatar({ name }) {
  const initials = name
    .split(" ")
    .filter((w) => w !== "Dr.")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
      <span className="text-indigo-600 font-semibold text-sm">{initials}</span>
    </div>
  );
}

// ── Format Date ──────────────────────────────────────
function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-PK", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

// ── Pending Request Card ─────────────────────────────
function PendingCard({ request, onApprove, onDeny, actionLoading }) {
  const isLoading = actionLoading === request.id;

  return (
    <div className="bg-white rounded-2xl border border-yellow-100 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <DoctorAvatar name={request.doctor_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {request.doctor_name}
              </p>
              <p className="text-xs text-gray-500">{request.doctor_specialization}</p>
            </div>
            <StatusBadge status={request.status} />
          </div>

          {/* Scope */}
          <div className="mt-3 p-3 bg-gray-50 rounded-xl flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm text-gray-600">Requesting access to <span className="font-medium text-gray-800">all your medical records</span></p>
          </div>

          {/* Reason */}
          {request.reason?.trim() && (
            <div className="mt-3">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Reason</p>
              <p className="text-sm text-gray-600">{request.reason}</p>
            </div>
          )}

          {/* Date */}
          <p className="text-xs text-gray-400 mt-3">
            Requested on {formatDate(request.requested_at)}
          </p>

          {/* Action Buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={() => onApprove(request.id)}
              disabled={isLoading}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              Approve
            </button>
            <button
              onClick={() => onDeny(request.id)}
              disabled={isLoading}
              className="flex-1 bg-red-50 hover:bg-red-100 text-red-600 font-semibold py-2.5 rounded-xl text-sm transition disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2 border border-red-200"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              Deny
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── History Request Card ─────────────────────────────
function HistoryCard({ request, onRevoke, actionLoading }) {
  const isLoading = actionLoading === request.id;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-start gap-4">
        <DoctorAvatar name={request.doctor_name} />
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <p className="text-sm font-semibold text-gray-800">
                {request.doctor_name}
              </p>
              <p className="text-xs text-gray-500">{request.doctor_specialization}</p>
            </div>
            <StatusBadge status={request.status} />
          </div>

          <p className="text-sm text-gray-500 mt-2">All medical records</p>
          {request.reason?.trim() && (
            <p className="text-sm text-gray-600 mt-1">{request.reason}</p>
          )}

          <div className="flex flex-wrap gap-4 mt-3 text-xs text-gray-400">
            <span>Requested: {formatDate(request.requested_at)}</span>
            {request.decided_at && (
              <span>Decided: {formatDate(request.decided_at)}</span>
            )}
            {request.expires_at && request.status === "approved" && (
              <span className="text-orange-500">
                Expires: {formatDate(request.expires_at)}
              </span>
            )}
          </div>

          {/* Revoke button for approved requests */}
          {request.status === "approved" && (
            <button
              onClick={() => onRevoke(request.id)}
              disabled={isLoading}
              className="mt-3 text-xs text-red-500 hover:text-red-700 hover:underline transition disabled:opacity-60 flex items-center gap-1"
            >
              {isLoading ? "Revoking..." : "Revoke Access"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────
function AccessRequests() {
  const { token } = useAuth();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");
  const [actionLoading, setActionLoading] = useState(null);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    setLoading(true);
    try {
      const res = await api.get("/access-requests", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests(res.data);
    } catch {
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // ── Show Toast ───────────────────────────────────────
  const showToast = (message, type = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Approve ──────────────────────────────────────────
  const handleApprove = async (id) => {
    setActionLoading(id);
    try {
      const res = await api.patch(`/access-requests/${id}/approve`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests((prev) => prev.map((r) => r.id === id ? res.data : r));
      showToast("Access approved successfully.");
    } catch {
      showToast("Failed to approve request.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Deny ─────────────────────────────────────────────
  const handleDeny = async (id) => {
    setActionLoading(id);
    try {
      const res = await api.patch(`/access-requests/${id}/deny`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests((prev) => prev.map((r) => r.id === id ? res.data : r));
      showToast("Access denied.", "error");
    } catch {
      showToast("Failed to deny request.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Revoke ───────────────────────────────────────────
  const handleRevoke = async (id) => {
    setActionLoading(id);
    try {
      const res = await api.patch(`/access-requests/${id}/revoke`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setRequests((prev) => prev.map((r) => r.id === id ? res.data : r));
      showToast("Access revoked successfully.", "error");
    } catch {
      showToast("Failed to revoke access.", "error");
    } finally {
      setActionLoading(null);
    }
  };

  // ── Filter by tab ────────────────────────────────────
  const filtered = requests.filter((r) => {
    if (activeTab === "pending") return r.status === "pending";
    if (activeTab === "approved") return r.status === "approved";
    if (activeTab === "denied") return r.status === "denied";
    if (activeTab === "revoked") return r.status === "revoked";
    return true;
  });

  // ── Tab counts ───────────────────────────────────────
  const counts = {
    pending: requests.filter((r) => r.status === "pending").length,
    approved: requests.filter((r) => r.status === "approved").length,
    denied: requests.filter((r) => r.status === "denied").length,
    revoked: requests.filter((r) => r.status === "revoked").length,
  };

  const tabs = [
    { key: "pending", label: "Pending", color: "text-yellow-600" },
    { key: "approved", label: "Approved", color: "text-green-600" },
    { key: "denied", label: "Denied", color: "text-red-600" },
    { key: "revoked", label: "Revoked", color: "text-gray-500" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
        </svg>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">

      {/* Toast Notification */}
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-2xl shadow-lg text-sm font-medium text-white transition-all ${toast.type === "error" ? "bg-red-500" : "bg-green-500"}`}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Access Requests</h1>
        <p className="text-gray-500 text-sm mt-1">
          Manage which doctors can access your medical records. Every decision is recorded on the blockchain.
        </p>
      </div>

      {/* Pending Alert Banner */}
      {counts.pending > 0 && (
        <div className="mb-6 flex items-center gap-3 p-4 bg-yellow-50 border border-yellow-200 rounded-2xl">
          <div className="w-9 h-9 bg-yellow-100 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="text-sm text-yellow-800 font-medium">
            You have {counts.pending} pending request{counts.pending > 1 ? "s" : ""} waiting for your decision.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-6 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition whitespace-nowrap ${activeTab === tab.key ? "bg-white shadow-sm text-gray-800" : "text-gray-500 hover:text-gray-700"}`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${activeTab === tab.key ? `${tab.color} bg-gray-100` : "bg-gray-200 text-gray-500"}`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
          <svg className="w-12 h-12 text-gray-200 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <p className="text-gray-400 font-medium">
            No {activeTab} requests
          </p>
          <p className="text-gray-300 text-sm mt-1">
            {activeTab === "pending"
              ? "You have no pending requests right now."
              : `No requests have been ${activeTab} yet.`}
          </p>
        </div>
      )}

      {/* Request Cards */}
      <div className="space-y-4">
        {filtered.map((request) =>
          request.status === "pending" ? (
            <PendingCard
              key={request.id}
              request={request}
              onApprove={handleApprove}
              onDeny={handleDeny}
              actionLoading={actionLoading}
            />
          ) : (
            <HistoryCard
              key={request.id}
              request={request}
              onRevoke={handleRevoke}
              actionLoading={actionLoading}
            />
          )
        )}
      </div>
    </div>
  );
}

export default AccessRequests;