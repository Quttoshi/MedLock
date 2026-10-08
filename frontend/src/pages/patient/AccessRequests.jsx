import { useState, useEffect } from "react";
import { Check, X, Clock, FileText, ShieldCheck, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import api from "../../api/axios";
import StatusPill from "../../components/ui/StatusPill";
import { doctorLabel, initials } from "../../adapters/patientStory";

// How the doctor was verified, so the patient can judge the request
function VerificationNote({ request }) {
  if (request.doctor_verified === undefined || request.doctor_verified === null) return null;
  return request.doctor_verified ? (
    <p className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-ok-ink">
      <ShieldCheck aria-hidden="true" size={14} />
      {request.doctor_verification_label}
    </p>
  ) : (
    <p className="mt-1 flex items-start gap-1.5 text-[13px] font-semibold text-warn-ink">
      <ShieldAlert aria-hidden="true" size={14} className="mt-0.5 flex-shrink-0" />
      Not yet verified. This doctor cannot open your records even if you approve.
    </p>
  );
}

const STATUS_TONE = { pending: "warn", approved: "ok", denied: "bad", revoked: "plain" };
const STATUS_ICON = { pending: Clock, approved: Check, denied: X, revoked: X };

function StatusBadge({ status }) {
  return (
    <StatusPill tone={STATUS_TONE[status] ?? "plain"} icon={STATUS_ICON[status]}>
      <span className="capitalize">{status}</span>
    </StatusPill>
  );
}

function DoctorAvatar({ name }) {
  return (
    <span
      className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-bold text-brand"
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

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
    <article className="card border-warn/40 p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <DoctorAvatar name={request.doctor_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-ink">{doctorLabel(request.doctor_name)}</h3>
              <p className="text-sm text-muted">{request.doctor_specialization}</p>
              <VerificationNote request={request} />
            </div>
            <StatusBadge status={request.status} />
          </div>

          <div className="card-inset mt-4 flex items-center gap-2.5 p-3.5">
            <FileText aria-hidden="true" size={18} className="flex-shrink-0 text-brand" />
            <p className="text-sm text-ink-soft">
              Asking to see <span className="font-bold text-ink">all your medical records</span>
            </p>
          </div>

          {request.reason?.trim() && (
            <div className="mt-4">
              <p className="eyebrow mb-1">Reason</p>
              <p className="text-sm leading-6 text-ink-soft">{request.reason}</p>
            </div>
          )}

          <p className="mt-4 text-sm text-muted">Requested on {formatDate(request.requested_at)}</p>
          <p className="mt-1 text-sm text-muted">Approving gives access for 30 days. You can take it back at any time.</p>

          <div className="mt-5 flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => onApprove(request.id)}
              disabled={isLoading}
              className="btn btn-primary flex-1"
            >
              <Check aria-hidden="true" size={18} />
              {isLoading ? "Working..." : "Approve"}
            </button>
            <button
              type="button"
              onClick={() => onDeny(request.id)}
              disabled={isLoading}
              className="btn flex-1 border-bad bg-transparent text-bad-ink hover:bg-bad-subtle"
            >
              <X aria-hidden="true" size={18} />
              Deny
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}

// ── History Request Card ─────────────────────────────
function HistoryCard({ request, onRevoke, actionLoading }) {
  const isLoading = actionLoading === request.id;

  return (
    <article className="card p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <DoctorAvatar name={request.doctor_name} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-base font-bold text-ink">{doctorLabel(request.doctor_name)}</h3>
              <p className="text-sm text-muted">{request.doctor_specialization}</p>
              <VerificationNote request={request} />
            </div>
            <StatusBadge status={request.status} />
          </div>

          <p className="mt-3 text-sm text-ink-soft">All medical records</p>
          {request.reason?.trim() && <p className="mt-1 text-sm leading-6 text-muted">{request.reason}</p>}

          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm text-muted">
            <span>Requested: {formatDate(request.requested_at)}</span>
            {request.decided_at && <span>Decided: {formatDate(request.decided_at)}</span>}
            {request.expires_at && request.status === "approved" && (
              <span className="font-semibold text-warn-ink">Expires: {formatDate(request.expires_at)}</span>
            )}
          </div>

          {request.status === "approved" && (
            <button
              type="button"
              onClick={() => onRevoke(request.id)}
              disabled={isLoading}
              className="btn btn-sm mt-4 border-bad bg-transparent text-bad-ink hover:bg-bad-subtle"
            >
              {isLoading ? "Revoking..." : "Revoke access"}
            </button>
          )}
        </div>
      </div>
    </article>
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
    { key: "pending", label: "Pending" },
    { key: "approved", label: "Approved" },
    { key: "denied", label: "Denied" },
    { key: "revoked", label: "Revoked" },
  ];

  if (loading) {
    return <p className="py-24 text-center text-muted">Loading your requests...</p>;
  }

  return (
    <div className="mx-auto max-w-3xl">

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed right-4 top-4 z-50 rounded-2xl px-5 py-3 text-sm font-semibold shadow-card sm:right-6 sm:top-6 ${
            toast.type === "error" ? "bg-bad-subtle text-bad-ink" : "bg-ok-subtle text-ok-ink"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Header */}
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Who can see your <em>records</em>
      </h1>
      <p className="mt-3 max-w-xl text-sm leading-6 text-muted">
        Doctors ask, and you decide. Approving gives a doctor access for 30 days, and you can take it back at any time. Every decision is logged.
      </p>

      {/* Pending alert */}
      {counts.pending > 0 && (
        <div className="mt-6 flex items-center gap-3 rounded-2xl bg-warn-subtle p-4">
          <Clock aria-hidden="true" size={20} className="flex-shrink-0 text-warn-ink" />
          <p className="text-sm font-semibold text-warn-ink">
            {counts.pending} request{counts.pending > 1 ? "s" : ""} waiting for your decision.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div role="group" aria-label="Filter requests by status" className="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            aria-pressed={activeTab === tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              activeTab === tab.key ? "bg-deep text-deep-on" : "text-ink-soft hover:bg-inset hover:text-ink"
            }`}
          >
            {tab.label}
            {counts[tab.key] > 0 && (
              <span className={`rounded-full px-1.5 text-xs font-bold ${activeTab === tab.key ? "bg-deep-2 text-deep-on" : "bg-inset text-ink-soft"}`}>
                {counts[tab.key]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Empty State */}
      {filtered.length === 0 && (
        <div className="card card-pad mt-6 text-center">
          <ShieldCheck aria-hidden="true" size={28} className="mx-auto text-muted" />
          <p className="display mt-3 text-xl text-ink">No {activeTab} requests</p>
          <p className="mt-2 text-sm text-muted">
            {activeTab === "pending"
              ? "You have no pending requests right now."
              : `No requests have been ${activeTab} yet.`}
          </p>
        </div>
      )}

      {/* Request Cards */}
      <div className="mt-6 space-y-4">
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
