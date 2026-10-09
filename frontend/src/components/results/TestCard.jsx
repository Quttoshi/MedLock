import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import RangeBar from "./RangeBar";
import TrendChart from "./TrendChart";
import ResultStatus, { UncheckedPill } from "./ResultStatus";
import ChangeChip from "./ChangeChip";
import { formatDay, formatValue } from "../../utils/results";

/**
 * One test on the Trends page: latest value in plain words, where it sits on the
 * range, how it moved, and a small chart of its history.
 */
export default function TestCard({ test, to }) {
  const latest = test.latest;
  if (!latest) return null;
  return (
    <article className="card flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-base font-bold text-ink">{test.name}</h3>
          {test.about && <p className="mt-0.5 text-xs leading-5 text-muted">{test.about}</p>}
        </div>
        {test.derived && <span className="pill pill-plain flex-shrink-0">Calculated</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="display text-[28px] leading-none text-ink">
          {formatValue(latest.value, test.decimals)}
          <span className="ml-1 font-sans text-sm font-normal text-muted">{test.unit}</span>
        </p>
        <ResultStatus label={test.status_label} flag={latest.flag} band={test.band} />
        {!latest.trusted && <UncheckedPill />}
      </div>
      <p className="mt-1.5 text-xs text-muted">
        {formatDay(latest.date)}
        {latest.lab_name ? ` · ${latest.lab_name}` : ""}
      </p>

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

      {test.points.length > 1 && (
        <>
          <ChangeChip change={test.change} decimals={test.decimals} />
          <div className="mt-2">
            <TrendChart test={test} compact height={64} />
          </div>
        </>
      )}

      <Link to={to} className="link mt-auto inline-flex items-center gap-1 pt-3 text-sm">
        {test.points.length > 1 ? `All ${test.points.length} results` : "Details"}
        <ChevronRight aria-hidden="true" size={16} />
      </Link>
    </article>
  );
}
