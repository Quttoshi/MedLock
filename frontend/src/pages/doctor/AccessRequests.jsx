import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { Plus } from "lucide-react";
import { getMyAccessRequests, submitAccessRequest } from "../../api/doctor";
import StatusPill from "../../components/ui/StatusPill";
import { parseServerDate } from "../../utils/dates";
import PatientLookupFields from "../../components/PatientLookupFields";
import { EMPTY_LOOKUP, lookupComplete, lookupPayload } from "../../utils/patientLookup";

function DoctorAccessRequests() {
  const { token } = useAuth();
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ reason: "" });
  const [patient, setPatient] = useState(EMPTY_LOOKUP);
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
    if (!lookupComplete(patient)) {
      setError("Enter the patient's email, or their CNIC and date of birth.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await submitAccessRequest(token, {
        ...lookupPayload(patient),
        reason: form.reason.trim() || null,
      });
      const d = res.data;
      setSuccess(`Access request sent to ${d.patient_name || d.patient_email}. They will be asked to approve it.`);
      setForm({ reason: "" });
      setPatient(EMPTY_LOOKUP);
      setShowForm(false);
      fetchRequests();
    } catch (e) {
      setError(e?.response?.data?.detail || "Failed to submit request.");
    }
    setSubmitting(false);
  };

  const TONE = { pending: "warn", approved: "ok", denied: "bad", revoked: "plain", expired: "plain" };
  const fmt = (v) => (v ? parseServerDate(v).toLocaleDateString() : "-");

  return (
    <div className="mx-auto max-w-5xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
            Access <em>requests</em>
          </h1>
          <p className="mt-3 text-sm text-muted">Send and track requests for patient records.</p>
        </div>
        <button
          type="button"
          onClick={() => { setShowForm(true); setError(""); setSuccess(""); setForm({ reason: "" }); setPatient(EMPTY_LOOKUP); }}
          className="btn btn-primary"
        >
          <Plus aria-hidden="true" size={18} />
          New request
        </button>
      </div>

      {success && (
        <div role="status" className="mt-6 rounded-xl bg-ok-subtle p-3.5 text-sm font-semibold text-ok-ink">
          {success}
        </div>
      )}

      <div role="group" aria-label="Filter requests by status" className="mt-6 inline-flex max-w-full gap-1 overflow-x-auto rounded-full border border-line bg-surface p-1">
        {["all", "pending", "approved", "expired", "denied", "revoked"].map((f) => (
          <button
            key={f}
            type="button"
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-semibold capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              filter === f ? "bg-deep text-deep-on" : "text-ink-soft hover:bg-inset hover:text-ink"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="card mt-6 overflow-x-auto">
        {loading ? (
          <p className="p-10 text-center text-muted">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="p-10 text-center text-muted">No requests found.</p>
        ) : (
          <table className="w-full text-sm">
            <caption className="sr-only">Your access requests</caption>
            <thead className="!bg-inset">
              <tr>
                {["Patient", "Reason", "Status", "Submitted", "Expires"].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 text-left text-[13px] font-bold !text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filtered.map((req) => (
                <tr key={req.id}>
                  <td className="px-5 py-4">
                    <p className="font-bold text-ink">{req.patient_name || "-"}</p>
                    <p className="text-xs text-muted">{req.patient_email || ""}</p>
                  </td>
                  <td className="max-w-xs truncate px-5 py-4 text-ink-soft">{req.reason?.trim() || "-"}</td>
                  <td className="px-5 py-4">
                    <StatusPill tone={TONE[req.status] ?? "plain"}>
                      <span className="capitalize">{req.status}</span>
                    </StatusPill>
                    {req.initiated_by === "patient" && (
                      <p className="mt-1 text-[13px] text-muted">Shared by patient</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-ink-soft">{fmt(req.requested_at || req.created_at)}</td>
                  <td className="px-5 py-4 text-ink-soft">{fmt(req.expires_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* New request dialog */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="new-request-title" className="card card-lift w-full max-w-md p-6 sm:p-8">
            <h2 id="new-request-title" className="display text-xl text-ink">New access request</h2>
            <p className="mt-2 text-sm leading-6 text-muted">
              Enter the patient's email to ask for access to all their approved reports. The patient decides.
            </p>

            {error && (
              <div role="alert" className="mt-4 rounded-xl bg-bad-subtle p-3.5 text-sm font-semibold text-bad-ink">
                {error}
              </div>
            )}

            <div className="mt-5 space-y-4">
              <PatientLookupFields idPrefix="request-patient" value={patient} onChange={setPatient} />
              <div>
                <label htmlFor="reason" className="field-label">
                  Clinical reason <span className="ml-1.5 font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id="reason"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  rows={3}
                  placeholder="State your clinical reason for requesting access"
                  className="field resize-none"
                />
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button type="button" onClick={() => { setShowForm(false); setError(""); }} className="btn btn-secondary flex-1">
                Cancel
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="btn btn-primary flex-1">
                {submitting ? "Submitting..." : "Submit request"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default DoctorAccessRequests;
