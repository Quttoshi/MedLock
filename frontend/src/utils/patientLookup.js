import { isValidCnic } from "./cnic";

// How a hospital, lab or doctor identifies a patient: by email, or by CNIC with date of
// birth (see PatientLookupFields).
export const EMPTY_LOOKUP = { mode: "email", email: "", cnic: "", dob: "" };

// Whether enough has been entered to look the patient up
export const lookupComplete = (lookup) =>
  lookup.mode === "email" ? Boolean(lookup.email.trim()) : isValidCnic(lookup.cnic) && Boolean(lookup.dob);

// The fields to send: email, or CNIC with date of birth
export const lookupPayload = (lookup) =>
  lookup.mode === "email"
    ? { patient_email: lookup.email.trim() }
    : { patient_cnic: lookup.cnic, patient_dob: lookup.dob };
