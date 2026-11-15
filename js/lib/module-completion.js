// Pure helpers for deriving module/lesson completion from reading depth or exercise keys.
// Zero DOM dependencies so all logic can be unit-tested via node:test.

/**
 * Derive "course/module" from a lesson key ("course/module/lesson")
 * or an exercise key ("course/module/lesson#exercise").
 */
export function moduleKeyFromKey(key) {
  const clean = String(key || '').split('#')[0].trim();
  const parts = clean.split('/').filter(Boolean);
  if (parts.length < 2) return '';
  return `${parts[0]}/${parts[1]}`;
}

/**
 * Derive "course/module/lesson" from an exercise key ("course/module/lesson#exercise").
 */
export function lessonKeyFromExerciseKey(key) {
  const clean = String(key || '').split('#')[0].trim();
  const parts = clean.split('/').filter(Boolean);
  if (parts.length < 3) return '';
  return `${parts[0]}/${parts[1]}/${parts[2]}`;
}

/**
 * Determine whether the user has finished reading a lesson page based on
 * scroll depth and whether the document requires scrolling.
 */
export function isReadingComplete({
  scrollPct = 0,
  footerVisible = false,
  hasScrolled = false,
  needsScroll = true,
  dwellMs = 0,
  minShortDwellMs = 1200,
  thresholdPct = 90,
} = {}) {
  const pct = Number(scrollPct) || 0;
  if (!needsScroll) {
    return dwellMs >= minShortDwellMs;
  }
  if (hasScrolled && (pct >= thresholdPct || footerVisible)) {
    return true;
  }
  return false;
}
