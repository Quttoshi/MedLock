// Helpers for showing lab results: numbers, dates, tones and plain words.
// The API sends values in each test's own unit with `decimals` for display.

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Collection dates are date-only ("2026-03-12"). Parse the parts so no timezone can
// move them to the day before.
export function parseDay(value) {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function dayTime(value) {
  return parseDay(value)?.getTime() ?? null;
}

export function formatDay(value) {
  const d = parseDay(value);
  return d ? `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}` : "";
}

export function formatMonth(value) {
  const d = typeof value === "number" ? new Date(value) : parseDay(value);
  return d ? `${MONTHS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}` : "";
}

export function formatValue(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "";
  return Number(value).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

// "12.0 – 15.5", "below 100", "above 40"
export function formatRange(low, high, decimals = 1) {
  if (low != null && high != null) return `${formatValue(low, decimals)} – ${formatValue(high, decimals)}`;
  if (high != null) return `below ${formatValue(high, decimals)}`;
  if (low != null) return `above ${formatValue(low, decimals)}`;
  return "";
}

// ok / warn / bad, used for pills, range bars and chart points.
export function flagTone(flag) {
  if (!flag || flag === "normal") return "ok";
  if (flag.startsWith("critical")) return "bad";
  return "warn";
}

// A test with guideline bands (HbA1c, eGFR, LDL...) uses the band's tone.
export function resultTone(flag, band) {
  if (flag?.startsWith("critical")) return "bad";
  if (band?.tone) return band.tone;
  return flagTone(flag);
}

export function flagWord(flag) {
  return {
    normal: "in range",
    low: "below range",
    high: "above range",
    critical_low: "very low",
    critical_high: "very high",
  }[flag] ?? "";
}

// "Down 0.6 since 6 Jun 2026"
export function changeText(change, decimals = 1) {
  if (!change) return "";
  if (change.direction === "same") return `No change since ${formatDay(change.from_date)}`;
  const word = change.direction === "up" ? "Up" : "Down";
  return `${word} ${formatValue(Math.abs(change.amount), decimals)} since ${formatDay(change.from_date)}`;
}

export const CONFIDENCE_NOTE =
  "Read automatically from the report and not yet checked. Compare it with the report and confirm or correct it.";

export const DISCLAIMER =
  "These are your lab values with the ranges labs use. They are not a diagnosis. Talk to your doctor about what they mean for you.";

// Scale that fits the value, the range, any bands and action lines, with some room
// either side. One-sided ranges (LDL below 100, HDL above 40) start at zero.
export function scaleFor({ values = [], low, high, bands = [], action = {} }) {
  const nums = [...values, low, high, action.low, action.high, ...bands.flatMap((b) => [b.low, b.high])]
    .filter((n) => n !== null && n !== undefined && Number.isFinite(Number(n)))
    .map(Number);
  if (!nums.length) return { min: 0, max: 1 };
  let min = Math.min(...nums);
  let max = Math.max(...nums);
  if (min === max) {
    min = min * 0.8;
    max = max * 1.2 || 1;
  }
  const pad = (max - min) * 0.2;
  // "Below 100" ranges are shown from zero so the whole good area is visible.
  min = low == null && high != null ? 0 : Math.max(0, min - pad);
  return { min, max: max + pad };
}

const DAY = 24 * 60 * 60 * 1000;

// The time axis for a chart, or shared by several stacked charts (pass all their points).
export function timeDomain(points) {
  const times = points.map((p) => dayTime(p.date)).filter((t) => t != null);
  if (!times.length) return [0, 1];
  const min = Math.min(...times);
  const max = Math.max(...times);
  const pad = Math.max((max - min) * 0.04, 20 * DAY);
  return [min - pad, max + pad];
}

// The guideline band a value falls in (bands include their lower bound).
export function bandFor(bands, value) {
  return (bands ?? []).find((b) => (b.low == null || value >= b.low) && (b.high == null || value < b.high)) ?? null;
}
