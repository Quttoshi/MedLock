import { useEffect, useState } from "react";
import { IdCard } from "lucide-react";
import { getMyIdentity, updateMyIdentity } from "../api/patient";
import { CNIC_PLACEHOLDER, formatCnicInput, isValidCnic, todayIso } from "../utils/cnic";
import { parseServerDate } from "../utils/dates";

/**
 * The patient's CNIC on their dashboard. Patients who registered before CNICs were
 * collected are asked to add it, so hospitals, labs and emergency doctors can find them.
 */
function IdentityCard({ token }) {
  const [identity, setIdentity] = useState(null);
  const [editing, setEditing] = useState(false);
  const [cnic, setCnic] = useState("");
  const [dob, setDob] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) return;
    getMyIdentity(token)
      .then((res) => setIdentity(res.data))
      .catch(() => setIdentity(null));
  }, [token]);

  if (!identity) return null;

  const startEditing = () => {
    setCnic("");
    setDob(identity.date_of_birth || "");
    setError("");
    setEditing(true);
  };

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      const res = await updateMyIdentity(token, cnic, dob);
      setIdentity(res.data);
      setEditing(false);
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not save your CNIC. Check the number and date.");
    }
    setBusy(false);
  };

  return (
    <section className={`card card-pad !p-5 ${identity.has_cnic ? "" : "border-warn/40"}`} aria-labelledby="identity-heading">
      <h2 id="identity-heading" className="flex items-center gap-2 text-sm font-bold text-ink">
        <IdCard aria-hidden="true" size={18} className="text-brand" />
        Your CNIC
      </h2>

      {!editing && identity.has_cnic && (
        <>
          <p className="mt-2 font-mono text-sm text-ink-soft">{identity.cnic_masked}</p>
          {identity.date_of_birth && (
            <p className="text-[13px] text-muted">
              Born{" "}
              {parseServerDate(identity.date_of_birth).toLocaleDateString("en-PK", { day: "numeric", month: "long", year: "numeric" })}
            </p>
          )}
          <p className="mt-2 text-[13px] leading-5 text-muted">
            Hospitals, labs and emergency doctors find your record with your CNIC and date of birth.
          </p>
          <button type="button" onClick={startEditing} className="btn btn-ghost btn-sm mt-2">Correct</button>
        </>
      )}

      {!editing && !identity.has_cnic && (
        <>
          <p className="mt-2 text-[13px] leading-5 text-ink-soft">
            Add your CNIC (or B-Form / NICOP) so hospitals and labs can send you reports, and so doctors can find your
            record in an emergency.
          </p>
          <button type="button" onClick={startEditing} className="btn btn-primary btn-sm mt-3 w-full">Add your CNIC</button>
        </>
      )}

      {editing && (
        <form onSubmit={save} className="mt-3 space-y-3">
          <div>
            <label htmlFor="id-cnic" className="field-label">CNIC / B-Form / NICOP</label>
            <input
              id="id-cnic"
              inputMode="numeric"
              value={cnic}
              onChange={(e) => setCnic(formatCnicInput(e.target.value))}
              placeholder={CNIC_PLACEHOLDER}
              className="field font-mono"
            />
          </div>
          <div>
            <label htmlFor="id-dob" className="field-label">Date of birth</label>
            <input id="id-dob" type="date" max={todayIso()} value={dob} onChange={(e) => setDob(e.target.value)} className="field" />
          </div>
          <p className="text-[13px] leading-5 text-muted">Stored encrypted. Only the last digits are ever shown.</p>
          {error && <p role="alert" className="text-sm font-semibold text-bad-ink">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={busy || !isValidCnic(cnic) || !dob} className="btn btn-primary btn-sm flex-1">
              {busy ? "Saving..." : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="btn btn-ghost btn-sm">Cancel</button>
          </div>
        </form>
      )}
    </section>
  );
}

export default IdentityCard;
