import { LayoutDashboard, Users, UserCheck, Building2, Siren } from "lucide-react";

// The doctor areas. Every route already exists, nothing new is added here.
export const DOCTOR_LINKS = [
  { label: "Overview", to: "/doctor/dashboard", Icon: LayoutDashboard, end: true },
  { label: "Patients", to: "/doctor/patients", Icon: Users },
  { label: "Requests", to: "/doctor/access-requests", Icon: UserCheck },
  { label: "Affiliation", to: "/doctor/affiliation", Icon: Building2 },
  { label: "Emergency", to: "/doctor/emergency", Icon: Siren },
];
