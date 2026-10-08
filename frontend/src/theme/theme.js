import { useSyncExternalStore } from "react";

// Day and night mode. This only changes how the site looks. The choice is
// kept in this browser (localStorage) and is never sent to the server.
// With no saved choice, the site follows the device setting.
const KEY = "medlock-theme";
const listeners = new Set();

function systemTheme() {
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  } catch {
    return "light";
  }
}

function savedTheme() {
  try {
    const v = localStorage.getItem(KEY);
    return v === "dark" || v === "light" ? v : null;
  } catch {
    return null;
  }
}

export function currentTheme() {
  return savedTheme() ?? systemTheme();
}

export function applyTheme(theme) {
  const root = document.documentElement;
  root.setAttribute("data-theme", theme);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute("content", theme === "dark" ? "#101A18" : "#EEF2F0");
}

export function setTheme(theme) {
  try {
    localStorage.setItem(KEY, theme);
  } catch {
    /* private mode: the choice just lasts for this visit */
  }
  applyTheme(theme);
  listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  listeners.add(fn);
  // Follow the device setting while the person has not chosen yet.
  let mq;
  const onSystem = () => {
    if (!savedTheme()) {
      applyTheme(systemTheme());
      fn();
    }
  };
  try {
    mq = window.matchMedia("(prefers-color-scheme: dark)");
    mq.addEventListener("change", onSystem);
  } catch {
    /* no matchMedia */
  }
  const onStorage = (e) => {
    if (e.key === KEY) {
      applyTheme(currentTheme());
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    mq?.removeEventListener("change", onSystem);
    window.removeEventListener("storage", onStorage);
  };
}

export function useTheme() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => "light");
  return { theme, setTheme, toggle: () => setTheme(theme === "dark" ? "light" : "dark") };
}
