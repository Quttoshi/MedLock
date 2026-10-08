import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// Doctor: whether emergency access can be used, at which hospitals, and uses left today
export const getEmergencyEligibility = (token) => api.get("/emergency/eligibility", { headers: getHeaders(token) });

// Doctor: open a patient's records in an emergency, found by the CNIC and date of birth on their card
export const startEmergency = (token, data) => api.post("/emergency", data, { headers: getHeaders(token) });

export const getActiveEmergencies = (token) => api.get("/emergency/active", { headers: getHeaders(token) });

export const endEmergency = (token, id) => api.post(`/emergency/${id}/end`, {}, { headers: getHeaders(token) });
