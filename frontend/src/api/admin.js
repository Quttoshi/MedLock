import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// Dashboard stats
export const getAdminUsers = (token, role = "") =>
  api.get(`/admin/users${role ? `?role=${role}` : ""}`, { headers: getHeaders(token) });

export const getAdminDoctors = (token, verified = "") =>
  api.get(`/admin/doctors${verified !== "" ? `?verified=${verified}` : ""}`, { headers: getHeaders(token) });

export const getAdminMedicalCenters = (token, approved = "") =>
  api.get(`/admin/medical-centers${approved !== "" ? `?approved=${approved}` : ""}`, { headers: getHeaders(token) });

export const getAdminAuditLogs = (token, action = "", limit = 50, offset = 0) =>
  api.get(`/admin/audit-logs?limit=${limit}&offset=${offset}${action ? `&action=${action}` : ""}`, { headers: getHeaders(token) });

// Doctor actions
export const verifyDoctor = (token, id) =>
  api.patch(`/admin/doctors/${id}/verify`, {}, { headers: getHeaders(token) });

export const unverifyDoctor = (token, id) =>
  api.patch(`/admin/doctors/${id}/unverify`, {}, { headers: getHeaders(token) });

// Medical center actions
export const approveMC = (token, id) =>
  api.patch(`/admin/medical-centers/${id}/approve`, {}, { headers: getHeaders(token) });

export const rejectMC = (token, id, reason) =>
  api.patch(`/admin/medical-centers/${id}/reject?reason=${encodeURIComponent(reason)}`, {}, { headers: getHeaders(token) });