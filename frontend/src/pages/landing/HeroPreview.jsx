import { FileText, ShieldCheck, Lock } from "lucide-react";

// Illustration of the product for the top of the landing page. It uses made up
// sample data and is hidden from screen readers (the text beside it says the
// same things). The caption under it says the data is not real.
const SAMPLE = [
  { name: "CBC Blood Panel", meta: "Shifa International, 14 Sep" },
  { name: "Chest X Ray Report", meta: "PIMS Radiology, 2 Sep" },
  { name: "Cardiac medication plan", meta: "Dr. Hamza Qureshi, 28 Aug" },
];

export default function HeroPreview() {
  return (
    <figure className="relative mx-auto w-full max-w-[520px] lg:mx-0" aria-hidden="true">
      <div className="card card-lift p-6 sm:p-7 lg:ml-auto lg:w-[88%]">
        <div className="display text-xl text-ink">Your health story</div>
        <div className="eyebrow mt-5">September 2026</div>
        <ul className="ml-1.5 mt-3 space-y-3 border-l-2 border-line-strong pl-6">
          {SAMPLE.map((r) => (
            <li key={r.name} className="card-inset relative px-4 py-3.5">
              <span className="absolute -left-[33px] top-5 h-3.5 w-3.5 rounded-full border-[3px] border-brand bg-surface" />
              <div className="flex items-center gap-2 font-bold text-ink">
                <FileText size={16} className="text-brand" />
                {r.name}
              </div>
              <div className="mt-0.5 text-xs text-muted">{r.meta}</div>
            </li>
          ))}
        </ul>
      </div>

      <div className="panel-deep mt-4 p-5 sm:max-w-[300px] lg:absolute lg:-bottom-6 lg:left-0 lg:mt-0">
        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-deep-on-muted">
          <ShieldCheck size={15} /> Integrity check
        </div>
        <div className="display mt-1.5 text-xl">All 3 records intact</div>
        <div className="mt-2 font-mono text-[11px] text-deep-on-muted">Ethereum Sepolia testnet</div>
      </div>

      <div className="card card-lift mt-4 flex items-center gap-3 px-4 py-3 sm:w-fit lg:absolute lg:-bottom-12 lg:right-4 lg:mt-0">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-subtle text-sm font-bold text-brand">HQ</span>
        <span>
          <span className="block text-sm font-bold text-ink">Dr. Hamza can view</span>
          <span className="flex items-center gap-1 text-xs text-muted"><Lock size={12} /> 30 day access</span>
        </span>
      </div>

      <figcaption className="mt-5 text-center text-xs text-muted lg:mt-20 lg:text-left">
        Illustration with sample data.
      </figcaption>
    </figure>
  );
}
