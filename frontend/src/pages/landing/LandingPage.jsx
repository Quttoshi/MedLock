import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Lock,
  ArrowRight,
  Menu,
  X,
  CircleCheck,
  User,
  Building2,
} from "lucide-react";
import ThemeToggle from "../../theme/ThemeToggle";
import { useAuth } from "../../context/AuthContext";
import "./landing.css";
import {
  NAV_LINKS,
  HERO,
  CALLOUT,
  PLATFORM,
  ROLES,
  SECURITY,
  HOW,
  HELP,
  FOOTER,
  PROJECT,
} from "./content";

const DASHBOARDS = {
  patient: "/patient/dashboard",
  doctor: "/doctor/dashboard",
  medical_center: "/mc/dashboard",
  admin: "/admin/dashboard",
};

const HELP_ICONS = { user: User, building: Building2 };

function Logo() {
  return (
    <Link to="/" className="lp-logo" aria-label="MedLock home">
      <Lock aria-hidden="true" size={28} strokeWidth={2.2} color="var(--lp-teal)" />
      <span className="lp-display lp-logo-mark">
        med<span>lock</span>
      </span>
    </Link>
  );
}

// Thin bar at the very top. Someone who is already signed in goes straight to
// their dashboard. This only reads the saved session, nothing else.
function TopBar({ dashboard }) {
  return (
    <header className="lp-top">
      <div className="lp-wrap lp-top-inner">
        <Logo />
        <div className="lp-top-links">
          {dashboard ? (
            <Link to={dashboard}>Open dashboard</Link>
          ) : (
            <>
              <Link to="/login">Sign in</Link>
              <Link to="/register">Create account</Link>
            </>
          )}
          <ThemeToggle variant="deep" />
        </div>
      </div>
    </header>
  );
}

function Hero({ dashboard, goToRole }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <section className="lp-hero" aria-labelledby="hero-title">
      <img
        src="/images/landing/hero-consultation.jpg"
        alt=""
        width="1920"
        height="1080"
        fetchPriority="high"
        decoding="async"
        className="lp-hero-img"
      />
      <div className="lp-hero-shade" aria-hidden="true" />
      <div className="lp-wrap lp-hero-inner">
        <nav className="lp-pill" data-open={open} aria-label="Main">
          <button
            type="button"
            className="lp-pill-menu"
            aria-expanded={open}
            aria-controls="lp-pill-links"
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" size={22} /> : <Menu aria-hidden="true" size={22} />}
            Menu
          </button>
          <div id="lp-pill-links" className="lp-pill-links">
            {NAV_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={close}>
                {l.label}
              </a>
            ))}
          </div>
          <div className="lp-pill-cta">
            {dashboard ? (
              <Link to={dashboard} className="lp-btn lp-btn--pale">
                Open dashboard
              </Link>
            ) : (
              <Link to="/register" className="lp-btn lp-btn--pale">
                Get started
              </Link>
            )}
          </div>
        </nav>

        <div className="lp-hero-copy">
          <h1 id="hero-title" className="lp-display lp-h1">
            {HERO.title}
          </h1>
          <p className="lp-lead">{HERO.text}</p>
          <div className="lp-hero-actions">
            {dashboard ? (
              <Link to={dashboard} className="lp-btn lp-btn--lg lp-btn--white">
                Open your dashboard
              </Link>
            ) : (
              <Link to="/register" className="lp-btn lp-btn--lg lp-btn--white">
                {HERO.primary}
              </Link>
            )}
            <a href="#how" className="lp-btn lp-btn--lg lp-btn--outline" onClick={() => goToRole(null)}>
              {HERO.secondary}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

function Callout() {
  return (
    <div className="lp-deep">
      <div className="lp-wrap lp-callout">
        <h2 className="lp-display">{CALLOUT.title}</h2>
        <a href="#security">
          {CALLOUT.link}
          <ArrowRight aria-hidden="true" size={20} />
        </a>
      </div>
    </div>
  );
}

function Platform({ goToRole }) {
  return (
    <section id="platform" className="lp-section" aria-labelledby="platform-title">
      <div className="lp-wrap lp-stack" style={{ gap: "clamp(2.5rem, 6vw, 4rem)" }}>
        <div className="lp-intro">
          <div>
            <p className="lp-eyebrow">{PLATFORM.eyebrow}</p>
            <h2 id="platform-title" className="lp-display lp-wordmark">
              MedLock
            </h2>
          </div>
          <div className="lp-stack" style={{ gap: "2rem", alignItems: "flex-start" }}>
            <p className="lp-lead" style={{ margin: 0 }}>
              {PLATFORM.text}
            </p>
            <a href="#roles" className="lp-btn lp-btn--lg lp-btn--brand" onClick={() => goToRole(null)}>
              {PLATFORM.cta}
            </a>
          </div>
        </div>

        <div className="lp-cards">
          {PLATFORM.cards.map((c) => (
            <article key={c.title} className="lp-card">
              <img
                src={c.image}
                alt={c.alt}
                width="1200"
                height="675"
                loading="lazy"
                decoding="async"
                style={{ objectPosition: c.position }}
              />
              <div className="lp-card-body">
                <h3 className="lp-display lp-h3">{c.title}</h3>
                <p>{c.text}</p>
                <a href="#roles" className="lp-link" onClick={() => goToRole(c.role)}>
                  {c.link}
                  <ArrowRight aria-hidden="true" size={18} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// Tabs follow the usual keyboard pattern: arrow keys move between them, Home
// and End jump to the first and last one.
function Roles({ role, setRole }) {
  const refs = useRef([]);
  const tabs = ROLES.tabs;
  const current = tabs.find((t) => t.id === role) ?? tabs[0];

  const onKeyDown = (e, index) => {
    let next = null;
    if (e.key === "ArrowRight") next = (index + 1) % tabs.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + tabs.length) % tabs.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = tabs.length - 1;
    if (next === null) return;
    e.preventDefault();
    setRole(tabs[next].id);
    refs.current[next]?.focus();
  };

  return (
    <section id="roles" className="lp-section lp-section--tint" aria-labelledby="roles-title">
      <div className="lp-wrap lp-stack" style={{ gap: "2.5rem" }}>
        <div style={{ maxWidth: "46rem" }}>
          <p className="lp-eyebrow">{ROLES.eyebrow}</p>
          <h2 id="roles-title" className="lp-display lp-h2" style={{ marginTop: "1rem" }}>
            {ROLES.title}
          </h2>
        </div>

        <div className="lp-tabs" role="tablist" aria-label="User roles">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => (refs.current[i] = el)}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={current.id === t.id}
              aria-controls="role-panel"
              tabIndex={current.id === t.id ? 0 : -1}
              className="lp-tab"
              onClick={() => setRole(t.id)}
              onKeyDown={(e) => onKeyDown(e, i)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          id="role-panel"
          role="tabpanel"
          aria-labelledby={`tab-${current.id}`}
          className="lp-rolepanel"
        >
          <div className="lp-stack" style={{ gap: "1.125rem", alignItems: "flex-start" }}>
            <h3 className="lp-display lp-h3" style={{ fontSize: "clamp(1.5rem, 1.1rem + 1.4vw, 2.25rem)" }}>
              {current.title}
            </h3>
            <p className="lp-muted" style={{ margin: 0 }}>
              {current.body}
            </p>
            <Link to={current.to} className="lp-btn lp-btn--brand" style={{ marginTop: "0.5rem" }}>
              {current.cta}
            </Link>
          </div>
          <ul className="lp-points">
            {current.points.map((p) => (
              <li key={p.head} className="lp-point">
                <CircleCheck aria-hidden="true" size={24} strokeWidth={2.2} />
                <div>
                  <strong>{p.head}</strong>
                  <span>{p.text}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function Security({ dashboard }) {
  return (
    <section id="security" className="lp-section" aria-labelledby="security-title">
      <div className="lp-wrap lp-stack" style={{ gap: "clamp(2.5rem, 5vw, 3.5rem)" }}>
        <div className="lp-split">
          <div style={{ maxWidth: "45rem" }}>
            <p className="lp-eyebrow">{SECURITY.eyebrow}</p>
            <h2 id="security-title" className="lp-display lp-h2" style={{ marginTop: "1rem" }}>
              {SECURITY.title}
            </h2>
          </div>
          {!dashboard && (
            <Link to="/register" className="lp-btn lp-btn--lg lp-btn--brand">
              {SECURITY.cta}
            </Link>
          )}
        </div>
        <ul className="lp-stats">
          {SECURITY.stats.map((s) => (
            <li key={s.value} className="lp-stat">
              <span className="lp-display lp-stat-value">{s.value}</span>
              <p>{s.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="lp-section lp-deep" aria-labelledby="how-title">
      <div className="lp-wrap lp-stack" style={{ gap: "clamp(2.5rem, 5vw, 3.5rem)" }}>
        <div style={{ maxWidth: "46rem" }}>
          <p className="lp-eyebrow">{HOW.eyebrow}</p>
          <h2 id="how-title" className="lp-display lp-h2" style={{ marginTop: "1rem" }}>
            {HOW.title}
          </h2>
        </div>
        <ol className="lp-steps">
          {HOW.steps.map((s, i) => (
            <li key={s.title} className="lp-step">
              <span className="lp-display lp-step-no" aria-hidden="true">
                {String(i + 1).padStart(2, "0")}
              </span>
              <h3 className="lp-display lp-h3">{s.title}</h3>
              <p>{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Help() {
  return (
    <section className="lp-section" aria-labelledby="help-title">
      <div className="lp-wrap lp-stack" style={{ gap: "2.5rem" }}>
        <h2 id="help-title" className="lp-display lp-h2">
          {HELP.title}
        </h2>
        <div className="lp-cards">
          {HELP.cards.map((c) => {
            const Icon = HELP_ICONS[c.icon];
            return (
              <article key={c.title} className="lp-card">
                <div className="lp-card-body">
                  <Icon className="lp-card-icon" aria-hidden="true" size={40} strokeWidth={1.8} />
                  <h3 className="lp-display lp-h3">{c.title}</h3>
                  <p>{c.text}</p>
                  <Link to={c.to} className="lp-link">
                    {c.link}
                    <ArrowRight aria-hidden="true" size={18} />
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function Footer({ goToRole, dashboard }) {
  return (
    <footer id="about" className="lp-footer">
      <div className="lp-wrap">
        <div className="lp-footer-top">
          <div className="lp-footer-brand">
            <Logo />
            <p>{FOOTER.tagline}</p>
          </div>
          {FOOTER.columns.map((col) => (
            <nav key={col.title} className="lp-footer-col" aria-label={col.title}>
              <h2>{col.title}</h2>
              <ul>
                {col.links.map((l) => (
                  <li key={l.label}>
                    <a href={l.href} onClick={() => l.role && goToRole(l.role)}>
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
          <nav className="lp-footer-col" aria-label="Account">
            <h2>Account</h2>
            <ul>
              {dashboard ? (
                <li>
                  <Link to={dashboard}>Open dashboard</Link>
                </li>
              ) : (
                <>
                  <li>
                    <Link to="/login">Sign in</Link>
                  </li>
                  <li>
                    <Link to="/register">Create account</Link>
                  </li>
                </>
              )}
            </ul>
          </nav>
        </div>

        <div className="lp-footer-bottom">
          <p>
            MedLock · Final year project, {PROJECT.university} {PROJECT.year}
          </p>
          <p>
            Team: {PROJECT.team.join(", ")}. Supervisor: {PROJECT.supervisor}.{" "}
            <a href={PROJECT.repo} target="_blank" rel="noopener noreferrer" style={{ textDecoration: "underline", textUnderlineOffset: 4 }}>
              Source code
            </a>
          </p>
          <p className="lp-footer-note">{FOOTER.note}</p>
        </div>
      </div>
    </footer>
  );
}

function LandingPage() {
  const { user } = useAuth() ?? {};
  const dashboard = user ? DASHBOARDS[user.role] : null;
  const [role, setRole] = useState(ROLES.tabs[0].id);

  // Links that point at the "Who we serve" section can also choose a tab.
  const goToRole = (id) => {
    if (id) setRole(id);
  };

  return (
    <div className="lp" id="top">
      <a href="#main" className="lp-skip">
        Skip to main content
      </a>
      <TopBar dashboard={dashboard} />
      <main id="main">
        <Hero dashboard={dashboard} goToRole={goToRole} />
        <Callout />
        <Platform goToRole={goToRole} />
        <Roles role={role} setRole={setRole} />
        <Security dashboard={dashboard} />
        <HowItWorks />
        <Help />
      </main>
      <Footer goToRole={goToRole} dashboard={dashboard} />
    </div>
  );
}

export default LandingPage;
