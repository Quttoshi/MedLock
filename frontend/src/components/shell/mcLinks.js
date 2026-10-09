import { LayoutDashboard, Upload, FileText, Users } from "lucide-react";

// Medical center top bar links. Labs take no doctors, so the layout removes
// the Doctors link for them.
export const MC_LINKS = [
  { label: "Overview", to: "/mc/dashboard", Icon: LayoutDashboard, end: true },
  { label: "Upload", to: "/mc/upload", Icon: Upload },
  { label: "Reports", to: "/mc/reports", Icon: FileText },
  { label: "Doctors", to: "/mc/doctors", Icon: Users },
];
