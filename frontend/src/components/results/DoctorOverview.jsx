import { useEffect, useState } from "react";
import { AlertTriangle, Calculator, FlaskConical, Info } from "lucide-react";
import { getPatientOverview } from "../../api/results";
import ResultStatus, { UncheckedPill } from "./ResultStatus";
import ChangeChip from "./ChangeChip";
import { formatDay, formatValue } from "../../utils/results";

/**
 * The doctor's first look at a patient's labs: critical results pinned, calculated
 * values (eGFR stage, HbA1c category), the anaemia pattern, and the latest value of
 * every test by body system. `onOpenTest(code)` opens a test's trend.
 */
export default function DoctorOverview({ token, patientId, onOpenTest }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    getPatientOverview(token, patientId)
      .then((res) => setData(res.data))
      .catch(() => setFailed(true));
  }, [token, patientId]);

  if (failed) return <p role="alert" className="mt-6 text-bad-ink">Could not load lab results.</p>;
  if (!data) return <p className="mt-6 text-muted">Loading lab results...</p>;

  const p = data.patient;
  if (!data.panels.length) {
    return (
      <div className="card card-pad mt-6 text-center">
        <FlaskConical aria-hidden="true" size={28} className="mx-auto text-muted" />
        <p className="display mt-3 text-xl text-ink">No lab results</p>
        <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted">
          None of this patient's reports you can see contain lab values MedLock could read. Their reports are under
          the Reports tab.
        </p>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <p className="text-sm text-muted">
        {[p.age != null && `${p.age} years`, p.gender, p.blood_group && `Blood group ${p.blood_group}`]
          .filter(Boolean)
          .join(" · ") || "Age and sex not recorded, so eGFR cannot be calculated."}
      </p>

      {data.critical.length > 0 && (
        <section role="alert" className="rounded-card bg-bad-subtle p-5 text-bad-ink">
          <h2 className="flex items-center gap-2 font-bold">
            <AlertTriangle aria-hidden="true" size={18} />
            Critical values
          </h2>
          <ul className="mt-2 space-y-1 text-sm">
            {data.critical.map((c) => (
              <li key={c.code}>
                <strong>{c.name}</strong> {formatValue(c.value, c.decimals)} {c.unit} (
                {c.flag === "critical_low" ? "critically low" : "critically high"}), {formatDay(c.date)}
              </li>
            ))}
          </ul>
        </section>
      )}

      {(data.calculated.length > 0 || data.anaemia_pattern) && (
        <div className="grid gap-4 md:grid-cols-3">
          {data.calculated.map((c) => (
            <section key={c.code} className="card p-5">
              <p className="eyebrow flex items-center gap-1.5">
                <Calculator aria-hidden="true" size={14} />
                {c.name}
              </p>
              <p className="display mt-2 text-[28px] leading-none text-ink">
                {formatValue(c.value, c.code === "egfr" ? 0 : 1)}
                <span className="ml-1 font-sans text-sm font-normal text-muted">{c.unit}</span>
              </p>
              {c.label && <p className="mt-2 font-semibold text-ink">{c.label}</p>}
              <p className="mt-1 text-xs leading-5 text-muted">
                {c.basis}. {formatDay(c.date)}.
              </p>
            </section>
          ))}
          {data.anaemia_pattern && (
            <section className="card p-5">
              <p className="eyebrow flex items-center gap-1.5">
                <Info aria-hidden="true" size={14} />
                Red cell pattern
              </p>
              <p className="mt-2 font-semibold text-ink">{data.anaemia_pattern.label}</p>
              <p className="mt-1 text-xs leading-5 text-muted">From the latest haemoglobin and MCV on the same date.</p>
            </section>
          )}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {data.panels.map((panel) => (
          <section key={panel.code} className="card p-5" aria-labelledby={`ov-${panel.code}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 id={`ov-${panel.code}`} className="display text-lg text-ink">{panel.name}</h2>
              <p className="text-xs text-muted">
                {panel.in_range} in range{panel.outside ? `, ${panel.outside} outside` : ""}
              </p>
            </div>
            <ul className="mt-2 divide-y divide-line">
              {panel.tests.map((t) => (
                <li key={t.code}>
                  <button
                    type="button"
                    onClick={() => onOpenTest?.(t.code)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left hover:bg-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    <span className="min-w-[8rem] flex-1 text-sm font-semibold text-ink">{t.name}</span>
                    <span className="text-sm text-ink">
                      <strong>{formatValue(t.latest.value, t.decimals ?? 1)}</strong>{" "}
                      <span className="text-muted">{t.unit}</span>
                    </span>
                    <ResultStatus label={t.status_label} flag={t.latest.flag} band={t.band} />
                    {!t.latest.trusted && <UncheckedPill />}
                    <span className="w-full text-xs text-muted">
                      {formatDay(t.latest.date)}
                      {t.change && (
                        <>
                          {" · "}
                          <ChangeChip change={t.change} decimals={t.decimals ?? 1} />
                        </>
                      )}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
