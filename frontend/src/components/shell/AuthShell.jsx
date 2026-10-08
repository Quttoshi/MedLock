import { Link } from "react-router-dom";
import { Lock, Link2 } from "lucide-react";
import ThemeToggle from "../../theme/ThemeToggle";

// Split screen used by sign in, register, role select and email confirmation.
// The dark panel carries the brand message. On phones it shrinks to a header.
export default function AuthShell({ children }) {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink lg:grid lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <aside className="bg-deep px-5 py-5 text-deep-on sm:px-10 lg:flex lg:min-h-screen lg:flex-col lg:justify-between lg:px-14 lg:py-12">
        <div className="flex items-center justify-between gap-4">
          <Link
            to="/"
            className="display text-[28px] leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-deep-on"
          >
            MedLock
          </Link>
          <ThemeToggle variant="deep" />
        </div>

        <div className="hidden lg:block">
          <p className="display text-[40px] leading-[1.1]">
            Your records,
            <br />
            <em>your say.</em>
          </p>
          <p className="mt-5 max-w-sm text-base leading-7 text-deep-on-soft">
            Your records are encrypted before they are stored. Doctors see them only when you approve.
          </p>
        </div>

        <ul className="hidden space-y-3 lg:block">
          <li className="flex items-center gap-3 text-sm text-deep-on-soft">
            <Lock aria-hidden="true" size={18} className="text-deep-on-muted" />
            AES 256 encryption on every file
          </li>
          <li className="flex items-center gap-3 text-sm text-deep-on-soft">
            <Link2 aria-hidden="true" size={18} className="text-deep-on-muted" />
            Integrity fingerprints on Ethereum Sepolia testnet
          </li>
        </ul>
      </aside>

      <main className="flex justify-center px-5 py-10 sm:px-10 lg:items-center lg:py-12">
        <div className="w-full max-w-md">{children}</div>
      </main>
    </div>
  );
}
