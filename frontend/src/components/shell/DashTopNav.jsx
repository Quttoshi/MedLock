import { NavLink } from "react-router-dom";
import { Lock } from "lucide-react";
import NotificationBell from "./NotificationBell";
import AvatarMenu from "./AvatarMenu";
import ThemeToggle from "../../theme/ThemeToggle";

const focus =
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

function NavItems({ links, className = "" }) {
  return (
    <nav aria-label="Main" className={className}>
      {links.map((link) => {
        const NavIcon = link.Icon;
        return (
          <NavLink
            key={link.to}
            to={link.to}
            end={link.end}
            className={({ isActive }) =>
              `flex flex-shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-2 text-sm font-semibold transition-colors ${focus} ${
                isActive ? "bg-deep text-deep-on" : "text-ink-soft hover:bg-inset hover:text-ink"
              }`
            }
          >
            <NavIcon aria-hidden="true" size={17} strokeWidth={2} />
            {link.label}
          </NavLink>
        );
      })}
    </nav>
  );
}

// Top bar shared by the signed in screens that use the .dash look: logo, the
// main areas with icons, then theme, alerts and the account menu. Each portal
// passes its own links, home path and notifications path.
export default function DashTopNav({ links, homePath, notificationsPath, badge }) {
  return (
    <header className="dash-top border-b border-line bg-surface">
      <div className="mx-auto flex w-full max-w-[1280px] items-center gap-4 px-5 py-2.5 md:px-8">
        <NavLink to={homePath} aria-label="MedLock home" className={`flex items-center gap-2 ${focus}`}>
          <Lock aria-hidden="true" size={22} strokeWidth={2.2} className="text-brand" />
          <span className="display text-xl leading-none text-ink">
            med<span className="font-semibold text-brand">lock</span>
          </span>
          {badge && (
            <span className="ml-1 hidden whitespace-nowrap border-l border-line pl-3 text-sm font-semibold text-muted sm:inline">
              {badge}
            </span>
          )}
        </NavLink>
        {links.length > 0 && <NavItems links={links} className="ml-4 hidden items-center gap-1 md:flex" />}
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <NotificationBell notificationsPath={notificationsPath} />
          <AvatarMenu />
        </div>
      </div>
      {links.length > 0 && (
        <div className="mx-auto w-full max-w-[1280px] overflow-x-auto px-5 pb-2.5 md:hidden">
          <NavItems links={links} className="flex items-center gap-1" />
        </div>
      )}
    </header>
  );
}
