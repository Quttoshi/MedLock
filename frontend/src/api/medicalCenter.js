import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// Dashboard stats
export const getMCDoctors = (token) =>
  api.get("/mc/doctors", { headers: getHeaders(token) });

export const getMCReports = (token) =>
  api.get("/mc/reports", { headers: getHeaders(token) });

// Upload report for a patient
export const uploadPatientReport = (token, formData) =>
  api.post("/mc/reports/upload", formData, {
    headers: {
      ...getHeaders(token),
      "Content-Type": "multipart/form-data",
    },
  });