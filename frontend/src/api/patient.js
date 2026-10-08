import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// The patient's CNIC (shown masked) and date of birth
export const getMyIdentity = (token) => api.get("/patients/me/identity", { headers: getHeaders(token) });

export const updateMyIdentity = (token, cnic, dateOfBirth) =>
  api.put("/patients/me/identity", { cnic, date_of_birth: dateOfBirth }, { headers: getHeaders(token) });

// Emergency access to the patient's records, with the reports opened
export const getMyEmergencies = (token) => api.get("/emergency/mine", { headers: getHeaders(token) });

export const endEmergencyAsPatient = (token, id) =>
  api.post(`/emergency/${id}/end`, {}, { headers: getHeaders(token) });

export const reportEmergencyMisuse = (token, id, note) =>
  api.post(`/emergency/${id}/flag`, { note }, { headers: getHeaders(token) });
