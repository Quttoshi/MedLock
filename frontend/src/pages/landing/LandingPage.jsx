import ThemeToggle from "../../theme/ThemeToggle";
import { useState } from "react";
import { Link } from "react-router-dom";
import {
  Lock,
  Link2,
  ScanText,
  UserCheck,
  ShieldCheck,
  Layers,
  BadgeCheck,
  Menu,
  X,
  ArrowRight,
  ChevronDown,
  Check,
  User,
  Stethoscope,
  Building2,
  Code,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import HeroPreview from "./HeroPreview";
import {
  NAV_LINKS,
  HERO_POINTS,
  AT_A_GLANCE,
  PROBLEMS,
  STEPS,
  FEATURES,
  ROLES,
  SECURITY_CARDS,
  SECURITY_SAMPLE,
  HONEST_LIMITS,
  FAQS,
  PROJECT,
} from "./content";

const ICONS = {
  lock: Lock,
  link: Link2,
  scan: ScanText,
  userCheck: UserCheck,
  shieldCheck: ShieldCheck,
  layers: Layers,
  badgeCheck: BadgeCheck,
};

const ROLE_ICONS = { patient: User, doctor: Stethoscope, center: Building2 };

const DASHBOARDS = {
  patient: "/patient/dashboard",
  doctor: "/doctor/dashboard",
  medical_center: "/mc/dashboard",
  admin: "/admin/dashboard",
};

const wrap = "mx-auto w-full max-w-[1240px] px-5 sm:px-8";

function SectionHeading({ eyebrow, title, children, className = "" }) {
  return (
    <div className={`max-w-2xl ${className}`}>
      {eyebrow && <p className="eyebrow">{eyebrow}</p>}
      <h2 className="display mt-3 text-balance text-[28px] leading-[1.1] sm:text-[36px]">{title}</h2>
      {children && <p className="mt-4 text-balance text-base leading-7 text-ink-soft">{children}</p>}
    </div>
  );
}

// Top bar. If someone is already signed in, the buttons take them to their
// dashboard instead of the sign in page. This only reads the saved session.
function Header() {
  const { user } = useAuth() ?? {};
  const [open, setOpen] = useState(false);
  const dashboard = user ? DASHBOARDS[user.role] : null;

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-canvas/90 backdrop-blur">
      <div className={`${wrap} flex items-center justify-between gap-4 py-3.5`}>
        <Link
          to="/"
          className="display text-[28px] leading-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand"
        >
          MedLock
        </Link>

        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-full px-3.5 py-2 text-sm font-semibold text-ink-soft transition-colors hover:bg-inset hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {dashboard ? (
            <Link to={dashboard} className="btn btn-primary btn-sm">
              Open dashboard
              <ArrowRight aria-hidden="true" size={16} />
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link to="/register" className="btn btn-primary btn-sm hidden sm:inline-flex">Create account</Link>
            </>
          )}
          <button
            type="button"
            className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink lg:hidden focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand"
            aria-expanded={open}
            aria-controls="mobile-menu"
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X aria-hidden="true" size={20} /> : <Menu aria-hidden="true" size={20} />}
          </button>
        </div>
      </div>

      {open && (
        <nav id="mobile-menu" aria-label="Main" className="border-t border-line bg-canvas lg:hidden">
          <ul className={`${wrap} py-3`}>
            {NAV_LINKS.map((l) => (
              <li key={l.href}>
                <a
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-xl px-3 py-3 text-base font-semibold text-ink hover:bg-inset"
                >
                  {l.label}
                </a>
              </li>
            ))}
            {!dashboard && (
              <li className="pt-2">
                <Link to="/register" className="btn btn-primary w-full">Create account</Link>
              </li>
            )}
          </ul>
        </nav>
      )}
    </header>
  );
}

function Hero() {
  const { user } = useAuth() ?? {};
  const dashboard = user ? DASHBOARDS[user.role] : null;
  return (
    <section className={`${wrap} grid items-center gap-14 pb-24 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:pb-32`}>
      <div>
        <p className="inline-flex items-center gap-2 rounded-full bg-surface px-3.5 py-2 text-sm font-semibold text-ink">
          <ShieldCheck aria-hidden="true" size={16} className="text-brand" />
          Patient controlled medical records
        </p>
        <h1 className="display mt-6 text-[40px] leading-[1.08] sm:text-[48px] lg:text-[54px]">
          Your health story, <em>sealed</em> and in your hands.
        </h1>
        <p className="mt-6 max-w-xl text-[18px] leading-8 text-ink-soft">
          Keep every report, scan and prescription in one encrypted place. Choose which doctor sees what, and for
          how long. Check at any time that a file has not been changed.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          {dashboard ? (
            <Link to={dashboard} className="btn btn-primary btn-lg">
              Open your dashboard
              <ArrowRight aria-hidden="true" size={18} />
            </Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-primary btn-lg">
                Create your account
                <ArrowRight aria-hidden="true" size={18} />
              </Link>
              <a href="#how" className="btn btn-secondary btn-lg">See how it works</a>
            </>
          )}
        </div>
        {!dashboard && (
          <p className="mt-4 text-sm text-muted">
            Already have an account? <Link to="/login" className="link">Sign in</Link>
          </p>
        )}
        <ul className="mt-9 grid gap-3 text-sm font-semibold text-ink-soft sm:grid-cols-1">
          {HERO_POINTS.map((p) => {
            const PointIcon = ICONS[p.icon];
            return (
              <li key={p.text} className="flex items-center gap-3">
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-brand-subtle text-brand">
                  <PointIcon aria-hidden="true" size={16} />
                </span>
                {p.text}
              </li>
            );
          })}
        </ul>
      </div>
      <HeroPreview />
    </section>
  );
}

function AtAGlance() {
  return (
    <section aria-label="At a glance" className="border-y border-line bg-surface">
      <dl className={`${wrap} grid grid-cols-2 gap-x-6 gap-y-8 py-10 lg:grid-cols-4`}>
        {AT_A_GLANCE.map((s) => (
          <div key={s.value}>
            <dt className="display text-[28px] leading-none text-brand sm:text-[32px]">{s.value}</dt>
            <dd className="mt-2 max-w-[16rem] text-sm leading-6 text-ink-soft">{s.label}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function Problem() {
  return (
    <section className={`${wrap} py-20 sm:py-28`}>
      <SectionHeading eyebrow="Why MedLock" title="Your medical history should not live in a drawer">
        Health records are created in many places and owned by none of them. MedLock puts you in the middle.
      </SectionHeading>
      <ul className="mt-12 grid gap-5 md:grid-cols-3">
        {PROBLEMS.map((p) => (
          <li key={p.title} className="border-t-2 border-ink pt-5">
            <h3 className="text-[18px] font-bold text-ink">{p.title}</h3>
            <p className="mt-2 text-sm leading-7 text-ink-soft">{p.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how" className="scroll-mt-20 bg-surface">
      <div className={`${wrap} py-20 sm:py-28`}>
        <SectionHeading eyebrow="How it works" title="Three steps from paper file to protected record" />
        <ol className="mt-12 grid gap-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s.title} className="border-t-2 border-ink pt-5">
              <span className="display text-[44px] leading-none text-brand" aria-hidden="true">{i + 1}</span>
              <h3 className="mt-3 text-[18px] font-bold text-ink">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </h3>
              <p className="mt-2 text-sm leading-7 text-ink-soft">{s.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className={`${wrap} scroll-mt-20 py-20 sm:py-28`}>
      <SectionHeading eyebrow="Features" title="Everything you need to keep records in order">
        Built around a few ideas: your files are protected, you give consent, and nothing changes without you noticing.
      </SectionHeading>
      <ul className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => {
          const FeatureIcon = ICONS[f.icon];
          return (
            <li key={f.title} className="card p-7">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-subtle text-brand">
                <FeatureIcon aria-hidden="true" size={22} />
              </span>
              <h3 className="mt-5 text-[18px] font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-7 text-ink-soft">{f.text}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// A small picture of the consent step. Sample data, hidden from screen readers.
function ConsentDemo() {
  return (
    <section className="bg-surface">
      <div className={`${wrap} grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2`}>
        <div>
          <SectionHeading eyebrow="Consent" title="Nothing is shared until you say yes">
            When a doctor needs your records, they send a request. You see who is asking and why, then approve or
            deny it. Approval lasts 30 days, and you can take it back whenever you like.
          </SectionHeading>
          <ul className="mt-6 space-y-3 text-sm text-ink-soft">
            {["Doctors must be verified before they can ask", "Every decision is written to an audit log", "Access ends by itself after 30 days"].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <Check aria-hidden="true" size={20} className="mt-0.5 flex-shrink-0 text-brand" />
                {t}
              </li>
            ))}
          </ul>
        </div>

        <figure aria-hidden="true" className="mx-auto w-full max-w-[480px]">
          <div className="card card-lift p-6">
            <div className="flex items-start gap-3">
              <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full bg-brand-subtle text-sm font-bold text-brand">SM</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-base font-bold text-ink">Dr. Sana Malik</span>
                  <span className="pill pill-warn">Waiting for you</span>
                </div>
                <div className="text-sm text-muted">Neurology, license verified</div>
              </div>
            </div>
            <div className="card-inset mt-4 p-4 text-sm text-ink-soft">
              <div className="eyebrow">Reason</div>
              <p className="mt-1.5">Follow up on your lab results.</p>
            </div>
            <p className="mt-4 text-xs text-muted">Approving gives access for 30 days. You can take it back at any time.</p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <span className="btn btn-primary">Approve</span>
              <span className="btn btn-secondary">Deny</span>
            </div>
          </div>
          <figcaption className="mt-3 text-center text-xs text-muted">Illustration with sample data.</figcaption>
        </figure>
      </div>
    </section>
  );
}

function Roles() {
  return (
    <section id="roles" className={`${wrap} scroll-mt-20 py-20 sm:py-28`}>
      <SectionHeading eyebrow="Who it is for" title="Built for everyone involved in your care" />
      <ul className="mt-12 grid gap-5 lg:grid-cols-3">
        {ROLES.map((r) => {
          const RoleIcon = ROLE_ICONS[r.key];
          return (
            <li key={r.key} className="card flex flex-col p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-subtle text-brand">
                  <RoleIcon aria-hidden="true" size={20} />
                </span>
                <span className="eyebrow !text-brand">{r.label}</span>
              </div>
              <h3 className="display mt-5 text-[28px] leading-[1.15]">{r.title}</h3>
              <p className="mt-3 text-sm leading-7 text-ink-soft">{r.text}</p>
              <ul className="mt-5 space-y-2.5 text-sm text-ink-soft">
                {r.points.map((pt) => (
                  <li key={pt} className="flex items-start gap-2.5">
                    <Check aria-hidden="true" size={18} className="mt-0.5 flex-shrink-0 text-brand" />
                    {pt}
                  </li>
                ))}
              </ul>
              <Link to={r.to} className="btn btn-secondary mt-8 w-full sm:w-auto sm:self-start">
                {r.cta}
                <ArrowRight aria-hidden="true" size={16} />
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

function Security() {
  return (
    <section id="security" className="scroll-mt-20 bg-deep text-deep-on">
      <div className={`${wrap} grid gap-12 py-20 sm:py-28 lg:grid-cols-2`}>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-deep-on-muted">Security</p>
          <h2 className="display mt-3 text-[28px] leading-[1.1] sm:text-[36px]">Security you can see, not just trust</h2>
          <p className="mt-4 max-w-xl text-base leading-7 text-deep-on-soft">
            Every record shows whether its fingerprint still matches the one recorded when it was uploaded, so a
            changed file does not go unnoticed.
          </p>

          <figure className="mt-8">
            <pre className="overflow-x-auto rounded-2xl bg-black/30 p-5 font-mono text-xs leading-7 text-deep-on-soft">
              {SECURITY_SAMPLE.map(([k, v]) => `${k.padEnd(8)}${v}`).join("\n")}
            </pre>
            <figcaption className="mt-2 text-xs text-deep-on-muted">Sample integrity check.</figcaption>
          </figure>

          <div className="mt-8 rounded-2xl border border-white/15 p-5">
            <h3 className="text-sm font-bold">What to know before you trust it</h3>
            <ul className="mt-3 space-y-2 text-sm leading-6 text-deep-on-soft">
              {HONEST_LIMITS.map((t) => (
                <li key={t} className="flex items-start gap-2.5">
                  <span aria-hidden="true" className="mt-2.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-deep-on-muted" />
                  {t}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ul className="space-y-4">
          {SECURITY_CARDS.map((c) => (
            <li key={c.title} className="rounded-3xl bg-deep-2 p-7">
              <h3 className="text-[18px] font-bold">{c.title}</h3>
              <p className="mt-2 text-sm leading-7 text-deep-on-soft">{c.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Faq() {
  return (
    <section id="faq" className={`${wrap} scroll-mt-20 py-20 sm:py-28`}>
      <div className="mx-auto max-w-3xl">
        <SectionHeading eyebrow="Questions" title="Things people ask before they start" />
        <div className="mt-10 space-y-3">
          {FAQS.map((f) => (
            <details key={f.q} className="group card px-6 py-5 open:shadow-card">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-[18px] font-bold text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-brand [&::-webkit-details-marker]:hidden">
                {f.q}
                <ChevronDown aria-hidden="true" size={20} className="flex-shrink-0 text-muted transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-3 text-sm leading-7 text-ink-soft">{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

function FinalCta() {
  const { user } = useAuth() ?? {};
  const dashboard = user ? DASHBOARDS[user.role] : null;
  return (
    <section className={`${wrap} pb-20 sm:pb-28`}>
      <div className="panel-deep px-6 py-14 text-center sm:px-12">
        <h2 className="display mx-auto max-w-2xl text-[28px] leading-[1.1] sm:text-[36px]">
          Start your health story <em>today</em>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-balance text-base leading-7 text-deep-on-soft">
          Create an account in a minute, add your first report, and decide who gets to see it.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          {dashboard ? (
            <Link to={dashboard} className="btn btn-lg bg-deep-on text-deep hover:opacity-90">Open your dashboard</Link>
          ) : (
            <>
              <Link to="/register" className="btn btn-lg bg-deep-on text-deep hover:opacity-90">Create your account</Link>
              <Link to="/login" className="btn btn-lg border-white/40 text-deep-on hover:bg-white/10">Sign in</Link>
            </>
          )}
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-line bg-surface">
      <div className={`${wrap} grid gap-10 py-14 md:grid-cols-[1.4fr_1fr_1fr_1fr]`}>
        <div>
          <span className="display text-[28px] leading-none">MedLock</span>
          <p className="mt-3 max-w-xs text-sm leading-6 text-ink-soft">
            Medical records that you control. Encrypted, fingerprinted and shared only with your approval.
          </p>
        </div>
        <nav aria-label="Product">
          <h2 className="eyebrow">Product</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            {NAV_LINKS.slice(0, 3).concat(NAV_LINKS.slice(4)).map((l) => (
              <li key={l.href}><a href={l.href} className="text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">{l.label}</a></li>
            ))}
          </ul>
        </nav>
        <nav aria-label="Get started">
          <h2 className="eyebrow">Get started</h2>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li><Link to="/login" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">Sign in</Link></li>
            <li><Link to="/register/patient" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">Create a patient account</Link></li>
            <li><Link to="/register/doctor" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">Register as a doctor</Link></li>
            <li><Link to="/register/medical_center" className="text-ink-soft underline-offset-4 hover:text-ink hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-brand">Register a medical center</Link></li>
          </ul>
        </nav>
        <div>
          <h2 className="eyebrow">The project</h2>
          <p className="mt-4 text-sm leading-6 text-ink-soft">
            Final year project at {PROJECT.university}, {PROJECT.year}.
          </p>
          <p className="mt-2 text-sm leading-6 text-ink-soft">
            Built by {PROJECT.team.join(", ")}. Supervised by {PROJECT.supervisor}.
          </p>
          <a href={PROJECT.repo} target="_blank" rel="noopener noreferrer" className="link mt-3 inline-flex items-center gap-2 text-sm">
            <Code aria-hidden="true" size={16} />
            Source code
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      </div>
      <div className="border-t border-line">
        <p className={`${wrap} py-5 text-xs leading-5 text-muted`}>
          MedLock is a university project and does not give medical advice, diagnosis or treatment. It records
          fingerprints on the Ethereum Sepolia test network and has not been independently audited or certified.
        </p>
      </div>
    </footer>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-canvas font-sans text-ink">
      <a
        href="#content"
        className="sr-only rounded-full bg-deep px-4 py-2 text-sm font-semibold text-deep-on focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50"
      >
        Skip to content
      </a>
      <Header />
      <main id="content">
        <Hero />
        <AtAGlance />
        <Problem />
        <HowItWorks />
        <Features />
        <ConsentDemo />
        <Roles />
        <Security />
        <Faq />
        <FinalCta />
      </main>
      <Footer />
    </div>
  );
}
