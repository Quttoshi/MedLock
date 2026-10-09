import { useRef, useState } from "react";
import { useDismiss } from "../shell/useDismiss";
import { confirmResult } from "../../api/results";
import { formatDay, formatValue } from "../../utils/results";

/**
 * Check a value read from a report: confirm it matches, or correct it. Values are in
 * MedLock's unit for the test, which can differ from the report's (a TLC of 7,200/cumm
 * is 7.2 here), so the number as printed is shown when it differs.
 */
export default function ConfirmValue({ token, result, test, printed, onDone, onClose }) {
  const ref = useRef(null);
  const [correcting, setCorrecting] = useState(false);
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  useDismiss(ref, true, onClose);

  const decimals = test.decimals ?? 1;
  const save = (newValue) => {
    setSaving(true);
    setError("");
    confirmResult(token, result.id, newValue)
      .then((res) => onDone(res.data))
      .catch((err) => setError(err.response?.data?.detail || "Could not save. Please try again."))
      .finally(() => setSaving(false));
  };

  const submitCorrection = (e) => {
    e.preventDefault();
    const n = Number(value);
    if (value.trim() === "" || Number.isNaN(n)) {
      setError("Enter a number.");
      return;
    }
    save(n);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="confirm-value-title" className="card card-lift w-full max-w-md p-6">
        <h2 id="confirm-value-title" className="display text-xl text-ink">Check {test.name}</h2>
        <p className="mt-3 text-sm leading-6 text-ink-soft">
          MedLock read{" "}
          <strong className="text-ink">
            {formatValue(result.value, decimals)} {test.unit}
          </strong>
          {result.date ? ` from the report of ${formatDay(result.date)}` : " from this report"}.
          {printed != null && Number(printed) !== Number(result.value) && (
            <> The report prints it as <strong className="text-ink">{printed}</strong>, in a different unit.</>
          )}
        </p>
        <p className="mt-2 text-sm leading-6 text-ink-soft">Open the report and compare. Does it match?</p>

        {!correcting ? (
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" className="btn btn-primary" disabled={saving} onClick={() => save(undefined)}>
              Yes, it matches
            </button>
            <button type="button" className="btn btn-secondary" disabled={saving} onClick={() => setCorrecting(true)}>
              No, correct it
            </button>
            <button type="button" className="btn btn-ghost" onClick={onClose}>
              Cancel
            </button>
          </div>
        ) : (
          <form onSubmit={submitCorrection} className="mt-5">
            <label htmlFor="corrected-value" className="field-label">
              Correct value ({test.unit})
            </label>
            <input
              id="corrected-value"
              className="field"
              inputMode="decimal"
              autoFocus
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-invalid={error ? "true" : undefined}
            />
            <p className="field-hint">Enter it in {test.unit}, the unit MedLock uses for this test.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                Save correction
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCorrecting(false)}>
                Back
              </button>
            </div>
          </form>
        )}
        {error && <p role="alert" className="field-error">{error}</p>}
      </div>
    </div>
  );
}
