// Header theme toggle component allowing explicit light/dark switching persisted in localStorage.

import { h } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { prefs } from '../store.js';
import {
  THEME_PREF_KEY,
  THEME_STORAGE_KEY,
  normalizeThemePref,
  resolveEffectiveTheme,
  themeColorFor,
} from '../lib/theme.js';

const darkMedia = () => (typeof window.matchMedia === 'function' ? window.matchMedia('(prefers-color-scheme: dark)') : { matches: false, addEventListener: null });

export function applyTheme(mode) {
  const root = document.documentElement;
  const pref = normalizeThemePref(mode);
  if (pref === 'light' || pref === 'dark') root.dataset.theme = pref;
  else delete root.dataset.theme;

  const active = resolveEffectiveTheme(pref, !!darkMedia().matches);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', themeColorFor(active));
  return active;
}

export function effectiveTheme() {
  return resolveEffectiveTheme(document.documentElement.dataset.theme, !!darkMedia().matches);
}

export function initTheme() {
  return applyTheme(prefs.get(THEME_PREF_KEY, 'auto'));
}

export function createThemeToggle() {
  const lightBtn = h(
    'button.theme-opt',
    {
      type: 'button',
      dataset: { mode: 'light' },
      'aria-label': 'Light mode',
      title: 'Switch to light mode',
      onclick: () => setTheme('light'),
    },
    icon('sun', 15),
    h('span.theme-opt-label', 'Light')
  );

  const darkBtn = h(
    'button.theme-opt',
    {
      type: 'button',
      dataset: { mode: 'dark' },
      'aria-label': 'Dark mode',
      title: 'Switch to dark mode',
      onclick: () => setTheme('dark'),
    },
    icon('moon', 15),
    h('span.theme-opt-label', 'Dark')
  );

  const root = h(
    'div.theme-toggle',
    { role: 'group', 'aria-label': 'Color theme' },
    lightBtn,
    darkBtn
  );

  function sync() {
    const active = effectiveTheme();
    const isDark = active === 'dark';
    root.dataset.activeTheme = active;
    lightBtn.classList.toggle('is-active', !isDark);
    lightBtn.setAttribute('aria-pressed', String(!isDark));
    darkBtn.classList.toggle('is-active', isDark);
    darkBtn.setAttribute('aria-pressed', String(isDark));
  }

  function setTheme(mode) {
    const pref = normalizeThemePref(mode);
    prefs.set(THEME_PREF_KEY, pref);
    applyTheme(pref);
    sync();
  }

  sync();

  const mq = darkMedia();
  if (mq && typeof mq.addEventListener === 'function') {
    mq.addEventListener('change', () => {
      applyTheme(prefs.get(THEME_PREF_KEY, 'auto'));
      sync();
    });
  }

  window.addEventListener('storage', (e) => {
    if (e.key === THEME_STORAGE_KEY) {
      applyTheme(prefs.get(THEME_PREF_KEY, 'auto'));
      sync();
    }
  });

  return root;
}
