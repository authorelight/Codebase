import test from 'node:test';
import assert from 'node:assert/strict';
import {
  isMarkdown404Error,
  extractMissingMarkdownPath,
  fallbackDashboardTarget,
} from './route-fallback.js';

test('isMarkdown404Error detects structured 404 markdown errors', () => {
  const err = Object.assign(new Error('404 content/python/meet-python/missing.md'), {
    status: 404,
    path: 'content/python/meet-python/missing.md',
    isMarkdown: true,
  });
  assert.equal(isMarkdown404Error(err), true);
});

test('isMarkdown404Error detects plain 404 .md error messages', () => {
  assert.equal(isMarkdown404Error(new Error('404 content/python/meet-python/hello-world.md')), true);
  assert.equal(isMarkdown404Error('404 content/python/loops/quiz.md?v=1'), true);
});

test('isMarkdown404Error ignores non-404 and non-markdown errors', () => {
  assert.equal(isMarkdown404Error(new Error('500 content/python/meet-python/hello-world.md')), false);
  assert.equal(isMarkdown404Error(new Error('404 content/python/course.json')), false);
  assert.equal(isMarkdown404Error(Object.assign(new Error('404 css/base.css'), { status: 404, path: 'css/base.css', isMarkdown: false })), false);
  assert.equal(isMarkdown404Error(null), false);
});

test('extractMissingMarkdownPath extracts the .md path cleanly', () => {
  assert.equal(
    extractMissingMarkdownPath(new Error('404 content/python/meet-python/missing.md')),
    'content/python/meet-python/missing.md'
  );
  assert.equal(
    extractMissingMarkdownPath({ status: 404, path: 'content/python/loops/for-loops.md' }),
    'content/python/loops/for-loops.md'
  );
  assert.equal(extractMissingMarkdownPath(new Error('Network error')), '');
});

test('fallbackDashboardTarget computes module or course map fallback links', () => {
  assert.deepEqual(fallbackDashboardTarget({ course: 'python', module: 'meet-python' }), {
    href: '#/c/python/meet-python',
    label: 'Back to module',
  });
  assert.deepEqual(fallbackDashboardTarget({ course: 'python' }), {
    href: '#/c/python',
    label: 'Browse course map',
  });
  assert.deepEqual(fallbackDashboardTarget({}), {
    href: '#/c/python',
    label: 'Browse course map',
  });
});
