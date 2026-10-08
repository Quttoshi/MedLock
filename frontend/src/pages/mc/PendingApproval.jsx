import { useState } from "react";
import { Clock, ShieldAlert } from "lucide-react";
import { updateRegistration } from "../../api/medicalCenter";
import { REGULATORS, regulatorLabel } from "../../constants/regulators";
import { parseServerDate } from "../../utils/dates";

const formatDate = (value) =>
  value ? parseServerDate(value).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" }) : "-";

/**
 * Shown instead of the center pages until an admin approves the center. A rejected
 * center (or one whose licence expired, or one registered before licence checks) can
 * correct its licence details and go back for review.
 */
function PendingApproval({ token, profile, onUpdated }) {
  const rejected = profile.status === "rejected";
  // Centers registered before licence checks have no regulator yet.
  const needsDetails = rejected || !profile.regulator;
  const [form, setForm] = useState({
    regulator: profile.regulator || "",
    license_number: profile.license_number || "",
    license_expires_at: profile.license_expires_at || "",
    address: profile.address || "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const set = (field) => (e) => setForm({ ...form, [field]: e.target.value });

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await updateRegistration(token, form);
      await onUpdated();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not save your licence details. Check every field.");
    }
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="display text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        {profile.name}
      </h1>

      {rejected ? (
        <div className="rounded-2xl bg-bad-subtle p-5 text-bad-ink">
          <p className="flex items-center gap-2 font-bold">
            <ShieldAlert aria-hidden="true" size={18} />
            Not approved
          </p>
          <p className="mt-1.5 text-sm leading-6">{profile.rejection_reason}</p>
          <p className="mt-1.5 text-sm leading-6">Correct your licence details below to be reviewed again.</p>
        </div>
      ) : (
        <div className="rounded-2xl bg-warn-subtle p-5 text-warn-ink">
          <p className="flex items-center gap-2 font-bold">
            <Clock aria-hidden="true" size={18} />
            {needsDetails ? "Licence details needed" : "Waiting for approval"}
          </p>
          <p className="mt-1.5 text-sm leading-6">
            {needsDetails
              ? "Add your regulator licence details so a MedLock administrator can check them."
              : "A MedLock administrator is checking your licence on your regulator's register. They may phone your center to confirm the registration. You will be notified when it is approved."}
          </p>
        </div>
      )}

      {needsDetails ? (
        <form onSubmit={submit} className="card card-pad space-y-4">
          <h2 className="display text-xl text-ink">Licence details</h2>
          <div>
            <label htmlFor="pa-regulator" className="field-label">Regulator</label>
            <select id="pa-regulator" value={form.regulator} onChange={set("regulator")} required className="field">
              <option value="">Select the regulator that licensed your center</option>
              {REGULATORS.map((r) => (
                <option key={r.value} value={r.value}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="pa-licence" className="field-label">Licence number</label>
            <input id="pa-licence" value={form.license_number} onChange={set("license_number")} required className="field font-mono" />
          </div>
          <div>
            <label htmlFor="pa-expiry" className="field-label">Licence valid until</label>
            <input id="pa-expiry" type="date" value={form.license_expires_at} onChange={set("license_expires_at")} required className="field" />
          </div>
          <div>
            <label htmlFor="pa-address" className="field-label">Address</label>
            <input id="pa-address" value={form.address} onChange={set("address")} required className="field" />
          </div>
          {error && <p role="alert" className="text-sm font-semibold text-bad-ink">{error}</p>}
          <button type="submit" disabled={busy} className="btn btn-primary w-full">
            {busy ? "Sending..." : "Send for review"}
          </button>
        </form>
      ) : (
        <section className="card card-pad">
          <h2 className="display text-xl text-ink">Your licence</h2>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex flex-wrap gap-2">
              <dt className="text-muted">Regulator</dt>
              <dd className="font-bold text-ink">{regulatorLabel(profile.regulator)}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-muted">Licence number</dt>
              <dd className="font-mono text-ink">{profile.license_number}</dd>
            </div>
            <div className="flex flex-wrap gap-2">
              <dt className="text-muted">Valid until</dt>
              <dd className="text-ink">{formatDate(profile.license_expires_at)}</dd>
            </div>
          </dl>
        </section>
      )}
    </div>
  );
}

export default PendingApproval;
