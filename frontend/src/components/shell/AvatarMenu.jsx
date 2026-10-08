import { useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { initials } from "../../adapters/patientStory";
import { useDismiss } from "./useDismiss";

export default function AvatarMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, open, close);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-11 w-11 items-center justify-center rounded-full bg-brand text-sm font-bold text-brand-on transition-colors hover:bg-brand-strong focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
      >
        {initials(user?.name)}
      </button>

      {open && (
        <div className="absolute right-0 top-14 z-50 w-64 overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div className="border-b border-line px-5 py-4">
            <p className="display truncate text-xl text-ink">{user?.name || "Your account"}</p>
            {user?.email && <p className="mt-0.5 truncate text-sm text-muted">{user.email}</p>}
          </div>
          <div className="p-2">
            <button
              type="button"
              onClick={handleLogout}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-semibold text-bad-ink transition-colors hover:bg-bad-subtle"
            >
              <LogOut aria-hidden="true" size={18} strokeWidth={2} />
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
