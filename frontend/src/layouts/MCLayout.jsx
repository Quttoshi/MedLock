import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import TopNav from "../components/shell/TopNav";
import { NotificationProvider } from "../context/NotificationContext";
import { useAuth } from "../context/AuthContext";
import { getMCProfile } from "../api/medicalCenter";

const MC_LINKS = [
  { label: "Overview", to: "/mc/dashboard" },
  { label: "Upload", to: "/mc/upload" },
  { label: "Reports", to: "/mc/reports" },
  { label: "Doctors", to: "/mc/doctors" },
];

const BADGES = { hospital: "for hospitals", clinic: "for clinics", lab: "for diagnostic labs" };

// Medical center shell (Template A top bar). Routes and the auth guard in App.jsx are unchanged.
// The center's profile is shared with pages through the outlet context; labs take no
// doctors, so they get no Doctors tab.
function MCLayout() {
  const { token } = useAuth();
  const [profile, setProfile] = useState(null);

  useEffect(() => {
    if (!token) return;
    getMCProfile(token)
      .then((res) => setProfile(res.data))
      .catch(() => setProfile(null));
  }, [token]);

  const isLab = profile?.center_type === "lab";
  const links = isLab ? MC_LINKS.filter((l) => l.to !== "/mc/doctors") : MC_LINKS;

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
          links={links}
          homePath="/mc/dashboard"
          notificationsPath="/mc/notifications"
          badge={BADGES[profile?.center_type] ?? "for medical centers"}
        />
        <main id="main" className="app-main mx-auto w-full max-w-[1280px]">
          <Outlet context={{ profile, isLab }} />
        </main>
      </div>
    </NotificationProvider>
  );
}

export default MCLayout;
