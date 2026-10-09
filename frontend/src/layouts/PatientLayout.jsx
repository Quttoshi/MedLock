import { Outlet } from "react-router-dom";
import PatientTopNav from "../components/shell/PatientTopNav";
import { NotificationProvider } from "../context/NotificationContext";
import "../styles/dash.css";

// Patient shell: a top bar with the four areas, then the page. The look comes
// from styles/dash.css (the .dash class). Routes, the auth guard in App.jsx
// and the notification provider are unchanged.
function PatientLayout() {
  return (
    <NotificationProvider>
      <div className="dash min-h-screen bg-canvas font-sans text-ink">
        <a
          href="#main"
          className="sr-only rounded-md bg-deep px-4 py-2 text-sm font-semibold text-deep-on focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
        >
          Skip to content
        </a>
        <PatientTopNav />
        <main id="main" className="app-main mx-auto w-full max-w-[1280px]">
          <Outlet />
        </main>
      </div>
    </NotificationProvider>
  );
}

export default PatientLayout;
