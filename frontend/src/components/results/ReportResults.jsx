import { useEffect, useState } from "react";
import { FlaskConical, CheckCircle2 } from "lucide-react";
import RangeBar from "./RangeBar";
import ResultStatus, { UncheckedPill } from "./ResultStatus";
import ConfirmValue from "./ConfirmValue";
import { bandFor, formatDay, formatRange, formatValue } from "../../utils/results";

/**
 * The values read from one lab report, each with a small range bar. Shown on the
 * patient's report page and the doctor's report viewer. `load` must be a stable
 * function (useCallback) that returns the API call. People allowed to check values
 * (`canConfirm`) can confirm or correct each one.
 */
export default function ReportResults({ token, load, canConfirm = false }) {
  const [data, setData] = useState(null);
  const [version, setVersion] = useState(0);
  const [checking, setChecking] = useState(null);

  useEffect(() => {
    let alive = true;
    load()
      .then((res) => alive && setData(res.data))
      .catch(() => alive && setData({ results: [] }));
    return () => {
      alive = false;
    };
  }, [load, version]);

  // Nothing to show for documents that are not lab reports, or before they are read.
  if (!data || !data.results?.length) return null;

  const unchecked = data.results.filter((r) => r.result.status === "unconfirmed" && !r.derived).length;
  const outside = data.results.filter((r) => r.result.flag !== "normal").length;

  return (
    <section className="card card-pad" aria-labelledby="report-results-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="report-results-heading" className="display flex items-center gap-2.5 text-xl text-ink">
            <FlaskConical aria-hidden="true" size={22} className="text-brand" />
            Results
          </h2>
          <p className="mt-1 text-sm text-muted">
            {data.collected_on ? `Collected ${formatDay(data.collected_on)}` : "Collection date not found"}
            {data.lab_name ? ` · ${data.lab_name}` : ""}
            {` · ${data.results.length} values, ${outside} outside the range`}
          </p>
        </div>
      </div>

      {canConfirm && unchecked > 0 && (
        <p className="card-inset mt-4 p-3.5 text-sm leading-6 text-ink-soft">
          These values were read automatically. Compare them with the report and confirm or correct them,
          so summaries and trends can rely on them.
        </p>
      )}

      <ul className="mt-4 divide-y divide-line">
        {data.results.map((r) => {
          const res = r.result;
          return (
            <li key={res.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_minmax(0,1.3fr)_auto] md:items-center">
              <div className="min-w-0">
                <p className="font-bold text-ink">{r.name}</p>
                <p className="text-xs text-muted">
                  Range {formatRange(res.ref_low, res.ref_high, r.decimals) || "not given"}
                  {res.ref_source === "standard" ? " (standard)" : ""}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg font-bold text-ink">
                  {formatValue(res.value, r.decimals)} <span className="text-sm font-normal text-muted">{r.unit}</span>
                </span>
                <ResultStatus label={r.status_label} flag={res.flag} band={bandFor(r.bands, res.value)} />
              </div>
              <RangeBar
                compact
                name={r.name}
                value={res.value}
                flag={res.flag}
                low={res.ref_low}
                high={res.ref_high}
                unit={r.unit}
                decimals={r.decimals}
                bands={r.bands}
                critical={r.critical}
              />
              <div className="flex items-center gap-2 md:justify-end">
                {res.status !== "unconfirmed" ? (
                  <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok-ink">
                    <CheckCircle2 aria-hidden="true" size={14} />
                    {res.status === "corrected" ? "Corrected" : "Checked"}
                  </span>
                ) : (
                  <>
                    {!res.trusted && <UncheckedPill />}
                    {canConfirm && (
                      <button
                        type="button"
                        className={`btn btn-sm ${res.trusted ? "btn-ghost" : "btn-secondary"}`}
                        onClick={() => setChecking(r)}
                      >
                        Check
                      </button>
                    )}
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {checking && (
        <ConfirmValue
          token={token}
          result={checking.result}
          test={checking}
          printed={checking.extracted_value}
          onClose={() => setChecking(null)}
          onDone={() => {
            setChecking(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </section>
  );
}
