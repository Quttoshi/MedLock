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

// Imaging (DICOM) study details and series previews
export const getImagingStudy = (token, patientId, reportId) =>
  api.get(`/doctor/patients/${patientId}/reports/${reportId}/imaging`, { headers: getHeaders(token) });

export const getImagingPreview = (token, patientId, reportId, seriesId) =>
  api.get(`/doctor/patients/${patientId}/reports/${reportId}/imaging/series/${seriesId}/preview`, {
    headers: getHeaders(token),
    responseType: "blob",
  });

export const getImagingSlices = (token, patientId, reportId, seriesId, onProgress) =>
  api.get(`/doctor/patients/${patientId}/reports/${reportId}/imaging/series/${seriesId}/slices`, {
    headers: getHeaders(token),
    responseType: "arraybuffer",
    onDownloadProgress: onProgress,
  });

// Check a report against its blockchain record
export const verifyReport = (token, patientId, reportId) =>
  api.get(`/doctor/patients/${patientId}/reports/${reportId}/verify`, {
    headers: getHeaders(token),
  });

// License verification (independent doctors are verified by an admin via PMDC)
export const getMyVerification = (token) =>
  api.get("/doctor/verification", { headers: getHeaders(token) });

export const submitVerificationRequest = (token, formData) =>
  api.post("/doctor/verification-requests", formData, {
    headers: { ...getHeaders(token), "Content-Type": "multipart/form-data" },
  });

// Access requests
export const getMyAccessRequests = (token) =>
  api.get("/access-requests/my", { headers: getHeaders(token) });

export const submitAccessRequest = (token, data) =>
  api.post("/access-requests", data, { headers: getHeaders(token) });

// Affiliation
export const searchMedicalCenters = (token, query) =>
  api.get(`/doctor/medical-centers${query ? `?search=${encodeURIComponent(query)}` : ""}`, { headers: getHeaders(token) });

export const requestAffiliation = (token, data) =>
  api.post("/doctor/affiliations/request", data, { headers: getHeaders(token) });

export const getMyAffiliations = (token) =>
  api.get("/doctor/affiliations", { headers: getHeaders(token) });

// Query patient history
export const queryPatientHistory = (token, patientId, question) =>
  api.post(
    `/doctor/patients/${patientId}/query`,
    { question },
    { headers: getHeaders(token) }
  );