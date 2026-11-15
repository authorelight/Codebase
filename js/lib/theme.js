// Pure theme resolution helpers (no DOM dependencies so logic can be unit-tested).

export const THEME_PREF_KEY = 'theme';
export const THEME_STORAGE_KEY = 'cq:pref:theme';

/**
 * Normalize a persisted theme value ('light', 'dark', or 'auto').
 */
export function normalizeThemePref(value) {
  return value === 'light' || value === 'dark' ? value : 'auto';
}

/**
 * Resolve the effective active theme ('light' or 'dark') from a saved preference
 * and whether the OS/browser prefers dark mode.
 */
export function resolveEffectiveTheme(savedPref, systemPrefersDark = false) {
  const pref = normalizeThemePref(savedPref);
  if (pref === 'light' || pref === 'dark') return pref;
  return systemPrefersDark ? 'dark' : 'light';
}

/**
 * Compute the opposite theme mode for toggling.
 */
export function nextThemeMode(currentTheme) {
  return currentTheme === 'dark' ? 'light' : 'dark';
}

/**
 * Return an appropriate browser chrome theme-color hex value for the effective theme.
 */
export function themeColorFor(theme) {
  return theme === 'dark' ? '#0a1226' : '#0e1a33';
}
