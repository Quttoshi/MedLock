import { flagTone, flagWord, formatRange, formatValue, scaleFor } from "../../utils/results";

const FILL = { ok: "bg-ok-subtle", warn: "bg-warn-subtle", bad: "bg-bad-subtle" };
const MARK = { ok: "bg-ok", warn: "bg-warn", bad: "bg-bad" };

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
 * A horizontal bar showing where a value sits: coloured blocks for below, in and above
 * the range (or the test's guideline bands), and a marker for the value.
 * Colour is never the only signal: the marker carries the number and the bar has a
 * text description for screen readers.
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
    <div role="img" aria-label={description} className={compact ? "py-1" : "pt-6 pb-5"}>
      <div className={`relative w-full ${compact ? "h-2" : "h-3"}`}>
        <div className="absolute inset-0 flex overflow-hidden rounded-full">
          {segs.map((s, i) => (
            <div
              key={i}
              title={s.label}
              className={`absolute top-0 h-full ${FILL[s.tone] ?? FILL.ok}`}
              style={{ left: `${pos(s.from)}%`, width: `${pos(s.to) - pos(s.from)}%` }}
            />
          ))}
        </div>
        {actionLines.map((x) => (
          <div
            key={x}
            title="Doctors usually act beyond this line"
            className="absolute -top-1 h-[calc(100%+8px)] border-l border-dashed border-ink-soft"
            style={{ left: `${pos(x)}%` }}
          />
        ))}
        <div
          className={`absolute top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface ${MARK[tone]} ${
            compact ? "h-3 w-3" : "h-4 w-4"
          }`}
          style={{ left: `${marker}%` }}
        />
        {!compact && (
          <span
            className="absolute -top-6 -translate-x-1/2 whitespace-nowrap text-xs font-bold text-ink"
            style={{ left: `${marker}%` }}
          >
            {formatValue(value, decimals)}
          </span>
        )}
      </div>
      {!compact && (
        <div className="relative mt-1 h-4 text-[11px] text-muted">
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
