import { Outlet } from "react-router-dom";
import TopNav from "../components/shell/TopNav";
import { NotificationProvider } from "../context/NotificationContext";

const DOCTOR_LINKS = [
  { label: "Overview", to: "/doctor/dashboard" },
  { label: "Patients", to: "/doctor/patients" },
  { label: "Requests", to: "/doctor/access-requests" },
  { label: "Affiliation", to: "/doctor/affiliation" },
];

// Doctor shell (Template A top bar). Routes and the auth guard in App.jsx are unchanged.
function DoctorLayout() {
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
