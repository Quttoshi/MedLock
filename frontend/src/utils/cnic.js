// CNIC, B-Form and NICOP numbers are 13 digits, written 12345-1234567-1.

// Formats what the user types as 12345-1234567-1, keeping only digits.
export function formatCnicInput(value) {
  const digits = (value || "").replace(/\D/g, "").slice(0, 13);
  if (digits.length <= 5) return digits;
  if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
  return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12)}`;
}

export const isValidCnic = (value) => (value || "").replace(/\D/g, "").length === 13;

export const CNIC_PLACEHOLDER = "12345-1234567-1";

// Latest allowed date of birth (today), for date inputs
export const todayIso = () => new Date().toISOString().split("T")[0];
