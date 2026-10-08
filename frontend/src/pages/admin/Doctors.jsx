import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileText } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import {
  approveVerificationRequest,
  getAdminDoctors,
  getVerificationCertificate,
  getVerificationRequests,
  rejectVerificationRequest,
  unverifyDoctor,
  verifyDoctor,
} from "../../api/admin";
import FilterChips from "../../components/ui/FilterChips";
import StatusPill from "../../components/ui/StatusPill";

const DOCTOR_FILTERS = ["all", "verified", "unverified"].map((f) => ({ value: f, label: f }));

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "-";

const errorText = (err, fallback) => {
  const detail = err.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
};

// One pending request from an independent doctor
function VerificationRequestCard({ request, token, onDone }) {
  const [expiry, setExpiry] = useState(request.license_expires_at || "");
  const [note, setNote] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const numbersMatch =
    request.registration_number.replace(/\s/g, "").toUpperCase() ===
    request.registered_license_number.replace(/\s/g, "").toUpperCase();

  const openCertificate = async () => {
    try {
      const res = await getVerificationCertificate(token, request.id);
      window.open(window.URL.createObjectURL(res.data), "_blank", "noopener");
    } catch {
      setError("Could not open the certificate.");
    }
  };

  const act = async (action) => {
    setBusy(true);
    setError("");
    try {
      await action();
      onDone();
    } catch (err) {
      setError(errorText(err, "Action failed. Please try again."));
    }
    setBusy(false);
  };

  return (
    <div className="card-inset p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-ink">{request.doctor_name}</p>
          <p className="text-sm text-muted">
            {request.doctor_email} · {request.specialization}
          </p>
          <p className="mt-2 text-sm text-ink-soft">
            Submitted PMDC no. <span className="font-mono text-ink">{request.registration_number}</span>
            {" · "}registered with{" "}
            <span className="font-mono text-ink">{request.registered_license_number}</span>
            {!numbersMatch && <span className="font-bold text-bad-ink"> (mismatch)</span>}
          </p>
          <p className="mt-0.5 text-sm text-muted">
            Stated expiry {formatDate(request.license_expires_at)} · requested {formatDate(request.submitted_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={request.pmdc_register_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-secondary btn-sm"
          >
            Check on PMDC register
            <ExternalLink aria-hidden="true" size={14} />
          </a>
          {request.has_certificate && (
            <button type="button" onClick={openCertificate} className="btn btn-secondary btn-sm">
              <FileText aria-hidden="true" size={14} />
              View certificate
            </button>
          )}
        </div>
      </div>

      <p className="mt-4 text-sm leading-5 text-muted">
        Search the PMDC register by the registration number, confirm the licence is <b>Active</b>, and enter
        the expiry date it shows.
      </p>
      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-2.5">
          <div>
            <label htmlFor={`exp-${request.id}`} className="field-label">Licence expiry (from register)</label>
            <input
              id={`exp-${request.id}`}
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="field"
            />
          </div>
          <div>
            <label htmlFor={`note-${request.id}`} className="field-label">Note (optional)</label>
            <input
              id={`note-${request.id}`}
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="field"
            />
          </div>
          <button
            type="button"
            disabled={busy || !expiry}
            onClick={() => act(() => approveVerificationRequest(token, request.id, expiry, note))}
            className="btn btn-primary btn-sm"
          >
            Approve &amp; verify
          </button>
        </div>
        <div className="flex flex-col justify-end gap-2.5">
          <div>
            <label htmlFor={`rej-${request.id}`} className="field-label">Reason for rejecting (shared with the doctor)</label>
            <input
              id={`rej-${request.id}`}
              type="text"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="field"
            />
          </div>
          <button
            type="button"
            disabled={busy || !rejectReason.trim()}
            onClick={() => act(() => rejectVerificationRequest(token, request.id, rejectReason))}
            className="btn btn-danger btn-sm"
          >
            Reject
          </button>
        </div>
      </div>
      {error && <p role="alert" className="mt-3 text-sm font-semibold text-bad-ink">{error}</p>}
    </div>
  );
}

// Dialog for the admin override (verify directly / remove verification)
function OverrideDialog({ doctor, mode, token, onClose, onDone }) {
  const [reason, setReason] = useState("");
  const [expiry, setExpiry] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const verifying = mode === "verify";

  const submit = async () => {
    setBusy(true);
    setError("");
    try {
      if (verifying) await verifyDoctor(token, doctor.id, reason, expiry);
      else await unverifyDoctor(token, doctor.id, reason);
      onDone();
    } catch (err) {
      setError(errorText(err, "Action failed. Please try again."));
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div role="dialog" aria-modal="true" aria-labelledby="override-title" className="card card-lift w-full max-w-md p-6">
        <h2 id="override-title" className="display text-xl text-ink">
          {verifying ? "Verify" : "Remove verification for"} {doctor.name}
        </h2>
        <p className="mt-1 text-sm leading-5 text-muted">
          {verifying
            ? "Doctors are normally verified by their medical center or through a PMDC verification request. Use this only for exceptions."
            : "The doctor will lose access to patient records until verified again."}{" "}
          The reason is recorded in the audit log and shared with the doctor.
        </p>
        <label htmlFor="override-reason" className="field-label mt-4">Reason</label>
        <textarea
          id="override-reason"
          rows={3}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="field resize-none"
        />
        {verifying && (
          <div className="mt-3">
            <label htmlFor="override-expiry" className="field-label">Licence expiry (optional)</label>
            <input
              id="override-expiry"
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="field"
            />
          </div>
        )}
        {error && <p role="alert" className="mt-3 text-sm font-semibold text-bad-ink">{error}</p>}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={busy || !reason.trim()}
            className={verifying ? "btn btn-primary" : "btn btn-danger"}
          >
            {verifying ? "Verify doctor" : "Remove verification"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Doctors() {
  const { token } = useAuth();
  const [doctors, setDoctors] = useState([]);
  const [requests, setRequests] = useState([]);
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [override, setOverride] = useState(null); // { doctor, mode }

  const fetchDoctors = useCallback(() => {
    const verified = filter === "verified" ? true : filter === "unverified" ? false : "";
    return getAdminDoctors(token, verified)
      .then((res) => setDoctors(res.data))
      .catch(() => setDoctors([]))
      .finally(() => setLoading(false));
  }, [token, filter]);

  const fetchRequests = useCallback(
    () =>
      getVerificationRequests(token)
        .then((res) => setRequests(res.data))
        .catch(() => setRequests([])),
    [token]
  );

  const refresh = useCallback(() => Promise.all([fetchDoctors(), fetchRequests()]), [fetchDoctors, fetchRequests]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <div className="mx-auto max-w-6xl">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        Verify <em>doctors</em>
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        Affiliated doctors are verified by their medical center. Independent doctors request verification, which
        you check against the PMDC register.
      </p>

      {/* Pending verification requests */}
      {requests.length > 0 && (
        <section className="card card-pad mt-8" aria-labelledby="requests-heading">
          <h2 id="requests-heading" className="display flex items-center gap-2 text-xl text-ink">
            License verification requests
            <span className="pill pill-warn">{requests.length}</span>
          </h2>
          <div className="mt-4 space-y-4">
            {requests.map((req) => (
              <VerificationRequestCard key={req.id} request={req} token={token} onDone={refresh} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-8">
        <FilterChips label="Filter doctors" options={DOCTOR_FILTERS} value={filter} onChange={setFilter} />
      </div>

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : doctors.length === 0 ? (
        <div className="card card-pad mt-6 text-center text-sm text-muted">No doctors found.</div>
      ) : (
        <div className="card mt-6 overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Doctors and their verification status</caption>
            <thead className="!bg-inset">
              <tr>
                {["Name", "Specialization", "License", "Verification", "Actions"].map((h) => (
                  <th key={h} scope="col" className="px-5 py-3 text-left text-[13px] font-bold !text-muted">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {doctors.map((doc) => (
                <tr key={doc.id} className="align-top">
                  <td className="px-5 py-4">
                    <p className="font-bold text-ink">{doc.name}</p>
                    <p className="text-sm text-muted">{doc.email}</p>
                    {doc.medical_center_name && (
                      <p className="mt-0.5 text-sm text-muted">{doc.medical_center_name}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 capitalize text-ink-soft">{doc.specialization || "-"}</td>
                  <td className="px-5 py-4">
                    <p className="font-mono text-[13px] text-ink-soft">{doc.license_number || "-"}</p>
                    {doc.license_expires_at && (
                      <p className="mt-0.5 text-sm text-muted">Expires {formatDate(doc.license_expires_at)}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <StatusPill tone={doc.is_verified ? "ok" : "warn"}>
                      {doc.is_verified ? "Verified" : doc.has_pending_request ? "Awaiting review" : "Unverified"}
                    </StatusPill>
                    {doc.is_verified && <p className="mt-1.5 text-sm text-ink-soft">{doc.verification_label}</p>}
                    {doc.verification_note && (
                      <p className="mt-0.5 max-w-xs text-sm text-muted">{doc.verification_note}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {doc.is_verified ? (
                      <button
                        type="button"
                        onClick={() => setOverride({ doctor: doc, mode: "revoke" })}
                        className="btn btn-secondary btn-sm whitespace-nowrap"
                      >
                        Remove verification
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setOverride({ doctor: doc, mode: "verify" })}
                        className="btn btn-primary btn-sm"
                      >
                        Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {override && (
        <OverrideDialog
          doctor={override.doctor}
          mode={override.mode}
          token={token}
          onClose={() => setOverride(null)}
          onDone={() => {
            setOverride(null);
            refresh();
          }}
        />
      )}
    </div>
  );
}

export default Doctors;
