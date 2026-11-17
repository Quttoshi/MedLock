import { Outlet } from "react-router-dom";
import DashTopNav from "../components/shell/DashTopNav";
import { DOCTOR_LINKS } from "../components/shell/doctorLinks";
import { NotificationProvider } from "../context/NotificationContext";
import "../styles/dash.css";

// Doctor shell (top bar with icons, .dash look). Routes and the auth guard in App.jsx are unchanged.
function DoctorLayout() {
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
          links={DOCTOR_LINKS}
          homePath="/doctor/dashboard"
          notificationsPath="/doctor/notifications"
          badge="for doctors"
        />
        <main id="main" className="app-main mx-auto w-full max-w-[1280px]">
          <Outlet />
        </main>
      </div>
    </NotificationProvider>
  );
}

export default DoctorLayout;
