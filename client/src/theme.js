import { useEffect, useState } from 'react';

// Colorblind-safe categorical palette (light-mode shade -> dark-mode shade).
// Categories store the light hex; charts swap in the dark shade in dark mode.
const DARK_SHADES = {
  '#2a78d6': '#3987e5', // blue
  '#eb6834': '#d95926', // orange
  '#1baf7a': '#199e70', // aqua
  '#eda100': '#c98500', // yellow
  '#e87ba4': '#d55181', // magenta
  '#008300': '#22a022', // green
  '#6250d6': '#9085e9', // violet
  '#e34948': '#e66767', // red
};
export const PALETTE = Object.keys(DARK_SHADES);

export const seriesColor = (hex, dark) => (dark && DARK_SHADES[hex?.toLowerCase()]) || hex;

// Chart chrome colors; keep in sync with the tokens in index.css.
export const chartTokens = (dark) =>
  dark
    ? { surface: '#151a24', text: '#9aa3b5', strong: '#eef1f7', grid: '#252c3a' }
    : { surface: '#ffffff', text: '#667085', strong: '#101828', grid: '#eef0f4' };

// ---------- Light / dark theme ----------
// The user's choice is saved as 'light' or 'dark'. With no choice saved,
// the app follows the operating system setting.
const THEME_KEY = 'fd_theme';
const systemDark = () => window.matchMedia('(prefers-color-scheme: dark)');
const listeners = new Set();

const savedTheme = () => {
  try {
    return localStorage.getItem(THEME_KEY);
  } catch {
    return null;
  }
};

const isDark = () => {
  const saved = savedTheme();
  return saved ? saved === 'dark' : systemDark().matches;
};

// Sets <html data-theme="..."> so the CSS tokens switch.
export function applySavedTheme() {
  const saved = savedTheme();
  if (saved) document.documentElement.dataset.theme = saved;
  else delete document.documentElement.dataset.theme;
}

export function toggleTheme() {
  const next = isDark() ? 'light' : 'dark';
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    // Storage blocked: the switch still works until the page reloads.
  }
  document.documentElement.dataset.theme = next;
  listeners.forEach((update) => update());
}

export function useDarkMode() {
  const [dark, setDark] = useState(isDark);
  useEffect(() => {
    const update = () => setDark(isDark());
    const mql = systemDark();
    listeners.add(update);
    mql.addEventListener('change', update);
    return () => {
      listeners.delete(update);
      mql.removeEventListener('change', update);
    };
  }, []);
  return dark;
}
