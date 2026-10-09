import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, Activity, ChevronRight, CircleDashed, CheckCircle2 } from "lucide-react";
import { getMySummary } from "../../api/results";
import ResultStatus from "./ResultStatus";
import ChangeChip from "./ChangeChip";
import { DISCLAIMER, formatDay, formatValue } from "../../utils/results";

function ResultLine({ item }) {
  return (
    <li>
      <Link
        to={`/patient/health/${item.code}`}
        className="flex items-center gap-3 rounded-2xl p-3 transition-colors hover:bg-inset focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-bold text-ink">{item.name}</span>
            <span className="text-sm text-ink-soft">
              {formatValue(item.value, item.decimals)} {item.unit}
            </span>
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-2">
            <ResultStatus label={item.status_label} flag={item.flag} />
            <ChangeChip change={item.change} decimals={item.decimals} />
          </span>
        </span>
        <ChevronRight aria-hidden="true" size={18} className="flex-shrink-0 text-muted" />
      </Link>
    </li>
  );
}

/**
 * Dashboard card: at most three results that need attention or changed notably, each
 * panel's status, and critical values pinned on top. Only values a person checked or
 * read exactly from a PDF count, so the card never rests on an OCR guess.
 */
export default function HealthGlance({ token }) {
  const [summary, setSummary] = useState(null);

  useEffect(() => {
    if (!token) return;
    getMySummary(token)
      .then((res) => setSummary(res.data))
      .catch(() => setSummary({ has_results: false }));
  }, [token]);

  // Nothing until there are lab results; the timeline already invites the first upload.
  if (!summary?.has_results) return null;

  const items = [...summary.needs_attention, ...summary.changes];

  return (
    <section aria-labelledby="glance-heading" className="card mb-6 p-5 sm:p-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="glance-heading" className="display flex items-center gap-2 text-xl text-ink">
          <Activity aria-hidden="true" size={22} className="text-brand" />
          Your lab results at a glance
        </h2>
        <Link to="/patient/health" className="link text-sm">
          See all trends
        </Link>
      </div>
      {summary.last_result_date && (
        <p className="mt-1 text-sm text-muted">Latest result {formatDay(summary.last_result_date)}</p>
      )}

      {summary.critical.map((c) => (
        <div key={c.code} role="alert" className="mt-4 flex gap-3 rounded-2xl bg-bad-subtle p-4 text-bad-ink">
          <AlertTriangle aria-hidden="true" size={20} className="mt-0.5 flex-shrink-0" />
          <p className="text-sm leading-6">
            <strong>
              {c.name} was {c.flag === "critical_low" ? "very low" : "very high"} ({formatValue(c.value, c.decimals)} {c.unit})
            </strong>{" "}
            on {formatDay(c.date)}. Values like this usually need prompt medical advice. If you have not
            already, contact your doctor.
          </p>
        </div>
      ))}

      {items.length > 0 ? (
        <>
          <h3 className="eyebrow mt-5">Worth a look</h3>
          <ul className="mt-1 -mx-3">
            {items.map((item) => (
              <ResultLine key={item.code} item={item} />
            ))}
          </ul>
        </>
      ) : (
        summary.all_in_range && (
          <p className="mt-4 flex items-center gap-2 rounded-2xl bg-ok-subtle p-4 text-sm font-semibold text-ok-ink">
            <CheckCircle2 aria-hidden="true" size={18} />
            All your latest results are within range.
          </p>
        )
      )}

      <h3 className="eyebrow mt-5">By body system</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {summary.panels.map((p) => (
          <li key={p.code}>
            <Link
              to={`/patient/health?panel=${p.code}`}
              className={`pill ${p.outside ? "pill-warn" : "pill-ok"} no-underline hover:opacity-90`}
            >
              {p.name}: {p.outside ? `${p.outside} outside range` : "all in range"}
            </Link>
          </li>
        ))}
      </ul>

      {summary.unconfirmed_count > 0 && (
        <p className="mt-4 flex items-start gap-2 text-sm leading-6 text-muted">
          <CircleDashed aria-hidden="true" size={16} className="mt-1 flex-shrink-0" />
          {summary.unconfirmed_count} {summary.unconfirmed_count === 1 ? "value was" : "values were"} read from
          photos or scans and not yet checked, so they are left out of this summary.
          <Link to="/patient/health" className="link whitespace-nowrap">Check them</Link>
        </p>
      )}
      <p className="mt-3 text-xs leading-5 text-muted">{DISCLAIMER}</p>
    </section>
  );
}
