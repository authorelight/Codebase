import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_GOAL_MINUTES,
  normalizeGoalMinutes,
  computeDailyGoalProgress,
  buildWeeklyActivitySeries,
  summarizeWeeklyActivity,
} from './study-stats.js';

test('normalizeGoalMinutes clamps valid bounds and defaults safely', () => {
  assert.equal(normalizeGoalMinutes(undefined), DEFAULT_GOAL_MINUTES);
  assert.equal(normalizeGoalMinutes(0), DEFAULT_GOAL_MINUTES);
  assert.equal(normalizeGoalMinutes(-10), DEFAULT_GOAL_MINUTES);
  assert.equal(normalizeGoalMinutes(2), 5);
  assert.equal(normalizeGoalMinutes(30), 30);
  assert.equal(normalizeGoalMinutes(500), 180);
});

test('computeDailyGoalProgress calculates completion and remaining time accurately', () => {
  const halfDone = computeDailyGoalProgress(
    {
      dailyGoalMinutes: 20,
      dailyActivity: { '2026-11-15': { seconds: 600, lessons: 2, exercises: 3 } },
    },
    '2026-11-15'
  );
  assert.equal(halfDone.goalMinutes, 20);
  assert.equal(halfDone.studiedMinutes, 10);
  assert.equal(halfDone.pct, 50);
  assert.equal(halfDone.remainingSeconds, 600);
  assert.equal(halfDone.reached, false);
  assert.equal(halfDone.lessonsToday, 2);
  assert.equal(halfDone.exercisesToday, 3);

  const exceeded = computeDailyGoalProgress(
    {
      dailyGoalMinutes: 15,
      dailyActivity: { '2026-11-15': { seconds: 1200, lessons: 4, exercises: 5 } },
    },
    '2026-11-15'
  );
  assert.equal(exceeded.pct, 100);
  assert.equal(exceeded.remainingSeconds, 0);
  assert.equal(exceeded.reached, true);
});

test('buildWeeklyActivitySeries returns ordered 7-day window and weekly summary', () => {
  const state = {
    dailyGoalMinutes: 15,
    dailyActivity: {
      '2026-11-10': { seconds: 900, lessons: 1, exercises: 2 },
      '2026-11-14': { seconds: 1800, lessons: 3, exercises: 4 },
      '2026-11-15': { seconds: 300, lessons: 1, exercises: 0 },
    },
  };
  const series = buildWeeklyActivitySeries(state, '2026-11-15', 7);
  assert.equal(series.length, 7);
  assert.equal(series[0].dateKey, '2026-11-09');
  assert.equal(series[6].dateKey, '2026-11-15');
  assert.equal(series[6].isToday, true);
  assert.equal(series[1].goalReached, true);
  assert.equal(series[5].heightPct, 100);
  assert.equal(series[1].heightPct, 50);

  const sum = summarizeWeeklyActivity(series);
  assert.equal(sum.totalSeconds, 3000);
  assert.equal(sum.activeDays, 3);
  assert.equal(sum.goalDays, 2);
  assert.equal(sum.lessons, 5);
  assert.equal(sum.exercises, 6);
});
