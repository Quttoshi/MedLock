import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// Lab results read from reports: summaries, trends per test and per-report tables.
// Values are always in MedLock's unit for the test (the `unit` field).

// ── Patient ─────────────────────────────────────────────────────────────────────

// Dashboard card: what needs attention, what changed, each panel's status.
export const getMySummary = (token) =>
  api.get("/results/me/summary", { headers: getHeaders(token) });

// Every test with its history, grouped into panels by body system.
export const getMyTrends = (token) =>
  api.get("/results/me/trends", { headers: getHeaders(token) });

// One test with its full history.
export const getMyTest = (token, testCode) =>
  api.get(`/results/me/tests/${testCode}`, { headers: getHeaders(token) });

// One report's results (also for uploads still awaiting approval).
export const getMyReportResults = (token, reportId) =>
  api.get(`/results/me/reports/${reportId}`, { headers: getHeaders(token) });

// ── Doctor ──────────────────────────────────────────────────────────────────────

export const getPatientOverview = (token, patientId) =>
  api.get(`/doctor/patients/${patientId}/results/overview`, { headers: getHeaders(token) });

// Tests by collection date, newest first.
export const getPatientTable = (token, patientId) =>
  api.get(`/doctor/patients/${patientId}/results/table`, { headers: getHeaders(token) });

// Histories for chosen test codes, or all tests by panel when none are given.
export const getPatientTrends = (token, patientId, tests) =>
  api.get(`/doctor/patients/${patientId}/results/trends`, {
    headers: getHeaders(token),
    params: tests?.length ? { tests: tests.join(",") } : {},
  });

export const getPatientReportResults = (token, patientId, reportId) =>
  api.get(`/doctor/patients/${patientId}/reports/${reportId}/results`, { headers: getHeaders(token) });

// ── Both ────────────────────────────────────────────────────────────────────────

// Confirm a value as read (value omitted) or correct it (value given).
export const confirmResult = (token, resultId, value) =>
  api.patch(
    `/results/${resultId}`,
    value === undefined || value === null ? {} : { value },
    { headers: getHeaders(token) }
  );
