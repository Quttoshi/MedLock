import { LayoutDashboard, FileText, Activity, Upload, UserCheck } from "lucide-react";

// The patient areas. Every route already exists, nothing new is added here.
// Trends points at the health trends pages (/patient/health).
export const PATIENT_LINKS = [
  { label: "Overview", to: "/patient/dashboard", Icon: LayoutDashboard, end: true },
  { label: "Records", to: "/patient/reports", Icon: FileText },
  { label: "Trends", to: "/patient/health", Icon: Activity },
  { label: "Upload", to: "/patient/upload", Icon: Upload },
  { label: "Sharing", to: "/patient/access-requests", Icon: UserCheck },
];
