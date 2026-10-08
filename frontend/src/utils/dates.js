// The API sends times in UTC without a timezone marker, e.g. "2026-10-08T17:01:51.93".
// Browsers read such strings as local time, which would shift every time by the UTC
// offset (5 hours in Pakistan). Read them as UTC instead, so they show in the viewer's
// own time. Date-only values ("2026-10-08") and values that already carry a zone are
// parsed as they are.
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

export function parseServerDate(value) {
  if (typeof value === "string" && NAIVE_DATETIME.test(value)) return new Date(`${value}Z`);
  return new Date(value);
}
