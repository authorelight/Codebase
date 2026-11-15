import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fetchText, loadDoc, clearContentCache } from './content.js';
import { CONTENT_BUNDLE } from './content-bundle.js';

function withMockFetch(fn, t) {
  const original = globalThis.fetch;
  globalThis.fetch = fn;
  clearContentCache();
  t.after(() => {
    globalThis.fetch = original;
    clearContentCache();
  });
}

test('fetchText returns live network text when status is 200', async (t) => {
  withMockFetch(
    async () => new Response('---title: Live---\nHello from server', { status: 200, headers: { 'content-type': 'text/markdown' } }),
    t
  );
  const text = await fetchText('content/python/meet-python/hello-world.md');
  assert.match(text, /Live/);
});

test('fetchText falls back to bundled content when server returns 404 for hello-world.md', async (t) => {
  withMockFetch(
    async () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } }),
    t
  );
  const doc = await loadDoc('python', 'meet-python', 'hello-world.md');
  assert.equal(doc.meta.title, 'Your first program');
  assert.ok(doc.nodes.length > 0);
});

test('fetchText falls back to bundled content when server returns an HTML SPA shell for .md', async (t) => {
  withMockFetch(
    async () => new Response('<!doctype html><html><body>SPA</body></html>', { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } }),
    t
  );
  const text = await fetchText('content/python/meet-python/hello-world.md');
  assert.match(text, /title: Your first program/);
});

test('fetchText falls back to bundled content when fetch rejects', async (t) => {
  withMockFetch(async () => {
    throw new TypeError('Failed to fetch');
  }, t);
  const text = await fetchText('games/harness/rover.py');
  assert.match(text, /def setup|def finish/);
});

test('fetchText still throws 404 for genuinely nonexistent paths', async (t) => {
  withMockFetch(
    async () => new Response('Not found', { status: 404, headers: { 'content-type': 'text/html' } }),
    t
  );
  await assert.rejects(
    () => fetchText('content/python/meet-python/does-not-exist.md'),
    /404 content\/python\/meet-python\/does-not-exist\.md/
  );
});

test('CONTENT_BUNDLE includes every referenced course, module, lesson, quiz, game, cheatsheet, and harness', () => {
  const courses = JSON.parse(CONTENT_BUNDLE['content/courses.json']);
  assert.ok(Array.isArray(courses.courses) && courses.courses.includes('python'));

  for (const cid of courses.courses) {
    const course = JSON.parse(CONTENT_BUNDLE[`content/${cid}/course.json`]);
    const mids = course.modules || (course.lines || []).flatMap((l) => l.modules || []);
    for (const mid of mids) {
      const m = JSON.parse(CONTENT_BUNDLE[`content/${cid}/${mid}/module.json`]);
      if (m.status === 'soon') continue;
      for (const l of m.lessons || []) {
        const key = `content/${cid}/${mid}/${l.file || `${l.id}.md`}`;
        assert.ok(typeof CONTENT_BUNDLE[key] === 'string' && CONTENT_BUNDLE[key].length > 0, `Missing ${key} in bundle`);
      }
      for (const extra of ['quiz', 'game', 'cheatsheet']) {
        if (m[extra]) {
          const key = `content/${cid}/${mid}/${m[extra]}`;
          assert.ok(typeof CONTENT_BUNDLE[key] === 'string' && CONTENT_BUNDLE[key].length > 0, `Missing ${key} in bundle`);
        }
      }
    }
  }

  for (const harness of ['games/harness/common.py', 'games/harness/rover.py', 'games/harness/judge.py', 'js/py/host.py']) {
    const disk = fs.readFileSync(path.resolve(harness), 'utf8');
    assert.equal(CONTENT_BUNDLE[harness], disk);
  }
});
