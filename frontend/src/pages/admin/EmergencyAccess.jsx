import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Flag, Siren } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getEmergencyAccesses, reviewEmergencyAccess } from "../../api/admin";
import StatusPill from "../../components/ui/StatusPill";
import { parseServerDate } from "../../utils/dates";

const formatTime = (value) =>
  value
    ? parseServerDate(value).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
    : "-";

const STATE_TONE = { active: "bad", ended: "plain", expired: "plain" };

/**
 * Every "break the glass" access, with patients' misuse reports awaiting review first.
 * Misuse can be followed up by removing the doctor's verification on the Doctors page.
 */
function EmergencyAccess() {
  const { token } = useAuth();
  const [accesses, setAccesses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(
    () =>
      getEmergencyAccesses(token)
        .then((res) => setAccesses(res.data))
        .catch(() => setAccesses([]))
        .finally(() => setLoading(false)),
    [token]
  );

  useEffect(() => {
    load();
  }, [load]);

  const review = async () => {
    setBusy(true);
    setError("");
    try {
      await reviewEmergencyAccess(token, reviewing.id, note.trim());
      setReviewing(null);
      await load();
    } catch (err) {
      const detail = err?.response?.data?.detail;
      setError(typeof detail === "string" ? detail : "Could not save the review.");
    }
    setBusy(false);
  };

  const awaiting = accesses.filter((a) => a.flagged_at && !a.reviewed_at).length;

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="display flex items-center gap-3 text-[28px] leading-[1.15] text-ink sm:text-[32px]">
        <Siren aria-hidden="true" size={28} className="text-bad-ink" />
        Emergency <em>access</em>
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted">
        Every time a doctor opened a patient's records without consent. Review the ones patients reported as misuse;
        if it was misuse, remove the doctor's verification on the <Link to="/admin/doctors" className="link">Doctors</Link> page.
      </p>
      {awaiting > 0 && (
        <p className="mt-4 inline-flex items-center gap-2 rounded-full bg-warn-subtle px-4 py-2 text-sm font-semibold text-warn-ink">
          <Flag aria-hidden="true" size={15} />
          {awaiting} misuse report{awaiting > 1 ? "s" : ""} to review
        </p>
      )}

      {loading ? (
        <p className="mt-10 text-center text-muted">Loading...</p>
      ) : accesses.length === 0 ? (
        <div className="card card-pad mt-6 text-center text-sm text-muted">No emergency access has been used.</div>
      ) : (
        <ul className="mt-6 space-y-3">
          {accesses.map((a) => (
            <li key={a.id} className={`card p-5 ${a.flagged_at && !a.reviewed_at ? "border-warn/60" : ""}`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm text-ink-soft">
                    <span className="font-bold text-ink">Dr. {a.doctor_name}</span> opened{" "}
                    <span className="font-bold text-ink">{a.patient_name}</span>'s records at {a.hospital}
                  </p>
                  <p className="text-[13px] text-muted">{formatTime(a.started_at)} · {a.reason}</p>
                  <p className="mt-1.5 text-sm text-ink-soft">&ldquo;{a.justification}&rdquo;</p>
                  <p className="mt-1.5 text-[13px] text-muted">
                    Reports opened: {a.reports_opened.length ? a.reports_opened.map((r) => r.filename).join(", ") : "none"}
                  </p>
                </div>
                <StatusPill tone={STATE_TONE[a.status] ?? "plain"}>
                  <span className="capitalize">{a.status}</span>
                </StatusPill>
              </div>

              {a.flagged_at && (
                <div className="card-inset mt-3 p-3.5 text-sm">
                  <p className="font-bold text-warn-ink">Patient reported misuse · {formatTime(a.flagged_at)}</p>
                  <p className="mt-1 text-ink-soft">&ldquo;{a.flag_note}&rdquo;</p>
                  {a.reviewed_at ? (
                    <p className="mt-2 text-ok-ink">Reviewed {formatTime(a.reviewed_at)}: {a.review_note}</p>
                  ) : (
                    <button
                      type="button"
                      onClick={() => { setReviewing(a); setNote(""); setError(""); }}
                      className="btn btn-primary btn-sm mt-2"
                    >
                      Review
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div role="dialog" aria-modal="true" aria-labelledby="review-title" className="card card-lift w-full max-w-md p-6">
            <h2 id="review-title" className="display text-xl text-ink">Review emergency access</h2>
            <p className="mt-1 text-sm text-muted">
              Dr. {reviewing.doctor_name} at {reviewing.hospital}. For example, confirm with the hospital's emergency
              department log.
            </p>
            <label htmlFor="review-note" className="field-label mt-4">What you found</label>
            <textarea id="review-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className="field resize-none" />
            {error && <p role="alert" className="mt-3 text-sm font-semibold text-bad-ink">{error}</p>}
            <div className="mt-5 flex gap-3">
              <button type="button" onClick={() => setReviewing(null)} className="btn btn-secondary flex-1">Cancel</button>
              <button type="button" onClick={review} disabled={busy || !note.trim()} className="btn btn-primary flex-1">
                {busy ? "Saving..." : "Save review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default EmergencyAccess;
