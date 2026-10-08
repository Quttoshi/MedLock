// Provincial healthcare regulators that license hospitals, clinics and labs. The values
// match the backend's regulator codes.
export const REGULATORS = [
  { value: "PHC", label: "Punjab Healthcare Commission (PHC)" },
  { value: "SHCC", label: "Sindh Healthcare Commission (SHCC)" },
  { value: "KPHCC", label: "Khyber Pakhtunkhwa Health Care Commission (KPHCC)" },
  { value: "IHRA", label: "Islamabad Healthcare Regulatory Authority (IHRA)" },
];

export const regulatorLabel = (code) => REGULATORS.find((r) => r.value === code)?.label ?? code;
