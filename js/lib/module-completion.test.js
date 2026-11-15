import test from 'node:test';
import assert from 'node:assert/strict';
import { moduleKeyFromKey, lessonKeyFromExerciseKey, isReadingComplete } from './module-completion.js';
import { moduleProgress } from '../content.js';

test('moduleKeyFromKey and lessonKeyFromExerciseKey parse lesson and exercise keys', () => {
  assert.equal(moduleKeyFromKey('python/meet-python/hello-world'), 'python/meet-python');
  assert.equal(moduleKeyFromKey('python/meet-python/hello-world#ex1'), 'python/meet-python');
  assert.equal(moduleKeyFromKey('invalid'), '');

  assert.equal(lessonKeyFromExerciseKey('python/meet-python/hello-world#ex1'), 'python/meet-python/hello-world');
  assert.equal(lessonKeyFromExerciseKey('python/meet-python'), '');
});

test('isReadingComplete detects scrolled-to-end pages and short-page dwell accurately', () => {
  assert.equal(isReadingComplete({ scrollPct: 40, footerVisible: false, hasScrolled: true, needsScroll: true }), false);
  assert.equal(isReadingComplete({ scrollPct: 92, footerVisible: false, hasScrolled: true, needsScroll: true }), true);
  assert.equal(isReadingComplete({ scrollPct: 78, footerVisible: true, hasScrolled: true, needsScroll: true }), true);
  assert.equal(isReadingComplete({ scrollPct: 95, footerVisible: true, hasScrolled: false, needsScroll: true }), false);
  assert.equal(isReadingComplete({ needsScroll: false, dwellMs: 500, minShortDwellMs: 1200 }), false);
  assert.equal(isReadingComplete({ needsScroll: false, dwellMs: 1300, minShortDwellMs: 1200 }), true);
});

test('moduleProgress treats persisted modules[key] in state as completed', () => {
  const mod = {
    id: 'meet-python',
    key: 'python/meet-python',
    lessons: [{ key: 'python/meet-python/hello-world' }, { key: 'python/meet-python/calculator' }],
    quiz: 'quiz.md',
    game: 'game.md',
  };
  const emptyState = { lessons: {}, quizzes: {}, games: {}, modules: {} };
  assert.equal(moduleProgress(mod, emptyState).complete, false);
  assert.equal(moduleProgress(mod, emptyState).pct, 0);

  const completedModuleState = {
    lessons: { 'python/meet-python/hello-world': 12345 },
    quizzes: {},
    games: {},
    modules: { 'python/meet-python': 12345 },
  };
  const p = moduleProgress(mod, completedModuleState);
  assert.equal(p.complete, true);
  assert.equal(p.pct, 100);
  assert.equal(p.lessonsDone, 1);
});
