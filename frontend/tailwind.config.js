/** @type {import('tailwindcss').Config} */

// Colors come from CSS variables in src/styles/tokens.css, so one class such as
// bg-surface or text-ink works in both light and dark. The <alpha-value> part
// lets opacity shortcuts like bg-brand/10 work.
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Surfaces
        canvas: token("canvas"),
        surface: token("surface"),
        inset: token("inset"),
        // Text
        ink: { DEFAULT: token("ink"), soft: token("ink-soft") },
        muted: token("muted"),
        // Lines: "line" is for dividers, "line-strong" is for control borders
        line: { DEFAULT: token("line"), strong: token("line-strong") },
        // Brand
        brand: {
          DEFAULT: token("brand"),
          strong: token("brand-strong"),
          subtle: token("brand-subtle"),
          on: token("on-brand"),
        },
        // Dark feature panels (used for the security style sections)
        deep: {
          DEFAULT: token("deep"),
          2: token("deep-2"),
          on: token("on-deep"),
          "on-soft": token("on-deep-soft"),
          "on-muted": token("on-deep-muted"),
        },
        // Status tones. Plain DEFAULT is for icons and borders, subtle is a
        // tinted background, ink is the text that sits on the subtle color.
        ok: { DEFAULT: token("ok"), subtle: token("ok-subtle"), ink: token("ok-ink") },
        warn: { DEFAULT: token("warn"), subtle: token("warn-subtle"), ink: token("warn-ink") },
        bad: { DEFAULT: token("bad"), subtle: token("bad-subtle"), ink: token("bad-ink") },
        plain: { subtle: token("neutral-subtle"), ink: token("neutral-ink") },
      },
      fontFamily: {
        sans: ["\"Source Sans 3\"", "ui-sans-serif", "system-ui", "-apple-system", "Segoe UI", "sans-serif"],
        display: ['"Source Serif 4"', "ui-serif", "Georgia", "serif"],
        mono: ['"JetBrains Mono"', "ui-monospace", "SFMono-Regular", "Menlo", "Consolas", "monospace"],
      },
      borderRadius: {
        card: "1.5rem",
      },
      boxShadow: {
        card: "0 24px 48px -28px rgb(var(--c-ink) / 0.35)",
      },
    },
  },
  plugins: [],
}
