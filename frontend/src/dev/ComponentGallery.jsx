import { useState } from "react";
import { Sun, Moon, Search, Upload, ArrowRight, Lock, ShieldCheck } from "lucide-react";
import StatusPill from "../components/ui/StatusPill";
import FilterChips from "../components/ui/FilterChips";

/*
 * Dev only page at /dev/components. It exists so the design pieces can be
 * checked in one place, in light and dark, before any real page uses them.
 * It is not part of a production build. All data below is sample data.
 */

const SURFACE_SWATCHES = [
  ["canvas", "bg-canvas"],
  ["surface", "bg-surface"],
  ["inset", "bg-inset"],
];
const TEXT_SWATCHES = [
  ["ink", "bg-ink"],
  ["ink-soft", "bg-ink-soft"],
  ["muted", "bg-muted"],
];
const LINE_SWATCHES = [
  ["line", "bg-line"],
  ["line-strong", "bg-line-strong"],
];
const BRAND_SWATCHES = [
  ["brand", "bg-brand"],
  ["brand-strong", "bg-brand-strong"],
  ["brand-subtle", "bg-brand-subtle"],
  ["brand-on", "bg-brand-on"],
];
const STATUS_SWATCHES = [
  ["ok", "bg-ok"],
  ["ok-subtle", "bg-ok-subtle"],
  ["ok-ink", "bg-ok-ink"],
  ["warn", "bg-warn"],
  ["warn-subtle", "bg-warn-subtle"],
  ["warn-ink", "bg-warn-ink"],
  ["bad", "bg-bad"],
  ["bad-subtle", "bg-bad-subtle"],
  ["bad-ink", "bg-bad-ink"],
  ["plain-subtle", "bg-plain-subtle"],
  ["plain-ink", "bg-plain-ink"],
];
const DEEP_SWATCHES = [
  ["deep", "bg-deep"],
  ["deep-2", "bg-deep-2"],
  ["deep-on", "bg-deep-on"],
  ["deep-on-soft", "bg-deep-on-soft"],
  ["deep-on-muted", "bg-deep-on-muted"],
];

function Section({ id, title, note, children }) {
  return (
    <section aria-labelledby={id} className="mt-14">
      <h2 id={id} className="display text-3xl">{title}</h2>
      {note && <p className="mt-2 max-w-2xl text-ink-soft">{note}</p>}
      <div className="mt-6">{children}</div>
    </section>
  );
}

function Swatches({ label, items }) {
  return (
    <div>
      <div className="eyebrow mb-3">{label}</div>
      <ul className="flex flex-wrap gap-3">
        {items.map(([name, cls]) => (
          <li key={name} className="w-28">
            <div className={`h-14 rounded-xl border border-line ${cls}`} />
            <div className="mt-1.5 text-[13px] font-semibold leading-4">{name}</div>
            <div className="font-mono text-[11px] leading-4 text-muted">{cls}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ComponentGallery() {
  const [theme, setTheme] = useState("light");
  const [name, setName] = useState("");
  const [chip, setChip] = useState("all");

  return (
    <div data-theme={theme} className="min-h-screen bg-canvas font-sans text-ink">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <div className="display text-2xl">MedLock components</div>
            <div className="text-sm text-muted">Dev only page. Sample data, nothing here is saved.</div>
          </div>
          <div role="group" aria-label="Theme" className="flex gap-2">
            <button
              type="button"
              className={`btn btn-sm ${theme === "light" ? "btn-primary" : "btn-secondary"}`}
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
            >
              <Sun size={16} aria-hidden="true" /> Light
            </button>
            <button
              type="button"
              className={`btn btn-sm ${theme === "dark" ? "btn-primary" : "btn-secondary"}`}
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
            >
              <Moon size={16} aria-hidden="true" /> Dark
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 pb-24">
        <Section
          id="colors"
          title="Colors"
          note="Every color is a token, so the same class works in light and dark. The class names are shown under each swatch."
        >
          <div className="grid gap-8">
            <Swatches label="Surfaces" items={SURFACE_SWATCHES} />
            <Swatches label="Text" items={TEXT_SWATCHES} />
            <Swatches label="Lines" items={LINE_SWATCHES} />
            <Swatches label="Brand" items={BRAND_SWATCHES} />
            <Swatches label="Status" items={STATUS_SWATCHES} />
            <Swatches label="Dark panel" items={DEEP_SWATCHES} />
          </div>
        </Section>

        <Section id="type" title="Type" note="Source Sans 3 for the interface, Source Serif 4 for large headings, JetBrains Mono for hashes.">
          <div className="card card-pad grid gap-5">
            <div>
              <div className="eyebrow">Heading, display</div>
              <p className="display mt-2 text-5xl leading-tight">
                Your health story, <em>sealed</em> and in your hands.
              </p>
            </div>
            <div>
              <div className="eyebrow">Body, Source Sans 3</div>
              <p className="mt-2 max-w-2xl text-lg leading-relaxed text-ink-soft">
                Keep every report, scan and prescription in one place. Choose which doctor can see your
                records, and for how long.
              </p>
            </div>
            <div>
              <div className="eyebrow">Hash, mono</div>
              <p className="hash mt-2">7a3f09e2c41d8b5a6f0e93d27b1c4a58e9d0f3b2a1c6e7d8f4a5b3c2d1e0f9a8</p>
            </div>
          </div>
        </Section>

        <Section id="buttons" title="Buttons" note="Minimum height is 44px. Disabled buttons also set the disabled attribute.">
          <div className="card card-pad grid gap-6">
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary">Primary</button>
              <button type="button" className="btn btn-secondary">Secondary</button>
              <button type="button" className="btn btn-ghost">Ghost</button>
              <button type="button" className="btn btn-danger">Revoke access</button>
              <button type="button" className="btn btn-primary" disabled>Disabled</button>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="btn btn-primary btn-sm">Small</button>
              <button type="button" className="btn btn-primary">
                <Upload size={18} aria-hidden="true" /> Add record
              </button>
              <button type="button" className="btn btn-primary btn-lg">
                Create your vault <ArrowRight size={20} aria-hidden="true" />
              </button>
              <a href="#colors" className="link">A text link</a>
            </div>
          </div>
        </Section>

        <Section id="fields" title="Form fields" note="Borders use the stronger line color so they are easy to see. Try tabbing through to check the focus ring.">
          <div className="card card-pad grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="g-name" className="field-label">Full name</label>
              <input
                id="g-name"
                className="field"
                placeholder="Ayesha Rahman"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
              />
              <p className="field-hint">As it appears on your reports.</p>
            </div>
            <div>
              <label htmlFor="g-search" className="field-label">Search records</label>
              <div className="relative">
                <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input id="g-search" type="search" className="field pl-10" placeholder="Search by name or hospital" />
              </div>
            </div>
            <div>
              <label htmlFor="g-email" className="field-label">Email</label>
              <input
                id="g-email"
                type="email"
                className="field"
                defaultValue="ayesha@example"
                aria-invalid="true"
                aria-describedby="g-email-error"
              />
              <p id="g-email-error" className="field-error">Enter a full email address, for example name@example.com.</p>
            </div>
            <div>
              <label htmlFor="g-type" className="field-label">Record type</label>
              <select id="g-type" className="field">
                <option>Lab result</option>
                <option>Imaging</option>
                <option>Prescription</option>
                <option>Report</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="g-note" className="field-label">Note</label>
              <textarea id="g-note" rows={3} className="field" placeholder="Anything the doctor should know" />
            </div>
            <label className="flex items-center gap-3 text-[15px]">
              <input type="checkbox" className="h-5 w-5 accent-brand" defaultChecked />
              Keep me signed in on this device
            </label>
          </div>
        </Section>

        <Section id="pills" title="Status badges" note="Each badge carries an icon and a text label, so color is never the only signal.">
          <div className="card card-pad flex flex-wrap items-center gap-3">
            <StatusPill tone="ok">Verified</StatusPill>
            <StatusPill tone="warn">Waiting for patient</StatusPill>
            <StatusPill tone="bad">Does not match</StatusPill>
            <StatusPill tone="plain">Cannot verify yet</StatusPill>
            <StatusPill tone="brand">Encrypted</StatusPill>
          </div>
        </Section>

        <Section id="filters" title="Filter chips" note="Used on the admin lists. They wrap on small screens and keep a visible selected state.">
          <FilterChips
            label="Sample filter"
            options={[
              { label: "All", value: "all" },
              { label: "Pending", value: "pending" },
              { label: "Approved", value: "approved" },
            ]}
            value={chip}
            onChange={setChip}
          />
        </Section>

        <Section id="cards" title="Cards and panels">
          <div className="grid gap-6 md:grid-cols-2">
            <div className="card card-pad card-lift">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="eyebrow">Sample record</div>
                  <h3 className="display mt-1 text-2xl">CBC Blood Panel</h3>
                  <p className="mt-1 text-sm text-muted">Sample lab, 14 September</p>
                </div>
                <StatusPill tone="ok">Verified</StatusPill>
              </div>
              <dl className="card-inset mt-5 grid gap-2 p-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Storage</dt>
                  <dd>Encrypted with AES 256 before storage</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted">Network</dt>
                  <dd>Recorded on Ethereum Sepolia testnet</dd>
                </div>
                <div>
                  <dt className="text-muted">Hash</dt>
                  <dd className="hash mt-1">7a3f09e2c41d8b5a6f0e93d27b1c4a58</dd>
                </div>
              </dl>
              <div className="mt-5 flex gap-3">
                <button type="button" className="btn btn-primary btn-sm">Verify again</button>
                <button type="button" className="btn btn-secondary btn-sm">Download</button>
              </div>
            </div>

            <div className="panel-deep p-8">
              <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[0.14em] text-deep-on-muted">
                <ShieldCheck size={18} aria-hidden="true" /> Integrity check
              </div>
              <h3 className="display mt-3 text-3xl">All 24 records intact</h3>
              <p className="mt-2 text-deep-on-soft">Sample panel on the dark surface. Text keeps its contrast here too.</p>
              <div className="mt-5 rounded-2xl bg-deep-2 p-4">
                <div className="flex items-center gap-2 text-sm text-deep-on-soft">
                  <Lock size={16} aria-hidden="true" /> Checked today
                </div>
                <div className="mt-1 font-mono text-[13px] text-deep-on-muted">block 6,812,440 (sample)</div>
              </div>
            </div>
          </div>
        </Section>
      </main>
    </div>
  );
}
