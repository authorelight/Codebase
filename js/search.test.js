import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeQuery,
  filterCourseLines,
  searchCurriculum,
  computeLineMastery,
  computeDashboardProgress,
  formatElapsedClock,
  formatStudyDuration,
  computeTotalStudyTime,
} from './search.js';

const MOCK_COURSE = {
  id: 'python',
  title: 'Python from Zero to Pro',
  modules: [
    {
      id: 'meet-python',
      index: 0,
      key: 'python/meet-python',
      title: 'Meet Python',
      summary: 'Your first print() programs.',
      level: 'beginner',
      line: { id: 'foundations', title: 'Foundations' },
      lessons: [
        { id: 'hello-world', index: 0, title: 'Your first program', summary: 'Use print() to write text.', minutes: 10, key: 'python/meet-python/hello-world' },
        { id: 'calculator', index: 1, title: 'Python as a calculator', summary: 'Numbers and arithmetic.', minutes: 12, key: 'python/meet-python/calculator' },
      ],
      quiz: 'quiz.md',
      game: 'game.md',
      gameTitle: 'Mars Rover Intro',
      gameSummary: 'Steer the rover with print and move.',
      outcomes: ['Write print statements'],
    },
    {
      id: 'loops',
      index: 1,
      key: 'python/loops',
      title: 'Loops',
      summary: 'Repeat actions with for and while.',
      level: 'intermediate',
      line: { id: 'flow', title: 'Flow' },
      lessons: [
        { id: 'for-loops', index: 0, title: 'For loops', summary: 'Iterate over ranges and sequences.', minutes: 15, key: 'python/loops/for-loops' },
      ],
      quiz: 'quiz.md',
      game: 'game.md',
      gameTitle: 'Asteroid Maze',
      gameSummary: 'Steer through asteroid mazes with loops.',
      outcomes: ['Use for loops with range'],
    },
  ],
  lineList: [],
};
MOCK_COURSE.lineList = [
  { id: 'foundations', title: 'Foundations', summary: 'Start here', modules: [MOCK_COURSE.modules[0]] },
  { id: 'flow', title: 'Flow', summary: 'Repeat and store', modules: [MOCK_COURSE.modules[1]] },
];

const EMPTY_STATE = { lessons: {}, quizzes: {}, games: {} };

test('normalizeQuery collapses extra whitespace and lowercases', () => {
  assert.equal(normalizeQuery('  For   Loops '), 'for loops');
  assert.equal(normalizeQuery(''), '');
});

test('filterCourseLines filters by line, status, level, and query', () => {
  const all = filterCourseLines(MOCK_COURSE, EMPTY_STATE);
  assert.equal(all.length, 2);

  const flowOnly = filterCourseLines(MOCK_COURSE, EMPTY_STATE, { lineId: 'flow' });
  assert.equal(flowOnly.length, 1);
  assert.equal(flowOnly[0].modules[0].module.id, 'loops');

  const queryMatch = filterCourseLines(MOCK_COURSE, EMPTY_STATE, { query: 'calculator' });
  assert.equal(queryMatch.length, 1);
  assert.equal(queryMatch[0].modules[0].module.id, 'meet-python');

  const doneState = {
    lessons: {
      'python/meet-python/hello-world': 1,
      'python/meet-python/calculator': 1,
    },
    quizzes: { 'python/meet-python': { passed: true } },
    games: { 'python/meet-python': { done: 1, levels: { l1: { stars: 3 } } } },
  };
  const doneOnly = filterCourseLines(MOCK_COURSE, doneState, { status: 'done' });
  assert.equal(doneOnly.length, 1);
  assert.equal(doneOnly[0].modules[0].module.id, 'meet-python');

  const todoOnly = filterCourseLines(MOCK_COURSE, doneState, { status: 'todo' });
  assert.equal(todoOnly.length, 1);
  assert.equal(todoOnly[0].modules[0].module.id, 'loops');
});

test('searchCurriculum ranks title matches first and respects kind filter', () => {
  const res = searchCurriculum([MOCK_COURSE], EMPTY_STATE, 'loops');
  assert.ok(res.length >= 2);
  assert.equal(res[0].kind, 'module');
  assert.equal(res[0].title, 'Loops');

  const gamesOnly = searchCurriculum([MOCK_COURSE], EMPTY_STATE, 'maze', { kind: 'game' });
  assert.equal(gamesOnly.length, 1);
  assert.equal(gamesOnly[0].href, '#/c/python/loops/game');
});

test('computeLineMastery computes line stats and next recommended station', () => {
  const partial = {
    lessons: { 'python/meet-python/hello-world': 1 },
    quizzes: {},
    games: {},
  };
  const { lines, nextStation } = computeLineMastery(MOCK_COURSE, partial);
  assert.equal(lines.length, 2);
  assert.equal(lines[0].lessonsDone, 1);
  assert.equal(lines[0].lessonsTotal, 2);
  assert.equal(lines[0].pct, 25); // 1 of 4 parts (2 lessons + quiz + game)
  assert.equal(nextStation.href, '#/c/python/meet-python/calculator');
});

test('computeDashboardProgress computes lesson completion percentage and counts', () => {
  const empty = computeDashboardProgress(MOCK_COURSE, EMPTY_STATE);
  assert.equal(empty.lessonsDone, 0);
  assert.equal(empty.lessonsTotal, 3);
  assert.equal(empty.lessonsPct, 0);
  assert.equal(empty.modulesDone, 0);
  assert.equal(empty.modulesTotal, 2);
  assert.equal(empty.nextStation.href, '#/c/python/meet-python/hello-world');

  const partial = computeDashboardProgress(MOCK_COURSE, {
    lessons: {
      'python/meet-python/hello-world': 1,
      'python/meet-python/calculator': 1,
    },
    quizzes: {},
    games: {},
  });
  assert.equal(partial.lessonsDone, 2);
  assert.equal(partial.lessonsTotal, 3);
  assert.equal(partial.lessonsPct, 67);
  assert.equal(partial.nextStation.href, '#/c/python/meet-python/quiz');

  const complete = computeDashboardProgress(MOCK_COURSE, {
    lessons: {
      'python/meet-python/hello-world': 1,
      'python/meet-python/calculator': 1,
      'python/loops/for-loops': 1,
    },
    quizzes: {
      'python/meet-python': { passed: true },
      'python/loops': { passed: true },
    },
    games: {
      'python/meet-python': { done: 1, levels: { l1: { stars: 3 } } },
      'python/loops': { done: 1, levels: { l1: { stars: 3 } } },
    },
  });
  assert.equal(complete.lessonsDone, 3);
  assert.equal(complete.lessonsPct, 100);
  assert.equal(complete.modulesDone, 2);
  assert.equal(complete.nextStation, null);
});

test('formatElapsedClock formats seconds, minutes, hours, and clamps invalid inputs', () => {
  assert.equal(formatElapsedClock(0), '00:00');
  assert.equal(formatElapsedClock(-12), '00:00');
  assert.equal(formatElapsedClock(NaN), '00:00');
  assert.equal(formatElapsedClock(9), '00:09');
  assert.equal(formatElapsedClock(75.9), '01:15');
  assert.equal(formatElapsedClock(3661), '1:01:01');
});

test('formatStudyDuration formats human-readable study totals', () => {
  assert.equal(formatStudyDuration(0), '0m');
  assert.equal(formatStudyDuration(-5), '0m');
  assert.equal(formatStudyDuration(42), '42s');
  assert.equal(formatStudyDuration(60), '1m');
  assert.equal(formatStudyDuration(870), '14m');
  assert.equal(formatStudyDuration(3600), '1h');
  assert.equal(formatStudyDuration(5100), '1h 25m');
});

test('computeTotalStudyTime sums valid module durations and ignores malformed values', () => {
  assert.equal(computeTotalStudyTime(null), 0);
  assert.equal(computeTotalStudyTime({}), 0);
  assert.equal(
    computeTotalStudyTime({
      moduleTime: {
        'python/meet-python': 125,
        'python/loops': 75.8,
        'python/bad': -20,
        'python/nan': 'nope',
      },
    }),
    200
  );
});
