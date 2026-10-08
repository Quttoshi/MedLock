import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// Dashboard stats
export const getMCDoctors = (token) =>
  api.get("/mc/doctors", { headers: getHeaders(token) });

export const getMCProfile = (token) =>
  api.get("/mc/profile", { headers: getHeaders(token) });

// End a doctor's affiliation with this center
export const removeDoctor = (token, doctorId, reason) =>
  api.post(`/mc/doctors/${doctorId}/remove`, { reason }, { headers: getHeaders(token) });

export const getMCReports = (token) =>
  api.get("/mc/reports", { headers: getHeaders(token) });

// Affiliation requests
export const getAffiliationRequests = (token, status) =>
  api.get(`/mc/affiliation-requests${status ? `?status_filter=${status}` : ""}`, { headers: getHeaders(token) });

// licenseNumber is read from the doctor's credential and must match the one they registered with
export const approveAffiliation = (token, requestId, licenseNumber) =>
  api.patch(
    `/mc/affiliation-requests/${requestId}/approve`,
    { license_number: licenseNumber },
    { headers: getHeaders(token) }
  );

export const rejectAffiliation = (token, requestId, reason) =>
  api.patch(`/mc/affiliation-requests/${requestId}/reject`, { reason }, { headers: getHeaders(token) });

// Upload a DICOM imaging study (.dcm or .zip) for a patient
export const uploadPatientImaging = (token, formData) =>
  api.post("/mc/imaging/upload", formData, {
    headers: {
      ...getHeaders(token),
      "Content-Type": "multipart/form-data",
    },
  });

// Upload report for a patient
export const uploadPatientReport = (token, formData) =>
  api.post("/mc/reports/upload", formData, {
    headers: {
      ...getHeaders(token),
      "Content-Type": "multipart/form-data",
    },
  });