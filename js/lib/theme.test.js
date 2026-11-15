import test from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_PREF_KEY,
  THEME_STORAGE_KEY,
  normalizeThemePref,
  resolveEffectiveTheme,
  nextThemeMode,
  themeColorFor,
} from './theme.js';

test('theme constants match pre-paint bootstrap storage key', () => {
  assert.equal(THEME_PREF_KEY, 'theme');
  assert.equal(THEME_STORAGE_KEY, 'cq:pref:theme');
});

test('normalizeThemePref only preserves explicit light or dark values', () => {
  assert.equal(normalizeThemePref('light'), 'light');
  assert.equal(normalizeThemePref('dark'), 'dark');
  assert.equal(normalizeThemePref('auto'), 'auto');
  assert.equal(normalizeThemePref('sepia'), 'auto');
  assert.equal(normalizeThemePref(null), 'auto');
});

test('resolveEffectiveTheme prefers explicit saved preference over system preference', () => {
  assert.equal(resolveEffectiveTheme('light', true), 'light');
  assert.equal(resolveEffectiveTheme('dark', false), 'dark');
  assert.equal(resolveEffectiveTheme('auto', true), 'dark');
  assert.equal(resolveEffectiveTheme('auto', false), 'light');
  assert.equal(resolveEffectiveTheme(undefined, true), 'dark');
});

test('nextThemeMode switches cleanly between light and dark', () => {
  assert.equal(nextThemeMode('light'), 'dark');
  assert.equal(nextThemeMode('dark'), 'light');
});

test('themeColorFor returns expected hex color per mode', () => {
  assert.equal(themeColorFor('dark'), '#0a1226');
  assert.equal(themeColorFor('light'), '#0e1a33');
});
