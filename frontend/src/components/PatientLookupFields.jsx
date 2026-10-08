import { CNIC_PLACEHOLDER, formatCnicInput, todayIso } from "../utils/cnic";

/**
 * How a hospital, lab or doctor identifies a patient: by email, or by the CNIC (or
 * B-Form / NICOP) number and date of birth from their card. Both are needed together, so
 * a mistyped number never matches someone else.
 */
function PatientLookupFields({ idPrefix, value, onChange }) {
  const set = (patch) => onChange({ ...value, ...patch });
  return (
    <fieldset>
      <legend className="field-label">Find the patient by</legend>
      <div role="group" aria-label="Find the patient by" className="mb-3 inline-flex gap-1 rounded-full bg-inset p-1">
        {[
          { key: "email", label: "Email" },
          { key: "cnic", label: "CNIC + date of birth" },
        ].map((option) => (
          <button
            key={option.key}
            type="button"
            aria-pressed={value.mode === option.key}
            onClick={() => set({ mode: option.key })}
            className={`rounded-full px-4 py-1.5 text-sm font-bold transition-colors ${
              value.mode === option.key ? "bg-deep text-deep-on" : "text-muted hover:text-ink"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {value.mode === "email" ? (
        <div>
          <label htmlFor={`${idPrefix}-email`} className="sr-only">Patient email</label>
          <input
            id={`${idPrefix}-email`}
            type="email"
            value={value.email}
            onChange={(e) => set({ email: e.target.value })}
            placeholder="The patient's registered email"
            className="field"
          />
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor={`${idPrefix}-cnic`} className="field-label">CNIC / B-Form / NICOP</label>
            <input
              id={`${idPrefix}-cnic`}
              inputMode="numeric"
              value={value.cnic}
              onChange={(e) => set({ cnic: formatCnicInput(e.target.value) })}
              placeholder={CNIC_PLACEHOLDER}
              className="field font-mono"
            />
          </div>
          <div>
            <label htmlFor={`${idPrefix}-dob`} className="field-label">Date of birth</label>
            <input
              id={`${idPrefix}-dob`}
              type="date"
              max={todayIso()}
              value={value.dob}
              onChange={(e) => set({ dob: e.target.value })}
              className="field"
            />
          </div>
        </div>
      )}
    </fieldset>
  );
}

export default PatientLookupFields;
