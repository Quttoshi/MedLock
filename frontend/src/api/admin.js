import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// Dashboard stats
export const getAdminUsers = (token, role = "") =>
  api.get(`/admin/users${role ? `?role=${role}` : ""}`, { headers: getHeaders(token) });

export const getAdminDoctors = (token, verified = "") =>
  api.get(`/admin/doctors${verified !== "" ? `?verified=${verified}` : ""}`, { headers: getHeaders(token) });

export const getAdminMedicalCenters = (token, approved = "") =>
  api.get(`/admin/medical-centers${approved !== "" ? `?approved=${approved}` : ""}`, { headers: getHeaders(token) });

// category groups related actions (accounts, reports, access, doctors, centers, questions)
export const getAdminAuditLogs = (token, category = "", limit = 50, offset = 0) =>
  api.get(`/admin/audit-logs?limit=${limit}&offset=${offset}${category ? `&category=${category}` : ""}`, {
    headers: getHeaders(token),
  });

// Doctor actions
// Admin override; the reason is recorded and shared with the doctor
export const verifyDoctor = (token, id, reason, licenseExpiresAt) =>
  api.patch(
    `/admin/doctors/${id}/verify`,
    { reason, license_expires_at: licenseExpiresAt || null },
    { headers: getHeaders(token) }
  );

export const unverifyDoctor = (token, id, reason) =>
  api.patch(`/admin/doctors/${id}/unverify`, { reason }, { headers: getHeaders(token) });

// License verification requests from independent doctors
export const getVerificationRequests = (token, status = "pending") =>
  api.get(`/admin/doctor-verification-requests?status=${status}`, { headers: getHeaders(token) });

export const getVerificationCertificate = (token, id) =>
  api.get(`/admin/doctor-verification-requests/${id}/certificate`, {
    headers: getHeaders(token),
    responseType: "blob",
  });

export const approveVerificationRequest = (token, id, licenseExpiresAt, note) =>
  api.patch(
    `/admin/doctor-verification-requests/${id}/approve`,
    { license_expires_at: licenseExpiresAt, note: note || null },
    { headers: getHeaders(token) }
  );

export const rejectVerificationRequest = (token, id, reason) =>
  api.patch(`/admin/doctor-verification-requests/${id}/reject`, { reason }, { headers: getHeaders(token) });

// Medical center actions
// The admin confirms the licence expiry from the regulator's register and notes how it was checked
export const approveMC = (token, id, licenseExpiresAt, note) =>
  api.patch(
    `/admin/medical-centers/${id}/approve`,
    { license_expires_at: licenseExpiresAt, note },
    { headers: getHeaders(token) }
  );

// Emergency ("break the glass") accesses, misuse reports first
export const getEmergencyAccesses = (token) =>
  api.get("/admin/emergency-accesses", { headers: getHeaders(token) });

export const reviewEmergencyAccess = (token, id, note) =>
  api.post(`/admin/emergency-accesses/${id}/review`, { note }, { headers: getHeaders(token) });

export const rejectMC = (token, id, reason) =>
  api.patch(`/admin/medical-centers/${id}/reject?reason=${encodeURIComponent(reason)}`, {}, { headers: getHeaders(token) });