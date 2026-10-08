import { NavLink } from "react-router-dom";
import NotificationBell from "./NotificationBell";
import AvatarMenu from "./AvatarMenu";
import ThemeToggle from "../../theme/ThemeToggle";

// Template A top bar. The links point at the routes that already exist, so
// "Story" is the dashboard, "Records" is My Reports and "Sharing" is Access
// Requests. Audit is left out until the backend has a patient audit feed.
const PATIENT_LINKS = [
  { label: "Story", to: "/patient/dashboard" },
  { label: "Records", to: "/patient/reports" },
  { label: "Upload", to: "/patient/upload" },
  { label: "Sharing", to: "/patient/access-requests" },
];

function NavPill({ links }) {
  return (
    <nav aria-label="Main" className="flex max-w-full justify-between gap-1 overflow-x-auto md:inline-flex rounded-full border border-line bg-surface p-1">
      {links.map((l) => (
        <NavLink
          key={l.to}
          to={l.to}
          className={({ isActive }) =>
            `whitespace-nowrap rounded-full px-2.5 py-2.5 text-sm font-semibold sm:px-4 sm:text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
              isActive ? "bg-deep text-deep-on" : "text-ink-soft hover:bg-inset hover:text-ink"
            }`
          }
        >
          {l.label}
        </NavLink>
      ))}
    </nav>
  );
}

export default function TopNav({ links = PATIENT_LINKS, homePath = "/patient/dashboard", notificationsPath = "/patient/notifications", badge }) {
  return (
    <header className="mx-auto w-full max-w-[1280px] px-5 pt-6 md:px-8 md:pt-8">
      <div className="flex items-center justify-between gap-4 md:grid md:grid-cols-[1fr_auto_1fr]">
        <NavLink to={homePath} className="flex items-baseline gap-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand">
          <span className="display text-[28px] leading-none text-ink">MedLock</span>
          {badge && <span className="hidden whitespace-nowrap text-sm font-semibold text-muted sm:inline">{badge}</span>}
        </NavLink>
        <div className="hidden md:block">
          <NavPill links={links} />
        </div>
        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <ThemeToggle />
          <NotificationBell notificationsPath={notificationsPath} />
          <AvatarMenu />
        </div>
      </div>
      <div className="mt-4 md:hidden">
        <NavPill links={links} />
      </div>
    </header>
  );
}
