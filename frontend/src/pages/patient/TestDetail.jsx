import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { getMyTest } from "../../api/results";
import RangeBar from "../../components/results/RangeBar";
import TrendChart from "../../components/results/TrendChart";
import ResultStatus, { UncheckedPill } from "../../components/results/ResultStatus";
import ChangeChip from "../../components/results/ChangeChip";
import ConfirmValue from "../../components/results/ConfirmValue";
import { DISCLAIMER, bandFor, flagWord, formatDay, formatRange, formatValue } from "../../utils/results";

// One test: its full history on a chart and in a table, with the report each value
// came from, and a way to check values read automatically.
function TestDetail() {
  const { code } = useParams();
  const { token } = useAuth();
  const [test, setTest] = useState(null);
  const [failed, setFailed] = useState(false);
  const [version, setVersion] = useState(0);
  const [checking, setChecking] = useState(null);

  useEffect(() => {
    if (!token) return;
    getMyTest(token, code)
      .then((res) => setTest(res.data))
      .catch(() => setFailed(true));
  }, [token, code, version]);

  const back = (
    <Link to="/patient/health" className="link inline-flex items-center gap-2 text-sm no-underline hover:underline">
      <ArrowLeft aria-hidden="true" size={16} />
      Back to health trends
    </Link>
  );

  if (failed) {
    return (
      <div className="mx-auto max-w-4xl">
        {back}
        <p className="mt-8 text-muted">This test could not be found.</p>
      </div>
    );
  }
  if (!test) return <p className="py-24 text-center text-muted">Loading...</p>;

  const latest = test.latest;
  const history = [...test.points].reverse();

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      {back}

      <section className="card card-pad">
        <p className="eyebrow">{test.derived ? "Calculated value" : "Lab test"}</p>
        <h1 className="display mt-2 text-[28px] leading-tight text-ink sm:text-[32px]">{test.name}</h1>
        {test.about && <p className="mt-2 text-sm leading-6 text-ink-soft">{test.about}</p>}

        {!latest ? (
          <p className="mt-6 text-muted">You have no results for this test yet.</p>
        ) : (
          <>
            <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2">
              <p className="display text-[40px] leading-none text-ink">
                {formatValue(latest.value, test.decimals)}
                <span className="ml-1.5 font-sans text-base font-normal text-muted">{test.unit}</span>
              </p>
              <ResultStatus label={test.status_label} flag={latest.flag} band={test.band} />
              {!latest.trusted && <UncheckedPill />}
            </div>
            <p className="mt-2 text-sm text-muted">
              Latest, {formatDay(latest.date)}
              {latest.lab_name ? ` · ${latest.lab_name}` : ""}
            </p>
            <div className="mt-1 max-w-xl">
              <RangeBar
                name={test.name}
                value={latest.value}
                flag={latest.flag}
                low={latest.ref_low}
                high={latest.ref_high}
                unit={test.unit}
                decimals={test.decimals}
                bands={test.bands}
                critical={test.critical}
                action={test.action}
              />
            </div>
            <ChangeChip change={test.change} decimals={test.decimals} />
          </>
        )}
      </section>

      {test.points.length > 1 && (
        <section className="card card-pad" aria-labelledby="chart-heading">
          <h2 id="chart-heading" className="display text-xl text-ink">Over time</h2>
          <p className="mt-1 text-sm text-muted">
            The shaded area is the {test.bands.length ? "guideline bands" : "lab's normal range"}. Hollow points are
            values not yet checked.
          </p>
          <div className="mt-4">
            <TrendChart test={test} height={280} />
          </div>
        </section>
      )}

      {history.length > 0 && (
        <section className="card card-pad" aria-labelledby="history-heading">
          <h2 id="history-heading" className="display text-xl text-ink">All results</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs text-muted">
                  <th scope="col" className="py-2 pr-3 font-semibold">Date</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Value</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Range</th>
                  <th scope="col" className="py-2 pr-3 font-semibold">Lab</th>
                  <th scope="col" className="py-2 font-semibold"><span className="sr-only">Checked and report</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {history.map((p) => (
                  <tr key={p.id}>
                    <td className="whitespace-nowrap py-3 pr-3 text-ink">{formatDay(p.date)}</td>
                    <td className="py-3 pr-3">
                      <span className="font-bold text-ink">{formatValue(p.value, test.decimals)}</span>{" "}
                      <span className="text-muted">{flagWord(p.flag)}</span>
                      {bandFor(test.bands, p.value) && (
                        <span className="block text-xs text-muted">{bandFor(test.bands, p.value).label}</span>
                      )}
                    </td>
                    <td className="whitespace-nowrap py-3 pr-3 text-muted">
                      {formatRange(p.ref_low, p.ref_high, test.decimals)}
                    </td>
                    <td className="py-3 pr-3 text-muted">{p.lab_name || "Unknown"}</td>
                    <td className="py-3">
                      <span className="flex flex-wrap items-center justify-end gap-2">
                        {p.derived_from ? (
                          <span className="text-xs text-muted">From {p.derived_from}</span>
                        ) : p.status !== "unconfirmed" ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-ok-ink">
                            <CheckCircle2 aria-hidden="true" size={14} />
                            {p.status === "corrected" ? "Corrected" : "Checked"}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`btn btn-sm ${p.trusted ? "btn-ghost" : "btn-secondary"}`}
                            onClick={() => setChecking(p)}
                          >
                            Check
                          </button>
                        )}
                        <Link to={`/patient/reports/${p.report_id}`} className="link whitespace-nowrap text-xs">
                          Report
                        </Link>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <p className="text-xs leading-5 text-muted">{DISCLAIMER}</p>

      {checking && (
        <ConfirmValue
          token={token}
          result={checking}
          test={test}
          onClose={() => setChecking(null)}
          onDone={() => {
            setChecking(null);
            setVersion((v) => v + 1);
          }}
        />
      )}
    </div>
  );
}

export default TestDetail;
