import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// Report questions: private patient-doctor threads on one report.

// Patient: every thread on the report and the doctors they can ask.
// Doctor: their own thread on the report (if any) and whether they can start one.
export const getReportThreads = (token, reportId) =>
  api.get(`/reports/${reportId}/threads`, { headers: getHeaders(token) });

// Start a thread with a first message (or add to the existing one). Patients pass doctorId.
export const startReportThread = (token, reportId, body, doctorId) =>
  api.post(
    `/reports/${reportId}/threads`,
    { body, doctor_id: doctorId || null },
    { headers: getHeaders(token) }
  );

// Messages of a thread; opening them marks the thread as read.
export const getThreadMessages = (token, threadId) =>
  api.get(`/threads/${threadId}/messages`, { headers: getHeaders(token) });

export const sendThreadMessage = (token, threadId, body) =>
  api.post(`/threads/${threadId}/messages`, { body }, { headers: getHeaders(token) });

export const resolveThread = (token, threadId) =>
  api.patch(`/threads/${threadId}/resolve`, {}, { headers: getHeaders(token) });

export const reopenThread = (token, threadId) =>
  api.patch(`/threads/${threadId}/reopen`, {}, { headers: getHeaders(token) });

// Unread threads per report id, for "New" badges on report lists
export const getUnreadThreads = (token) =>
  api.get("/threads/unread", { headers: getHeaders(token) });
