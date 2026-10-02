import { useCallback, useEffect, useState } from "react";
import { getMyVerification, submitVerificationRequest } from "../api/doctor";

const formatDate = (value) =>
  value ? new Date(value).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }) : null;

// Shows the doctor's license verification status. Independent doctors (not verified
// through a hospital) can ask an admin to verify their PMDC registration from here.
function DoctorVerificationCard({ token }) {
  const [info, setInfo] = useState(null);
  const [registration, setRegistration] = useState("");
  const [expiry, setExpiry] = useState("");
  const [certificate, setCertificate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      getMyVerification(token)
        .then((res) => {
          setInfo(res.data);
          setRegistration((current) => current || res.data.license_number || "");
        })
        .catch(() => setInfo(null)),
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  const submit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const form = new FormData();
    form.append("registration_number", registration);
    if (expiry) form.append("license_expires_at", expiry);
    if (certificate) form.append("certificate", certificate);
    try {
      await submitVerificationRequest(token, form);
      setCertificate(null);
      await load();
    } catch (err) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not submit the request. Please try again.");
    }
    setSubmitting(false);
  };

  if (!info) return null;
  const latest = info.latest_request;
  const pending = latest?.status === "pending";

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-5">
      <h2 className="text-base font-semibold text-gray-700 mb-3">License verification</h2>

      {info.is_verified ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-800">
          <p className="font-semibold">✓ {info.label}</p>
          <p className="text-xs mt-1">
            PMDC no. <span className="font-mono">{info.license_number}</span>
            {info.verified_at && ` · verified ${formatDate(info.verified_at)}`}
            {info.license_expires_at && ` · licence valid until ${formatDate(info.license_expires_at)}`}
          </p>
          <p className="text-xs mt-1 text-green-700">
            Patients see this when you request access to their records.
          </p>
        </div>
      ) : pending ? (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-xl text-sm text-yellow-800">
          <p className="font-semibold">Verification request under review</p>
          <p className="text-xs mt-1">
            Submitted {formatDate(latest.submitted_at)} for PMDC no.{" "}
            <span className="font-mono">{latest.registration_number}</span>. An administrator will check it on the
            PMDC register; you'll be notified of the result.
          </p>
        </div>
      ) : (
        <>
          {latest?.status === "rejected" && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
              <p className="font-semibold">Your last request was not approved</p>
              <p className="text-xs mt-1">Reason: {latest.admin_note}</p>
            </div>
          )}
          {info.note && !latest && <p className="text-xs text-gray-500 mb-3">{info.note}</p>}
          <p className="text-sm text-gray-600 mb-4">
            You need to be verified to open patient records. If you work at a hospital, request affiliation
            below and they will verify you. If you practise independently, ask MedLock to verify your PMDC
            registration instead.
          </p>
          <form onSubmit={submit} className="grid sm:grid-cols-2 gap-3">
            <label className="text-xs text-gray-600">
              PMDC registration number
              <input
                type="text"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                required
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm font-mono"
              />
            </label>
            <label className="text-xs text-gray-600">
              Licence valid until (optional)
              <input
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="mt-1 w-full border border-gray-200 rounded-xl px-3 py-2 text-sm"
              />
            </label>
            <label className="text-xs text-gray-600 sm:col-span-2">
              PMDC certificate (optional, PDF/JPEG/PNG up to 5 MB, stored encrypted)
              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setCertificate(e.target.files[0] || null)}
                className="mt-1 block w-full text-sm"
              />
            </label>
            {error && <p className="text-xs text-red-600 sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={submitting || !registration.trim()}
                className="px-4 py-2 bg-green-700 text-white text-sm font-medium rounded-xl hover:bg-green-800 transition disabled:opacity-50"
              >
                {submitting ? "Submitting..." : "Request verification"}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

export default DoctorVerificationCard;
