import { LayoutDashboard, Users, Stethoscope, Building2, Siren, ScrollText } from "lucide-react";

export const ADMIN_LINKS = [
  { label: "Home", to: "/admin/dashboard", Icon: LayoutDashboard, end: true },
  { label: "Users", to: "/admin/users", Icon: Users },
  { label: "Doctors", to: "/admin/doctors", Icon: Stethoscope },
  { label: "Centers", to: "/admin/medical-centers", Icon: Building2 },
  { label: "Emergency", to: "/admin/emergency", Icon: Siren },
  { label: "Audit", to: "/admin/audit-logs", Icon: ScrollText },
];
