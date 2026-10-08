import { Outlet } from "react-router-dom";
import TopNav from "../components/shell/TopNav";
import { NotificationProvider } from "../context/NotificationContext";

const MC_LINKS = [
  { label: "Overview", to: "/mc/dashboard" },
  { label: "Upload", to: "/mc/upload" },
  { label: "Reports", to: "/mc/reports" },
  { label: "Doctors", to: "/mc/doctors" },
];

// Medical center shell (Template A top bar). Routes and the auth guard in App.jsx are unchanged.
function MCLayout() {
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
          links={MC_LINKS}
          homePath="/mc/dashboard"
          notificationsPath="/mc/notifications"
          badge="for medical centers"
        />
        <main id="main" className="app-main mx-auto w-full max-w-[1280px]">
          <Outlet />
        </main>
      </div>
    </NotificationProvider>
  );
}

export default MCLayout;
