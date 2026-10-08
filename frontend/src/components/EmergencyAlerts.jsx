import { useEffect, useState } from "react";
import { Siren, FileText, Flag } from "lucide-react";
import { getMyEmergencies, endEmergencyAsPatient, reportEmergencyMisuse } from "../api/patient";
import { parseServerDate } from "../utils/dates";
import StatusPill from "./ui/StatusPill";

// Emergency accesses are shown while active and for a week afterwards.
const RECENT_DAYS = 7;

const formatTime = (value) =>
  parseServerDate(value).toLocaleString("en-PK", {
    day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

/**
 * Tells the patient when a doctor opened their records in an emergency: who, where, why,
 * and exactly which reports were read. The patient can end it early or report misuse.
 */
function EmergencyAlerts({ token }) {
  const [accesses, setAccesses] = useState([]);
  const [flagging, setFlagging] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  // Fixed when the list loads, so "recent" doesn't shift while the page is open
  const [loadedAt, setLoadedAt] = useState(0);

  useEffect(() => {
    if (!token) return;
    getMyEmergencies(token)
      .then((res) => {
        setAccesses(res.data);
        setLoadedAt(Date.now());
      })
      .catch(() => setAccesses([]));
  }, [token]);

  const replace = (updated) => setAccesses((list) => list.map((a) => (a.id === updated.id ? { ...a, ...updated } : a)));

  const end = async (access) => {
    setBusy(access.id);
    setError("");
    try {
      replace((await endEmergencyAsPatient(token, access.id)).data);
    } catch {
      setError("Could not end the emergency access.");
    }
    setBusy(null);
  };

  const flag = async (access) => {
    setBusy(access.id);
    setError("");
    try {
      replace((await reportEmergencyMisuse(token, access.id, note.trim())).data);
      setFlagging(null);
      setNote("");
    } catch {
      setError("Could not send your report.");
    }
    setBusy(null);
  };

  const recent = accesses.filter(
    (a) => a.status === "active" || loadedAt - parseServerDate(a.started_at).getTime() < RECENT_DAYS * 86400000
  );
  if (recent.length === 0) return null;

  return (
    <section id="emergency" aria-labelledby="emergency-heading" className="mb-6 space-y-3 scroll-mt-24">
      <h2 id="emergency-heading" className="sr-only">Emergency access to your records</h2>
      {recent.map((a) => (
        <article key={a.id} className={`card p-5 ${a.status === "active" ? "border-bad/50 bg-bad-subtle/40" : ""}`}>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <p className="flex items-start gap-2.5 text-sm leading-6 text-ink-soft">
              <Siren aria-hidden="true" size={20} className="mt-0.5 flex-shrink-0 text-bad-ink" />
              <span>
                <span className="font-bold text-ink">Dr. {a.doctor_name}</span>
                {a.doctor_specialization && ` (${a.doctor_specialization})`} used <strong>emergency access</strong> to
                your records at <strong>{a.hospital}</strong> on {formatTime(a.started_at)}.
                <span className="block">Reason: {a.reason}. &ldquo;{a.justification}&rdquo;</span>
              </span>
            </p>
            <StatusPill tone={a.status === "active" ? "bad" : "plain"}>
              {a.status === "active" ? `Active until ${formatTime(a.expires_at)}` : a.status === "ended" ? "Ended" : "Expired"}
            </StatusPill>
          </div>

          <div className="mt-3 pl-7">
            <p className="text-[13px] font-bold text-ink">
              Reports opened{a.reports_opened.length ? ` (${a.reports_opened.length})` : ""}
            </p>
            {a.reports_opened.length === 0 ? (
              <p className="text-[13px] text-muted">None so far.</p>
            ) : (
              <ul className="mt-1 space-y-0.5">
                {a.reports_opened.map((r) => (
                  <li key={r.id} className="flex items-center gap-1.5 text-[13px] text-ink-soft">
                    <FileText aria-hidden="true" size={13} />
                    {r.filename} <span className="text-muted">· {formatTime(r.first_viewed_at)}</span>
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-1 text-[13px] text-muted">Each report opened is recorded on the blockchain.</p>

            {a.flagged_at ? (
              <p className="mt-3 text-[13px] font-semibold text-warn-ink">
                You reported this as possible misuse. {a.reviewed_at ? "An administrator has reviewed it." : "An administrator will review it."}
              </p>
            ) : flagging === a.id ? (
              <div className="mt-3 space-y-2">
                <label htmlFor={`flag-${a.id}`} className="field-label">Why wasn't this a real emergency?</label>
                <textarea id={`flag-${a.id}`} rows={2} value={note} onChange={(e) => setNote(e.target.value)} className="field resize-none" />
                <div className="flex gap-2">
                  <button type="button" onClick={() => flag(a)} disabled={busy === a.id || !note.trim()} className="btn btn-danger btn-sm">
                    Send report
                  </button>
                  <button type="button" onClick={() => setFlagging(null)} className="btn btn-ghost btn-sm">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {a.status === "active" && (
                  <button type="button" onClick={() => end(a)} disabled={busy === a.id} className="btn btn-danger btn-sm">
                    {busy === a.id ? "Ending..." : "End access now"}
                  </button>
                )}
                <button type="button" onClick={() => { setFlagging(a.id); setNote(""); }} className="btn btn-ghost btn-sm">
                  <Flag aria-hidden="true" size={15} />
                  Report misuse
                </button>
              </div>
            )}
          </div>
        </article>
      ))}
      {error && <p role="alert" className="text-sm font-semibold text-bad-ink">{error}</p>}
    </section>
  );
}

export default EmergencyAlerts;
