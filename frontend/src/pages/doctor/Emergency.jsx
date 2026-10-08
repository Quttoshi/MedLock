import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Siren, Phone, ShieldAlert } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getEmergencyEligibility, startEmergency, getActiveEmergencies, endEmergency } from "../../api/emergency";
import { CNIC_PLACEHOLDER, formatCnicInput, isValidCnic, todayIso } from "../../utils/cnic";
import { parseServerDate } from "../../utils/dates";

const MIN_JUSTIFICATION = 20;

const formatTime = (value) =>
  parseServerDate(value).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

const EMPTY_FORM = { cnic: "", dob: "", hospital: "", reason: "", justification: "", declaration: false };

// One patient under emergency access: who they are, who to call, and how long access lasts.
function ActiveEmergency({ access, onEnd, ending }) {
  const p = access.patient;
  return (
    <article className="card border-bad/40 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-base font-bold text-ink">{p.name}</p>
          <p className="text-sm text-muted">
            {[p.age != null && `${p.age} years`, p.gender, p.blood_group && `Blood group ${p.blood_group}`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-1 text-[13px] text-muted">
            {access.reason} at {access.hospital} · until {formatTime(access.expires_at)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link to={`/doctor/patients/${p.id}/reports`} className="btn btn-primary btn-sm">Open records</Link>
          <button type="button" onClick={() => onEnd(access)} disabled={ending} className="btn btn-ghost btn-sm">
            {ending ? "Ending..." : "End access"}
          </button>
        </div>
      </div>
      <div className="card-inset mt-3 flex items-center gap-2 px-3.5 py-2.5 text-sm">
        <Phone aria-hidden="true" size={16} className="text-brand" />
        {p.emergency_contact_name || p.emergency_contact_phone ? (
          <span>
            Emergency contact: <span className="font-bold text-ink">{p.emergency_contact_name || "Not named"}</span>
            {p.emergency_contact_phone && (
              <a href={`tel:${p.emergency_contact_phone}`} className="link ml-2 font-mono">{p.emergency_contact_phone}</a>
            )}
          </span>
        ) : (
          <span className="text-muted">The patient has not given an emergency contact.</span>
        )}
      </div>
    </article>
  );
}

function Emergency() {
  const { token } = useAuth();
  const [eligibility, setEligibility] = useState(null);
  const [active, setActive] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [ending, setEnding] = useState(null);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      Promise.all([getEmergencyEligibility(token), getActiveEmergencies(token)])
        .then(([elig, act]) => {
          setEligibility(elig.data);
          setActive(act.data);
        })
        .catch(() => setEligibility(null)),
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  const set = (field) => (e) =>
    setForm({ ...form, [field]: field === "declaration" ? e.target.checked : e.target.value });

  // A doctor at a single hospital doesn't need to choose it.
  const hospital = form.hospital || (eligibility?.hospitals.length === 1 ? eligibility.hospitals[0].id : "");
  const ready =
    isValidCnic(form.cnic) && form.dob && hospital && form.reason &&
    form.justification.trim().length >= MIN_JUSTIFICATION && form.declaration;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await startEmergency(token, {
        patient_cnic: form.cnic,
        patient_dob: form.dob,
        medical_center_id: hospital,
        reason_code: form.reason,
        justification: form.justification.trim(),
        declaration: form.declaration,
      });
      setForm(EMPTY_FORM);
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not start emergency access.");
    }
    setBusy(false);
  };

  const end = async (access) => {
    setEnding(access.id);
    try {
      await endEmergency(token, access.id);
      await load();
    } catch {
      setError("Could not end emergency access.");
    }
    setEnding(null);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="display flex items-center gap-3 text-[28px] leading-[1.15] text-ink sm:text-[32px]">
          <Siren aria-hidden="true" size={28} className="text-bad-ink" />
          Emergency <em>access</em>
        </h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Only when a patient cannot consent and delay would put them at risk. Access lasts 24 hours and is read-only.
          The patient, MedLock's administrators and your hospital are told immediately, and every report you open is
          recorded on the blockchain.
        </p>
      </div>

      {active.length > 0 && (
        <section aria-labelledby="active-heading" className="space-y-3">
          <h2 id="active-heading" className="eyebrow">Active emergency access</h2>
          {active.map((a) => (
            <ActiveEmergency key={a.id} access={a} onEnd={end} ending={ending === a.id} />
          ))}
        </section>
      )}

      {eligibility && !eligibility.can_use ? (
        <div className="flex gap-3 rounded-2xl bg-warn-subtle p-5 text-warn-ink">
          <ShieldAlert aria-hidden="true" size={20} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm leading-6">{eligibility.reason}</p>
        </div>
      ) : eligibility && (
        <form onSubmit={submit} className="card card-pad space-y-4">
          <h2 className="display text-xl text-ink">Find the patient</h2>
          <p className="text-sm text-muted">Use the CNIC and date of birth on the card the patient carries.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="em-cnic" className="field-label">CNIC / B-Form / NICOP</label>
              <input
                id="em-cnic"
                inputMode="numeric"
                value={form.cnic}
                onChange={(e) => setForm({ ...form, cnic: formatCnicInput(e.target.value) })}
                placeholder={CNIC_PLACEHOLDER}
                className="field font-mono"
              />
            </div>
            <div>
              <label htmlFor="em-dob" className="field-label">Date of birth</label>
              <input id="em-dob" type="date" max={todayIso()} value={form.dob} onChange={set("dob")} className="field" />
            </div>
          </div>

          {eligibility.hospitals.length > 1 && (
            <div>
              <label htmlFor="em-hospital" className="field-label">Hospital you are at</label>
              <select id="em-hospital" value={form.hospital} onChange={set("hospital")} className="field">
                <option value="">Choose a hospital</option>
                {eligibility.hospitals.map((h) => (
                  <option key={h.id} value={h.id}>{h.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="em-reason" className="field-label">Reason</label>
            <select id="em-reason" value={form.reason} onChange={set("reason")} className="field">
              <option value="">Why can't the patient consent?</option>
              {eligibility.reasons.map((r) => (
                <option key={r.code} value={r.code}>{r.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="em-justification" className="field-label">Justification</label>
            <textarea
              id="em-justification"
              rows={3}
              value={form.justification}
              onChange={set("justification")}
              placeholder="e.g. Brought in unconscious after a road accident; need medical history urgently."
              className="field resize-none"
            />
            <p className="field-hint">
              At least {MIN_JUSTIFICATION} characters. The patient and administrators will read this.
            </p>
          </div>
          <label className="flex items-start gap-2.5 text-sm leading-6 text-ink-soft">
            <input type="checkbox" checked={form.declaration} onChange={set("declaration")} className="mt-1.5" />
            I confirm the patient cannot consent and that delaying would put their health at risk.
          </label>

          {error && <p role="alert" className="text-sm font-semibold text-bad-ink">{error}</p>}
          <button type="submit" disabled={busy || !ready} className="btn btn-danger w-full">
            {busy ? "Opening records..." : "Use emergency access"}
          </button>
          <p className="text-center text-[13px] text-muted">
            Used {eligibility.used_today} of {eligibility.daily_limit} times in the last 24 hours.
          </p>
        </form>
      )}
    </div>
  );
}

export default Emergency;
