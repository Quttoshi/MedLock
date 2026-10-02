import { useCallback, useEffect, useState } from "react";
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

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "—";

const errorText = (err, fallback) => {
  const detail = err.response?.data?.detail;
  return typeof detail === "string" ? detail : fallback;
};

// ── One pending request from an independent doctor ─────────────────────
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
    <div className="bg-gray-50 rounded-xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-800">{request.doctor_name}</p>
          <p className="text-xs text-gray-500">
            {request.doctor_email} · {request.specialization}
          </p>
          <p className="text-xs text-gray-500 mt-1">
            Submitted PMDC no. <span className="font-mono text-gray-800">{request.registration_number}</span>
            {" · "}registered with{" "}
            <span className="font-mono text-gray-800">{request.registered_license_number}</span>
            {!numbersMatch && <span className="text-red-600 font-medium"> (mismatch)</span>}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Stated expiry {formatDate(request.license_expires_at)} · requested {formatDate(request.submitted_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <a
            href={request.pmdc_register_url}
            target="_blank"
            rel="noopener noreferrer"
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-blue-700 hover:bg-blue-50"
          >
            Check on PMDC register ↗
          </a>
          {request.has_certificate && (
            <button
              onClick={openCertificate}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
            >
              View certificate
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Search the PMDC register by the registration number, confirm the licence is <b>Active</b>, and enter
        the expiry date it shows.
      </p>
      <div className="grid sm:grid-cols-2 gap-3 mt-2">
        <div className="flex flex-col gap-2">
          <label className="text-xs text-gray-600">
            Licence expiry (from register)
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
            />
          </label>
          <input
            type="text"
            placeholder="Note (optional)"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
          />
          <button
            disabled={busy || !expiry}
            onClick={() => act(() => approveVerificationRequest(token, request.id, expiry, note))}
            className="py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            Approve & verify
          </button>
        </div>
        <div className="flex flex-col gap-2 justify-end">
          <input
            type="text"
            placeholder="Reason for rejecting (shared with the doctor)"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            className="border border-gray-200 rounded-lg px-3 py-1.5 text-xs"
          />
          <button
            disabled={busy || !rejectReason.trim()}
            onClick={() => act(() => rejectVerificationRequest(token, request.id, rejectReason))}
            className="py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 disabled:opacity-50"
          >
            Reject
          </button>
        </div>
      </div>
      {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
    </div>
  );
}

// ── Dialog for the admin override (verify directly / remove verification) ──
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center px-4" role="dialog" aria-modal="true">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <h2 className="text-base font-semibold text-gray-800">
          {verifying ? "Verify" : "Remove verification for"} {doctor.name}
        </h2>
        <p className="text-xs text-gray-500 mt-1">
          {verifying
            ? "Doctors are normally verified by their medical center or through a PMDC verification request. Use this only for exceptions."
            : "The doctor will lose access to patient records until verified again."}{" "}
          The reason is recorded in the audit log and shared with the doctor.
        </p>
        <textarea
          rows={3}
          placeholder="Reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="mt-4 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        {verifying && (
          <label className="block text-xs text-gray-600 mt-3">
            Licence expiry (optional)
            <input
              type="date"
              value={expiry}
              onChange={(e) => setExpiry(e.target.value)}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm"
            />
          </label>
        )}
        {error && <p className="text-xs text-red-600 mt-2">{error}</p>}
        <div className="flex justify-end gap-2 mt-5">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg bg-gray-100 hover:bg-gray-200">
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={busy || !reason.trim()}
            className={`px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50 ${
              verifying ? "bg-green-600 hover:bg-green-700" : "bg-yellow-600 hover:bg-yellow-700"
            }`}
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
    <div className="max-w-6xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Doctors</h1>
        <p className="text-gray-500 text-sm mt-1">
          Affiliated doctors are verified by their medical center. Independent doctors request verification, which
          you check against the PMDC register.
        </p>
      </div>

      {/* Pending verification requests */}
      {requests.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-blue-100 p-6 mb-6">
          <h2 className="text-base font-semibold text-gray-700 mb-4 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-blue-500 inline-block" />
            License verification requests ({requests.length})
          </h2>
          <div className="space-y-4">
            {requests.map((req) => (
              <VerificationRequestCard key={req.id} request={req} token={token} onDone={refresh} />
            ))}
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 mb-6">
        {["all", "verified", "unverified"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition
              ${filter === f
                ? "bg-gray-500 text-white shadow-sm"
                : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
          >
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-x-auto">
        {loading ? (
          <div className="p-10 text-center text-gray-400 text-sm">Loading...</div>
        ) : doctors.length === 0 ? (
          <div className="p-10 text-center text-gray-400 text-sm">No doctors found.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Name</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Specialization</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">License</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Verification</th>
                <th className="text-left px-5 py-3 text-gray-500 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {doctors.map((doc) => (
                <tr key={doc.id} className="hover:bg-gray-50 transition align-top">
                  <td className="px-5 py-4">
                    <p className="font-medium text-gray-800">{doc.name}</p>
                    <p className="text-xs text-gray-500">{doc.email}</p>
                    {doc.medical_center_name && (
                      <p className="text-xs text-gray-400 mt-0.5">{doc.medical_center_name}</p>
                    )}
                  </td>
                  <td className="px-5 py-4 text-gray-500">{doc.specialization || "—"}</td>
                  <td className="px-5 py-4">
                    <p className="font-mono text-gray-700">{doc.license_number || "—"}</p>
                    {doc.license_expires_at && (
                      <p className="text-xs text-gray-400">Expires {formatDate(doc.license_expires_at)}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    <span
                      className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                        doc.is_verified ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {doc.is_verified ? "Verified" : doc.has_pending_request ? "Awaiting review" : "Unverified"}
                    </span>
                    {doc.is_verified && <p className="text-xs text-gray-500 mt-1.5">{doc.verification_label}</p>}
                    {doc.verification_note && (
                      <p className="text-xs text-gray-400 mt-0.5 max-w-xs">{doc.verification_note}</p>
                    )}
                  </td>
                  <td className="px-5 py-4">
                    {doc.is_verified ? (
                      <button
                        onClick={() => setOverride({ doctor: doc, mode: "revoke" })}
                        className="px-3 py-1.5 bg-yellow-100 text-yellow-700 text-xs rounded-lg hover:bg-yellow-200 transition"
                      >
                        Remove verification
                      </button>
                    ) : (
                      <button
                        onClick={() => setOverride({ doctor: doc, mode: "verify" })}
                        className="px-3 py-1.5 bg-green-600 text-white text-xs rounded-lg hover:bg-green-700 transition"
                      >
                        Verify
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

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
