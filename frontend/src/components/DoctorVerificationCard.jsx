import { useCallback, useEffect, useState } from "react";
import { ShieldCheck, Clock, ShieldAlert } from "lucide-react";
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
    <section className="card card-pad">
      <h2 className="display text-xl text-ink">License verification</h2>

      {info.is_verified ? (
        <div className="mt-4 rounded-2xl bg-ok-subtle p-4 text-ok-ink">
          <p className="flex items-center gap-2 text-sm font-bold">
            <ShieldCheck aria-hidden="true" size={18} />
            {info.label}
          </p>
          <p className="mt-1.5 text-sm">
            PMDC no. <span className="font-mono">{info.license_number}</span>
            {info.verified_at && ` · verified ${formatDate(info.verified_at)}`}
            {info.license_expires_at && ` · licence valid until ${formatDate(info.license_expires_at)}`}
          </p>
          <p className="mt-1.5 text-sm">Patients see this when you request access to their records.</p>
        </div>
      ) : pending ? (
        <div className="mt-4 rounded-2xl bg-warn-subtle p-4 text-warn-ink">
          <p className="flex items-center gap-2 text-sm font-bold">
            <Clock aria-hidden="true" size={18} />
            Verification request under review
          </p>
          <p className="mt-1.5 text-sm">
            Submitted {formatDate(latest.submitted_at)} for PMDC no.{" "}
            <span className="font-mono">{latest.registration_number}</span>. An administrator will check it on the
            PMDC register, and you will be notified of the result.
          </p>
        </div>
      ) : (
        <>
          {latest?.status === "rejected" && (
            <div className="mt-4 rounded-2xl bg-bad-subtle p-4 text-bad-ink">
              <p className="flex items-center gap-2 text-sm font-bold">
                <ShieldAlert aria-hidden="true" size={18} />
                Your last request was not approved
              </p>
              <p className="mt-1.5 text-sm">Reason: {latest.admin_note}</p>
            </div>
          )}
          {info.note && !latest && <p className="mt-3 text-sm text-muted">{info.note}</p>}
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            You need to be verified to open patient records. If you work at a hospital, request affiliation
            below and they will verify you. If you practise independently, ask MedLock to verify your PMDC
            registration instead.
          </p>
          <form onSubmit={submit} className="mt-5 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="pmdc" className="field-label">PMDC registration number</label>
              <input
                id="pmdc"
                type="text"
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                required
                className="field font-mono"
              />
            </div>
            <div>
              <label htmlFor="pmdc-expiry" className="field-label">
                Licence valid until <span className="ml-1.5 font-normal text-muted">(optional)</span>
              </label>
              <input
                id="pmdc-expiry"
                type="date"
                value={expiry}
                onChange={(e) => setExpiry(e.target.value)}
                className="field"
              />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="pmdc-cert" className="field-label">
                PMDC certificate <span className="ml-1.5 font-normal text-muted">(optional)</span>
              </label>
              <input
                id="pmdc-cert"
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={(e) => setCertificate(e.target.files[0] || null)}
                className="block w-full text-sm text-ink-soft file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-brand-subtle file:px-4 file:py-2.5 file:text-sm file:font-semibold file:text-brand"
              />
              <p className="field-hint">PDF, JPEG or PNG up to 5 MB. Stored encrypted.</p>
            </div>
            {error && <p role="alert" className="text-sm font-semibold text-bad-ink sm:col-span-2">{error}</p>}
            <div className="sm:col-span-2">
              <button type="submit" disabled={submitting || !registration.trim()} className="btn btn-primary">
                {submitting ? "Submitting..." : "Request verification"}
              </button>
            </div>
          </form>
        </>
      )}
    </section>
  );
}

export default DoctorVerificationCard;
