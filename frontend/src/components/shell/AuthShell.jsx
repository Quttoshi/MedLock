import { Link } from "react-router-dom";
import { Lock, Link2 } from "lucide-react";
import ThemeToggle from "../../theme/ThemeToggle";
import "./auth.css";

// Split screen used by sign in, register, role select and email confirmation.
// The dark photo panel carries the brand message. On phones it shrinks to a
// header. The look lives in auth.css, scoped to the .auth class.
export default function AuthShell({ children }) {
  return (
    <div className="auth auth-page">
      <aside className="auth-aside">
        <img
          src="/images/landing/hero-consultation.jpg"
          alt=""
          width="1920"
          height="1080"
          decoding="async"
          className="auth-aside-img"
        />
        <div className="auth-aside-shade" aria-hidden="true" />

        <div className="auth-head">
          <Link to="/" className="auth-logo display" aria-label="MedLock home">
            <Lock aria-hidden="true" size={28} strokeWidth={2.2} color="#5fcbbe" />
            <span style={{ color: "#ffffff", fontWeight: 800 }}>
              med<span>lock</span>
            </span>
          </Link>
          <ThemeToggle variant="deep" />
        </div>

        <div className="auth-pitch">
          <h2 className="display">
            Your records,
            <br />
            <span>your say.</span>
          </h2>
          <p>Your records are encrypted before they are stored. Doctors see them only when you approve.</p>
        </div>

        <ul className="auth-facts">
          <li>
            <Lock aria-hidden="true" size={18} />
            AES 256 encryption on every file
          </li>
          <li>
            <Link2 aria-hidden="true" size={18} />
            Integrity fingerprints on Ethereum Sepolia testnet
          </li>
        </ul>
      </aside>

      <main className="auth-main">
        <div>{children}</div>
      </main>
    </div>
  );
}
