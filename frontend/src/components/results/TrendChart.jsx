import {
  CartesianGrid, Line, LineChart, ReferenceArea, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import {
  dayTime, flagTone, flagWord, formatDay, formatMonth, formatValue, scaleFor, timeDomain,
} from "../../utils/results";

const AREA = { ok: "fill-ok-subtle", warn: "fill-warn-subtle", bad: "fill-bad-subtle" };
const POINT = { ok: "fill-ok stroke-ok", warn: "fill-warn stroke-warn", bad: "fill-bad stroke-bad" };
const RING = { ok: "fill-surface stroke-ok", warn: "fill-surface stroke-warn", bad: "fill-surface stroke-bad" };

function PointTooltip({ active, payload, unit, decimals }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="card card-lift !rounded-xl px-3 py-2 text-xs">
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
 * A test's history: the normal range (or guideline bands) shaded behind the line,
 * points coloured by flag, and hollow points for values nobody has checked yet.
 * `compact` draws a small sparkline without axes for cards.
 */
export default function TrendChart({ test, points, height = 240, compact = false, xDomain }) {
  const data = (points ?? test.points ?? []).map((p) => ({ ...p, t: dayTime(p.date) }));
  if (!data.length) return null;
  const latest = data[data.length - 1];
  const low = latest.ref_low ?? test.standard_range?.low ?? null;
  const high = latest.ref_high ?? test.standard_range?.high ?? null;
  const bands = test.bands ?? [];
  const { min, max } = scaleFor({ values: data.map((p) => p.value), low, high, bands, action: test.action });
  const decimals = test.decimals ?? 1;

  const areas = bands.length
    ? bands.map((b) => ({ y1: Math.max(min, b.low ?? min), y2: Math.min(max, b.high ?? max), tone: b.tone }))
    : [{ y1: low ?? min, y2: high ?? max, tone: "ok" }];

  const renderDot = ({ cx, cy, payload, index }) => {
    if (cx == null || cy == null) return null;
    const tone = flagTone(payload.flag);
    return (
      <circle
        key={index}
        cx={cx}
        cy={cy}
        r={compact ? 3 : 4.5}
        strokeWidth={2}
        className={payload.trusted ? POINT[tone] : RING[tone]}
      />
    );
  };

  const description = `${test.name} over time: ${data
    .map((p) => `${formatValue(p.value, decimals)} on ${formatDay(p.date)}`)
    .join(", ")}`;

  return (
    <div role="img" aria-label={description} className="trend-chart w-full" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={compact ? { top: 6, right: 6, bottom: 6, left: 6 } : { top: 10, right: 16, bottom: 4, left: 0 }}>
          {!compact && <CartesianGrid vertical={false} />}
          {areas
            .filter((a) => a.y2 > a.y1)
            .map((a, i) => (
              <ReferenceArea
                key={i}
                y1={a.y1}
                y2={a.y2}
                ifOverflow="hidden"
                shape={(p) => <rect x={p.x} y={p.y} width={p.width} height={p.height} className={AREA[a.tone] ?? AREA.ok} />}
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
          />
          <YAxis
            domain={[min, max]}
            tickFormatter={(v) => formatValue(v, decimals)}
            hide={compact}
            width={48}
            tickLine={false}
            axisLine={false}
            allowDataOverflow
          />
          {!compact && <Tooltip content={<PointTooltip unit={test.unit} decimals={decimals} />} cursor={false} />}
          <Line
            type="linear"
            dataKey="value"
            strokeWidth={2}
            dot={renderDot}
            activeDot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
