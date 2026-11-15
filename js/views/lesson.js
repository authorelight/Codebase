import { h, plural, minutesLabel, prefersReducedMotion } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { loadCourse, findModule, loadDoc } from '../content.js';
import { store } from '../store.js';
import { renderDoc } from '../ui/doc-render.js';
import { openReferenceModal } from '../ui/cheatsheet-modal.js';
import { formatElapsedClock } from '../search.js';

/** Where "next" leads from a lesson: next lesson, the quiz, the game, or the next module. */
export function nextAfterLesson(course, m, lesson) {
  const i = m.lessons.indexOf(lesson);
  const base = `#/c/${course.id}/${m.id}`;
  if (i < m.lessons.length - 1) return { href: `${base}/${m.lessons[i + 1].id}`, label: m.lessons[i + 1].title, kind: 'lesson' };
  if (m.quiz) return { href: `${base}/quiz`, label: 'Module quiz', kind: 'quiz' };
  if (m.game) return { href: `${base}/game`, label: m.gameTitle || 'Module game', kind: 'game' };
  const nm = course.modules.slice(m.index + 1).find((x) => !x.missing);
  return nm ? { href: `#/c/${course.id}/${nm.id}`, label: nm.title, kind: 'module' } : { href: `#/c/${course.id}`, label: 'Course map', kind: 'course' };
}

export async function lessonView({ course: cid, module: mid, lesson: lid }) {
  const course = await loadCourse(cid);
  const m = findModule(course, mid);
  const cleanLid = String(lid || '').replace(/\.md$/i, '');
  const lesson = m && m.lessons.find((l) => l.id === cleanLid || l.file === lid);
  if (!m || !lesson) throw Object.assign(new Error('There is no lesson called “' + lid + '” in this module.'), { notFound: true });
  const doc = await loadDoc(cid, mid, lesson.file);
  if (doc.errors.length) console.warn('Lesson has formatting problems:', doc.errors);
  const { el, toc, exercises } = renderDoc(doc, { key: lesson.key });
  const route = `/c/${cid}/${mid}/${lid}`;
  store.setLast(route, `${m.title}: ${lesson.title}`);

  const i = m.lessons.indexOf(lesson);
  const prev = i > 0 ? m.lessons[i - 1] : null;
  const next = nextAfterLesson(course, m, lesson);

  // --- header ---
  const steps = h(
    'nav.lesson-steps',
    { 'aria-label': 'Lessons in this module' },
    m.lessons.map((l, k) =>
      h('a.lstep' + (l === lesson ? '.is-current' : '') + (store.isLessonDone(l.key) ? '.is-done' : ''), { href: `#/c/${cid}/${mid}/${l.id}`, title: l.title, 'aria-label': `Lesson ${k + 1}: ${l.title}`, 'aria-current': l === lesson ? 'page' : null }, String(k + 1))
    )
  );
  const exCount = exercises.length;
  const solvedCount = () => exercises.filter((e) => e.exercise.isSolved()).length;
  const exMetaSpan = exCount ? h('span.with-icon.lesson-ex-meta') : null;
  const jumpExBtn = exCount
    ? h(
        'button.btn.btn-ghost.btn-sm.lesson-jump-ex',
        {
          type: 'button',
          onclick: () => {
            const target = exercises.find((e) => !e.exercise.isSolved()) || exercises[0];
            if (target) target.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
          },
        },
        icon('terminal', 14),
        'Jump to exercise'
      )
    : null;
  const refBtn = m.cheatsheet
    ? h('button.btn.btn-secondary.btn-sm', { type: 'button', onclick: () => openReferenceModal({ courseId: cid, moduleId: mid }) }, icon('book', 14), 'Reference')
    : null;

  // --- non-intrusive module timer ---
  let pendingSec = 0;
  let paused = false;
  let timerId = null;
  const timerClock = h('span.lesson-timer-clock', { title: `Time tracked in ${m.title}` });
  const timerBtn = h('button.lesson-timer-toggle', { type: 'button', onclick: toggleTimer });
  const timerWrap = h('span.with-icon.lesson-timer', { 'aria-label': `Time spent on ${m.title}` }, icon('clock', 15), timerClock, timerBtn);

  function renderTimer() {
    const total = store.moduleSeconds(m.key) + pendingSec;
    timerClock.textContent = formatElapsedClock(total);
    timerWrap.classList.toggle('is-paused', paused);
    timerBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
    timerBtn.setAttribute('aria-label', paused ? 'Resume module timer' : 'Pause module timer');
    timerBtn.title = paused ? 'Resume module timer' : 'Pause module timer';
    timerBtn.replaceChildren(icon(paused ? 'play' : 'pause', 12), h('span.lesson-timer-label', paused ? 'Resume' : 'Pause'));
  }

  function flushTime() {
    if (pendingSec <= 0) return;
    const delta = pendingSec;
    pendingSec = 0;
    store.addModuleTime(m.key, delta);
  }

  function toggleTimer() {
    paused = !paused;
    if (paused) flushTime();
    renderTimer();
  }

  function onTick() {
    if (paused || document.visibilityState === 'hidden') return;
    pendingSec += 1;
    renderTimer();
    if (pendingSec >= 5) flushTime();
  }

  function onVisibilityChange() {
    if (document.visibilityState === 'hidden') flushTime();
  }

  function onPageHide() {
    flushTime();
  }

  renderTimer();

  const meta = h(
    'div.lesson-meta-row',
    h('p.lesson-meta', lesson.minutes ? h('span.with-icon', icon('book', 15), minutesLabel(lesson.minutes)) : null, exMetaSpan, timerWrap),
    h('div.lesson-tools', jumpExBtn, refBtn)
  );

  // --- finish bar ---
  const finishBtn = h('button.btn.btn-primary.btn-lg', { type: 'button', onclick: () => finish() });
  const unfinishBtn = h('button.btn.btn-ghost.btn-sm', { type: 'button', hidden: true, onclick: () => unfinish() }, icon('reset', 14), 'Mark incomplete');
  const nextLink = h('a.btn.btn-secondary.btn-lg', { href: next.href }, next.kind === 'quiz' ? icon('list', 18) : next.kind === 'game' ? icon('gamepad', 18) : null, h('span', `Next: ${next.label}`), icon('arrow-right', 18));
  const finishNote = h('p.finish-note', { role: 'status' });

  // --- table of contents ---
  const tocLinks = toc.map((t) => {
    const ic = t.exercise ? h('span.toc-ic', icon(t.el.exercise?.isSolved() ? 'check' : 'terminal', 13)) : null;
    return h(
      'li' + (t.exercise ? '.is-exercise' : '') + (t.exercise && t.el.exercise?.isSolved() ? '.is-solved' : ''),
      h('button.toc-link', { type: 'button', onclick: () => t.el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' }) }, ic, t.text)
    );
  });
  const tocEl = toc.length > 1 ? h('aside.lesson-toc', { 'aria-label': 'On this page' }, h('h2', 'On this page'), h('ul', tocLinks)) : null;
  let observer = null;

  function refreshProgress() {
    const sc = solvedCount();
    if (exMetaSpan) {
      exMetaSpan.replaceChildren(icon(sc === exCount ? 'check' : 'terminal', 15), sc ? `${sc} of ${exCount} exercises solved` : plural(exCount, 'exercise'));
    }
    if (jumpExBtn) {
      const nextUnsolved = exercises.find((e) => !e.exercise.isSolved());
      jumpExBtn.hidden = !nextUnsolved;
    }
    toc.forEach((t, idx) => {
      if (!t.exercise) return;
      const ok = !!t.el.exercise?.isSolved();
      tocLinks[idx].classList.toggle('is-solved', ok);
      const icSlot = tocLinks[idx].querySelector('.toc-ic');
      if (icSlot) icSlot.replaceChildren(icon(ok ? 'check' : 'terminal', 13));
    });

    const done = store.isLessonDone(lesson.key);
    if (steps.children[i]) steps.children[i].classList.toggle('is-done', done);
    finishBtn.className = 'btn btn-lg ' + (done ? 'btn-done' : 'btn-primary');
    finishBtn.replaceChildren(icon('check', 18), done ? 'Lesson finished' : 'Finish lesson');
    finishBtn.disabled = done;
    unfinishBtn.hidden = !done;
    nextLink.className = 'btn btn-lg ' + (done ? 'btn-primary' : 'btn-secondary');
    if (exCount && !done) finishNote.textContent = sc === exCount ? 'All exercises solved.' : `${sc} of ${exCount} exercises solved. You can finish now and come back to the rest.`;
    else finishNote.textContent = '';
  }

  function finish() {
    store.completeLesson(lesson.key);
    refreshProgress();
    nextLink.focus();
  }
  function unfinish() {
    store.uncompleteLesson(lesson.key);
    refreshProgress();
    finishBtn.focus();
  }
  refreshProgress();
  el.addEventListener('exercise-solved', refreshProgress);

  const node = h(
    'article.page.lesson-page',
    { dataset: { line: m.line.id } },
    h('p.crumbs', h('a', { href: `#/c/${cid}` }, course.title), h('span', ' / '), h('a', { href: `#/c/${cid}/${mid}` }, m.title)),
    h('header.lesson-head', m.lessons.length > 1 ? steps : null, h('h1', lesson.title), meta),
    h('div.lesson-layout', h('div.lesson-body', el), tocEl),
    h(
      'footer.lesson-foot',
      h('div.finish-row', finishBtn, nextLink, unfinishBtn),
      finishNote,
      prev ? h('nav.pager', { 'aria-label': 'Lesson navigation' }, h('a.pager-link', { href: `#/c/${cid}/${mid}/${prev.id}` }, icon('arrow-left', 16), h('span', h('small', 'Previous lesson'), prev.title)), h('span')) : null
    )
  );

  return {
    node,
    title: `${lesson.title} · ${m.title}`,
    after() {
      if (tocEl && 'IntersectionObserver' in window) {
        observer = new IntersectionObserver(
          (entries) => {
            for (const e of entries) {
              if (e.isIntersecting) {
                const idx = toc.findIndex((t) => t.el === e.target);
                tocLinks.forEach((li, k) => li.classList.toggle('is-active', k === idx));
              }
            }
          },
          { rootMargin: '-20% 0px -70% 0px' }
        );
        toc.forEach((t) => observer.observe(t.el));
      }
      renderTimer();
      timerId = window.setInterval(onTick, 1000);
      document.addEventListener('visibilitychange', onVisibilityChange);
      window.addEventListener('pagehide', onPageHide);
    },
    cleanup() {
      if (observer) observer.disconnect();
      if (timerId !== null) {
        clearInterval(timerId);
        timerId = null;
      }
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', onPageHide);
      flushTime();
    },
  };
}
