import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  dayTime, flagTone, flagWord, formatDay, formatMonth, formatValue, scaleFor, timeDomain,
} from "../../utils/results";
import "../../styles/charts.css";

// The shaded band behind the line. A wash, so the line stays the loudest thing.
const BAND = { ok: "viz-band-ok", warn: "viz-band-warn", bad: "viz-band-bad" };
// In range points take the line colour; only values outside the range take a
// status colour, so two greens never sit next to each other.
const POINT = { ok: "viz-pt-series", warn: "viz-pt-warn", bad: "viz-pt-bad" };

function PointTooltip({ active, payload, unit, decimals }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card card-lift px-3 py-2 text-xs">
      <p className="font-bold text-ink">
        {formatValue(p.value, decimals)} {unit}
      </p>
      <p className="text-muted">{formatDay(p.date)}{p.lab_name ? ` · ${p.lab_name}` : ""}</p>
      <p className="text-muted">{flagWord(p.flag)}</p>
      {p.derived_from && <p className="text-muted">Calculated from {p.derived_from}</p>}
      {!p.trusted && <p className="font-semibold text-warn-ink">Not yet checked</p>}
    </div>
  );
}

/**
 * A test's history: the normal range (or guideline bands) washed in behind the
 * line, points coloured only when they fall outside the range, and hollow
 * points for values nobody has checked yet. The last point is drawn larger so
 * the eye lands on the current value.
 * `compact` draws a small sparkline without axes for cards.
 */
export default function TrendChart({ test, points, height = 240, compact = false, xDomain, showKey = true }) {
  const data = (points ?? test.points ?? []).map((p) => ({ ...p, t: dayTime(p.date) }));
  if (!data.length) return null;
  const latest = data[data.length - 1];
  const low = latest.ref_low ?? test.standard_range?.low ?? null;
  const high = latest.ref_high ?? test.standard_range?.high ?? null;
  const bands = test.bands ?? [];
  const { min, max } = scaleFor({ values: data.map((p) => p.value), low, high, bands, action: test.action });
  const decimals = test.decimals ?? 1;
  const hasRange = low != null || high != null || bands.length > 0;
  const anyUnchecked = data.some((p) => !p.trusted);

  // With no range to show, shade nothing. Falling back to the whole plot would
  // paint every value as "in range", which is worse than no shading at all.
  const areas = bands.length
    ? bands.map((b) => ({ y1: Math.max(min, b.low ?? min), y2: Math.min(max, b.high ?? max), tone: b.tone }))
    : hasRange
      ? [{ y1: low ?? min, y2: high ?? max, tone: "ok" }]
      : [];

  const renderDot = ({ cx, cy, payload, index }) => {
    if (cx == null || cy == null) return null;
    const last = index === data.length - 1;
    // The current value is the one the reader is looking for, so it is bigger.
    const r = compact ? (last ? 4 : 3) : last ? 5.5 : 4;
    return (
      <circle
        key={index}
        cx={cx}
        cy={cy}
        r={r}
        className={`viz-pt ${POINT[flagTone(payload.flag)]} ${payload.trusted ? "" : "viz-pt-open"}`}
      />
    );
  };

  const description = `${test.name} over time: ${data
    .map((p) => `${formatValue(p.value, decimals)} on ${formatDay(p.date)}`)
    .join(", ")}`;

  return (
    <div className="trend-chart">
      <div role="img" aria-label={description} className="w-full" style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={compact ? { top: 6, right: 6, bottom: 6, left: 6 } : { top: 10, right: 16, bottom: 4, left: 0 }}>
            {!compact && <CartesianGrid vertical={false} strokeDasharray="" className="viz-grid" />}
            {areas
              .filter((a) => a.y2 > a.y1)
              .map((a, i) => (
                <ReferenceArea
                  key={i}
                  y1={a.y1}
                  y2={a.y2}
                  ifOverflow="hidden"
                  shape={(p) => <rect x={p.x} y={p.y} width={p.width} height={p.height} className={BAND[a.tone] ?? BAND.ok} />}
                />
              ))}
            <XAxis
              dataKey="t"
              type="number"
              scale="time"
              domain={xDomain ?? timeDomain(data)}
              tickFormatter={formatMonth}
              hide={compact}
              tickLine={false}
              minTickGap={24}
              className="viz-axis"
            />
            <YAxis
              domain={[min, max]}
              tickFormatter={(v) => formatValue(v, decimals)}
              hide={compact}
              width={48}
              tickLine={false}
              axisLine={false}
              allowDataOverflow
              className="viz-axis"
            />
            {!compact && (
              <Tooltip
                content={<PointTooltip unit={test.unit} decimals={decimals} />}
                cursor={{ className: "viz-cursor" }}
              />
            )}
            <Line
              type="linear"
              dataKey="value"
              dot={renderDot}
              activeDot={false}
              isAnimationActive={false}
              className="viz-line"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* The shaded band means nothing on its own, so it is spelled out. */}
      {!compact && showKey && (
        <p className="viz-key mt-1.5">
          <span>
            <i className="viz-key-dot" aria-hidden="true" />
            Result
          </span>
          {hasRange && (
            <span>
              <i className="viz-key-band" aria-hidden="true" />
              {bands.length ? "Guideline bands" : "Normal range"}
            </span>
          )}
          {anyUnchecked && (
            <span>
              <i className="viz-key-open" aria-hidden="true" />
              Not yet checked
            </span>
          )}
        </p>
      )}
    </div>
  );
}
