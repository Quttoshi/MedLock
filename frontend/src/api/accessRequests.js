import api from "./axios";

const getHeaders = (token) => ({ Authorization: `Bearer ${token}` });

// Patient: approved hospitals and clinics, to find a doctor by where they work
export const getShareCenters = (token) => api.get("/access-requests/centers", { headers: getHeaders(token) });

// Patient: verified doctors to share records with: everyone at a hospital or clinic
// (centerId), or a name search
export const searchDoctorsToShare = (token, query, centerId) => {
  const params = new URLSearchParams({ search: query || "" });
  if (centerId) params.set("center_id", centerId);
  return api.get(`/access-requests/doctors?${params}`, { headers: getHeaders(token) });
};

// Patient: give a verified doctor 30 days of access without waiting for their request
export const shareRecords = (token, doctorId, note) =>
  api.post("/access-requests/share", { doctor_id: doctorId, note: note || null }, { headers: getHeaders(token) });
