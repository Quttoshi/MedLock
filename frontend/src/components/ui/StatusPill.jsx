import { ShieldCheck, Clock, ShieldAlert, Info, Lock } from "lucide-react";

const TONES = {
  ok: { className: "pill-ok", DefaultIcon: ShieldCheck },
  warn: { className: "pill-warn", DefaultIcon: Clock },
  bad: { className: "pill-bad", DefaultIcon: ShieldAlert },
  plain: { className: "pill-plain", DefaultIcon: Info },
  brand: { className: "pill-brand", DefaultIcon: Lock },
};

/**
 * Status badge. It always shows an icon and a text label, so the meaning never
 * depends on color alone. Pass `icon` to swap the default icon for the tone.
 *
 *   <StatusPill tone="ok">Verified</StatusPill>
 */
export default function StatusPill({ tone = "plain", icon, children }) {
  const { className, DefaultIcon } = TONES[tone] ?? TONES.plain;
  const Icon = icon ?? DefaultIcon;
  return (
    <span className={`pill ${className}`}>
      <Icon aria-hidden="true" size={14} strokeWidth={2} />
      {children}
    </span>
  );
}
