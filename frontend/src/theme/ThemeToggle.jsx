import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme";

// Icon button that switches between day and night mode.
// variant "deep" is for the dark brand panel on the sign in screens.
export default function ThemeToggle({ variant = "default", className = "" }) {
  const { theme, toggle } = useTheme();
  const isDark = theme === "dark";
  const Icon = isDark ? Sun : Moon;
  const look =
    variant === "deep"
      ? "border border-deep-on/30 text-deep-on hover:bg-deep-on/10 focus-visible:outline-deep-on"
      : "border border-line bg-surface text-ink hover:bg-inset focus-visible:outline-brand";
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={isDark ? "Switch to day mode" : "Switch to night mode"}
      title={isDark ? "Day mode" : "Night mode"}
      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${look} ${className}`}
    >
      <Icon aria-hidden="true" size={20} strokeWidth={2} />
    </button>
  );
}
