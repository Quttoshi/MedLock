import { useEffect, useState } from "react";
import { getPatientTrends } from "../../api/results";
import TrendChart from "./TrendChart";
import ResultStatus, { UncheckedPill } from "./ResultStatus";
import ChangeChip from "./ChangeChip";
import { formatDay, formatRange, formatValue, timeDomain } from "../../utils/results";

// Tests doctors usually read together.
const PRESETS = [
  { label: "Kidney", tests: ["creatinine", "egfr", "urea", "potassium"] },
  { label: "Diabetes", tests: ["hba1c", "glucose_fasting", "glucose_random"] },
  { label: "Anaemia", tests: ["hemoglobin", "mcv", "ferritin"] },
  { label: "Lipids", tests: ["ldl", "hdl", "triglycerides", "cholesterol_total"] },
  { label: "Liver", tests: ["alt", "ast", "alp", "bilirubin_total"] },
];

function defaultSelection(tests) {
  const have = new Set(tests.map((t) => t.code));
  const preset = PRESETS.find((p) => p.tests.some((c) => have.has(c)));
  return preset ? preset.tests.filter((c) => have.has(c)) : tests.slice(0, 3).map((t) => t.code);
}

/**
 * Stacked trend charts for the tests the doctor picks, on one shared time axis so
 * related tests (creatinine and eGFR, HbA1c and glucose) line up by date.
 */
export default function DoctorTrends({ token, patientId, focus }) {
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState(false);
  const [selected, setSelected] = useState(focus ? [focus] : null);

  useEffect(() => {
    getPatientTrends(token, patientId)
      .then((res) => setData(res.data))
      .catch(() => setFailed(true));
  }, [token, patientId]);

  if (failed) return <p role="alert" className="mt-6 text-bad-ink">Could not load trends.</p>;
  if (!data) return <p className="mt-6 text-muted">Loading trends...</p>;

  const tests = data.panels.flatMap((p) => p.tests);
  if (!tests.length) return <p className="card card-pad mt-6 text-sm text-muted">No lab results to show.</p>;

  const byCode = Object.fromEntries(tests.map((t) => [t.code, t]));
  const chosen = (selected ?? defaultSelection(tests)).filter((c) => byCode[c]);
  const shownTests = chosen.map((c) => byCode[c]);
  const xDomain = timeDomain(shownTests.flatMap((t) => t.points));
  const toggle = (code) =>
    setSelected(chosen.includes(code) ? chosen.filter((c) => c !== code) : [...chosen, code]);
  const available = (codes) => codes.filter((c) => byCode[c]);

  return (
    <div className="mt-6 grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
      <aside className="card p-4 lg:sticky lg:top-6" aria-label="Choose tests">
        <p className="eyebrow">Presets</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {PRESETS.filter((p) => available(p.tests).length).map((p) => (
            <button key={p.label} type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(available(p.tests))}>
              {p.label}
            </button>
          ))}
        </div>
        {data.panels.map((panel) => (
          <fieldset key={panel.code} className="mt-4">
            <legend className="eyebrow">{panel.name}</legend>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {panel.tests.map((t) => {
                const on = chosen.includes(t.code);
                return (
                  <button
                    key={t.code}
                    type="button"
                    aria-pressed={on}
                    onClick={() => toggle(t.code)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
                      on ? "border-deep bg-deep text-deep-on" : "border-line bg-surface text-ink-soft hover:border-line-strong"
                    }`}
                  >
                    {t.name}
                    {t.latest && t.latest.flag !== "normal" && <span className="ml-1" aria-label="outside range">•</span>}
                  </button>
                );
              })}
            </div>
          </fieldset>
        ))}
      </aside>

      <div className="min-w-0 space-y-4">
        {shownTests.length === 0 && <p className="card card-pad text-sm text-muted">Pick one or more tests to chart.</p>}
        {shownTests.map((t) => (
          <section key={t.code} className="card p-5" aria-labelledby={`trend-${t.code}`}>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
              <h2 id={`trend-${t.code}`} className="text-base font-bold text-ink">
                {t.name} <span className="font-normal text-muted">({t.unit})</span>
              </h2>
              {t.derived && <span className="pill pill-plain">Calculated from creatinine</span>}
              <span className="text-sm text-ink">
                Latest <strong>{formatValue(t.latest.value, t.decimals)}</strong>, {formatDay(t.latest.date)}
              </span>
              <ResultStatus label={t.status_label} flag={t.latest.flag} band={t.band} />
              {!t.latest.trusted && <UncheckedPill />}
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-muted">
              <span>
                Range {formatRange(t.latest.ref_low, t.latest.ref_high, t.decimals) || "not given"} · {t.points.length}{" "}
                {t.points.length === 1 ? "result" : "results"}
              </span>
              <ChangeChip change={t.change} decimals={t.decimals} />
            </p>
            <div className="mt-3">
              <TrendChart test={t} height={200} xDomain={xDomain} />
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
