import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// Patients with approved access
export const getMyPatients = (token) =>
  api.get("/doctor/patients", { headers: getHeaders(token) });

// Reports for a specific patient
export const getPatientReports = (token, patientId) =>
  api.get(`/doctor/patients/${patientId}/reports`, { headers: getHeaders(token) });

// Download a specific report
export const downloadReport = (token, patientId, reportId) =>
  api.get(`/doctor/patients/${patientId}/reports/${reportId}/download`, {
    headers: getHeaders(token),
    responseType: "blob",
  });

// Access requests
export const getMyAccessRequests = (token) =>
  api.get("/access-requests/my", { headers: getHeaders(token) });

export const submitAccessRequest = (token, data) =>
  api.post("/access-requests", data, { headers: getHeaders(token) });

// Query patient history
export const queryPatientHistory = (token, patientId, question) =>
  api.post(
    `/doctor/patients/${patientId}/query`,
    { question },
    { headers: getHeaders(token) }
  );