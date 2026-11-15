// Pure daily study goal & 7-day learning activity analytics.
// Zero DOM dependencies so every calculation can be unit-tested via node:test.

import { dayKey } from './util.js';

export const GOAL_PRESETS = [15, 30, 45, 60];
export const DEFAULT_GOAL_MINUTES = 15;

export function normalizeGoalMinutes(value) {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n <= 0) return DEFAULT_GOAL_MINUTES;
  return Math.min(180, Math.max(5, n));
}

function addDays(ymd, delta) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, (d || 1) + delta);
  return dayKey(dt.getTime());
}

function weekdayShort(ymd) {
  const [y, m, d] = String(ymd).split('-').map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  try {
    return dt.toLocaleDateString(undefined, { weekday: 'short' });
  } catch {
    return ymd.slice(5);
  }
}

export function sanitizeDayRecord(rec) {
  if (!rec || typeof rec !== 'object') return { seconds: 0, lessons: 0, exercises: 0 };
  const sec = Math.max(0, Math.floor(Number(rec.seconds) || 0));
  const lessons = Math.max(0, Math.floor(Number(rec.lessons) || 0));
  const exercises = Math.max(0, Math.floor(Number(rec.exercises) || 0));
  return { seconds: sec, lessons, exercises };
}

/**
 * Compute progress toward today's study time goal.
 */
export function computeDailyGoalProgress(state, today = dayKey()) {
  const goalMinutes = normalizeGoalMinutes(state?.dailyGoalMinutes);
  const goalSeconds = goalMinutes * 60;
  const rec = sanitizeDayRecord(state?.dailyActivity?.[today]);
  const studiedSeconds = rec.seconds;
  const studiedMinutes = Math.floor(studiedSeconds / 60);
  const pct = goalSeconds > 0 ? Math.min(100, Math.round((studiedSeconds / goalSeconds) * 100)) : 0;
  const remainingSeconds = Math.max(0, goalSeconds - studiedSeconds);
  return {
    today,
    goalMinutes,
    goalSeconds,
    studiedSeconds,
    studiedMinutes,
    pct,
    remainingSeconds,
    reached: studiedSeconds >= goalSeconds,
    lessonsToday: rec.lessons,
    exercisesToday: rec.exercises,
  };
}

/**
 * Build an ordered 7-day (oldest -> today) activity series for bar visualization.
 */
export function buildWeeklyActivitySeries(state, today = dayKey(), days = 7) {
  const count = Math.min(14, Math.max(1, Math.floor(days) || 7));
  const goalMinutes = normalizeGoalMinutes(state?.dailyGoalMinutes);
  const goalSeconds = goalMinutes * 60;
  const map = state?.dailyActivity && typeof state.dailyActivity === 'object' ? state.dailyActivity : {};

  const raw = [];
  let maxSeconds = goalSeconds;
  for (let offset = -(count - 1); offset <= 0; offset++) {
    const key = addDays(today, offset);
    const rec = sanitizeDayRecord(map[key]);
    if (rec.seconds > maxSeconds) maxSeconds = rec.seconds;
    raw.push({
      dateKey: key,
      weekdayLabel: weekdayShort(key),
      shortDate: key.slice(5),
      seconds: rec.seconds,
      minutes: Math.round(rec.seconds / 60),
      lessons: rec.lessons,
      exercises: rec.exercises,
      isToday: key === today,
      goalReached: rec.seconds >= goalSeconds,
    });
  }

  return raw.map((item) => ({
    ...item,
    heightPct: maxSeconds > 0 ? Math.round((item.seconds / maxSeconds) * 100) : 0,
  }));
}

/**
 * Summarize weekly study totals for the Progress dashboard.
 */
export function summarizeWeeklyActivity(series) {
  const list = Array.isArray(series) ? series : [];
  let totalSeconds = 0;
  let activeDays = 0;
  let goalDays = 0;
  let lessons = 0;
  let exercises = 0;
  for (const d of list) {
    totalSeconds += d.seconds || 0;
    lessons += d.lessons || 0;
    exercises += d.exercises || 0;
    if ((d.seconds || 0) > 0 || (d.lessons || 0) > 0 || (d.exercises || 0) > 0) activeDays += 1;
    if (d.goalReached) goalDays += 1;
  }
  return { totalSeconds, activeDays, goalDays, lessons, exercises };
}
