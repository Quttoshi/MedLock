import { Outlet } from "react-router-dom";
import TopNav from "../components/shell/TopNav";
import { NotificationProvider } from "../context/NotificationContext";

// Patient shell (Template A): a top bar instead of the old sidebar. Routes,
// the auth guard in App.jsx and the notification provider are unchanged.
function PatientLayout() {
  return (
    <NotificationProvider>
      <div className="min-h-screen bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only rounded-full bg-deep px-4 py-2 text-sm font-semibold text-deep-on focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <TopNav />
        <main id="main" className="app-main mx-auto w-full max-w-[1280px]">
          <Outlet />
        </main>
      </div>
    </NotificationProvider>
  );
}

export default PatientLayout;
