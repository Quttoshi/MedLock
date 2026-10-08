// Row of filter buttons for admin lists. Wraps on small screens.
// options: [{ label, value }]. The parent owns the state.
export default function FilterChips({ label, options, value, onChange }) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          aria-pressed={value === o.value}
          className={`rounded-full border px-4 py-2 text-sm font-bold capitalize transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand ${
            value === o.value
              ? "border-deep bg-deep text-deep-on"
              : "border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
