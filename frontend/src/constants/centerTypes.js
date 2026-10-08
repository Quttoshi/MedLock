// Medical center types. Hospitals and clinics take affiliated doctors; labs only
// upload reports. The values match the backend's center_type.
export const CENTER_TYPES = [
  { value: "hospital", label: "Hospital" },
  { value: "clinic", label: "Clinic" },
  { value: "lab", label: "Diagnostic lab" },
];

export const centerTypeLabel = (type) =>
  CENTER_TYPES.find((t) => t.value === type)?.label ?? "Medical center";
