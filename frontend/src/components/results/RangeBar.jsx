import { flagTone, flagWord, formatRange, formatValue, scaleFor } from "../../utils/results";
import "../../styles/charts.css";

const SEG = { ok: "viz-seg-ok", warn: "viz-seg-warn", bad: "viz-seg-bad" };
// In range sits in the chart colour; only a value outside the range goes amber or red.
const MARK = { ok: "viz-mark-series", warn: "viz-mark-warn", bad: "viz-mark-bad" };

// Bands include their lower bound: an HbA1c of 6.5 is in the diabetes range.
function bandRange(b, decimals) {
  if (b.low == null) return `below ${formatValue(b.high, decimals)}`;
  if (b.high == null) return `${formatValue(b.low, decimals)} or above`;
  return `${formatValue(b.low, decimals)} to under ${formatValue(b.high, decimals)}`;
}

function segmentsFor({ min, max, low, high, bands, critical }) {
  const segs = [];
  const add = (from, to, tone, label) => {
    const a = Math.max(min, from ?? min);
    const b = Math.min(max, to ?? max);
    if (b > a) segs.push({ from: a, to: b, tone, label });
  };
  if (bands?.length) {
    // Guideline bands (HbA1c, eGFR, LDL...) say more than a single normal range.
    bands.forEach((b) => add(b.low, b.high, b.tone, b.label));
    return segs;
  }
  add(min, low ?? min, "warn", "Below range");
  add(low ?? min, high ?? max, "ok", "In range");
  add(high ?? max, max, "warn", "Above range");
  if (critical?.low != null) add(min, critical.low, "bad", "Very low");
  if (critical?.high != null) add(critical.high, max, "bad", "Very high");
  return segs;
}

/**
 * A horizontal bar showing where a value sits: a quiet track with the range (or
 * the test's guideline bands) washed in, and a marker for the value.
 * Colour is never the only signal: the marker carries the number and the bar has
 * a text description for screen readers.
 */
export default function RangeBar({
  name, value, flag, low, high, unit, decimals = 1, bands = [], critical = {}, action = {}, compact = false,
}) {
  const { min, max } = scaleFor({ values: [value], low, high, bands, action });
  const pos = (x) => ((x - min) / (max - min)) * 100;
  const segs = segmentsFor({ min, max, low, high, bands, critical });
  const marker = Math.min(98, Math.max(2, pos(value)));
  const tone = flagTone(flag);
  const ticks = [...new Set(segs.slice(1).map((s) => s.from))];
  const actionLines = [action.low, action.high].filter((x) => x != null && x > min && x < max);

  const description = `${name ?? "Value"} ${formatValue(value, decimals)} ${unit ?? ""}, ${
    flagWord(flag)
  }${low != null || high != null ? `; range ${formatRange(low, high, decimals)}` : ""}`;

  return (
    <div role="img" aria-label={description} className={`range-bar ${compact ? "py-1" : "pt-6 pb-5"}`}>
      <div className={`viz-track relative w-full ${compact ? "h-2" : "h-2.5"}`}>
        {segs.map((s, i) => (
          <div
            key={i}
            title={s.label}
            className={`viz-seg absolute top-0 h-full ${SEG[s.tone] ?? SEG.ok}`}
            // The 2px taken off the width is the gap that separates touching
            // bands, so no border is needed to tell them apart.
            style={{ left: `${pos(s.from)}%`, width: `calc(${pos(s.to) - pos(s.from)}% - 2px)` }}
          />
        ))}
        {actionLines.map((x) => (
          <div
            key={x}
            title="Doctors usually act beyond this line"
            className="viz-action absolute -top-1 h-[calc(100%+8px)]"
            style={{ left: `${pos(x)}%` }}
          />
        ))}
        <div
          className={`viz-mark absolute top-1/2 -translate-x-1/2 -translate-y-1/2 ${MARK[tone]} ${
            compact ? "h-2.5 w-2.5" : "h-3.5 w-3.5"
          }`}
          style={{ left: `${marker}%` }}
        />
        {!compact && (
          <span
            className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-xs font-bold tabular-nums text-ink"
            style={{ left: `${marker}%` }}
          >
            {formatValue(value, decimals)}
          </span>
        )}
      </div>
      {!compact && (
        <div className="relative mt-1.5 h-4 text-[11px] tabular-nums text-muted">
          {ticks.map((x) => (
            <span key={x} className="absolute -translate-x-1/2 whitespace-nowrap" style={{ left: `${pos(x)}%` }}>
              {formatValue(x, decimals)}
            </span>
          ))}
        </div>
      )}
      {!compact && bands.length > 0 && (
        <p className="mt-1 text-xs leading-5 text-muted">
          {bands.map((b) => `${b.label}: ${bandRange(b, decimals)}`).join(" · ")}
        </p>
      )}
    </div>
  );
}
