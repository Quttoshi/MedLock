import { Outlet } from "react-router-dom";
import DashTopNav from "../components/shell/DashTopNav";
import { ADMIN_LINKS } from "../components/shell/adminLinks";
import { NotificationProvider } from "../context/NotificationContext";
import "../styles/dash.css";

// Admin shell (top bar with icons, .dash look). Routes and the auth guard in App.jsx are unchanged.
function AdminLayout() {
  return (
    <NotificationProvider>
      <div className="dash min-h-screen bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only rounded-md bg-deep px-4 py-2 text-sm font-semibold text-deep-on focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <DashTopNav
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
