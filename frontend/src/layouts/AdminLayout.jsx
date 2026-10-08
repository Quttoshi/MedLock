import { Outlet } from "react-router-dom";
import TopNav from "../components/shell/TopNav";
import { NotificationProvider } from "../context/NotificationContext";

const ADMIN_LINKS = [
  { label: "Home", to: "/admin/dashboard" },
  { label: "Users", to: "/admin/users" },
  { label: "Doctors", to: "/admin/doctors" },
  { label: "Centers", to: "/admin/medical-centers" },
  { label: "Audit", to: "/admin/audit-logs" },
];

// Admin shell (Template A top bar). Routes and the auth guard in App.jsx are unchanged.
function AdminLayout() {
  return (
    <NotificationProvider>
      <div className="min-h-screen bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only rounded-full bg-deep px-4 py-2 text-sm font-semibold text-deep-on focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <TopNav
          links={ADMIN_LINKS}
          homePath="/admin/dashboard"
          notificationsPath="/admin/notifications"
          badge="admin"
        />
        <main id="main" className="app-main mx-auto w-full max-w-[1280px]">
          <Outlet />
        </main>
      </div>
    </NotificationProvider>
  );
}

export default AdminLayout;
