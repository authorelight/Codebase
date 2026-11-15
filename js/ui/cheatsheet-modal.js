// Quick Reference (Cheat Sheet) modal (<dialog>): view any module's cheat sheet without leaving your code.

import { h } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { loadCourseList, loadCourse, loadOptionalDoc } from '../content.js';
import { renderMarkdown, splitBlocks } from '../lib/markdown.js';
import { parseInfo } from '../lib/doc.js';
import { staticCode } from './doc-render.js';

let dialog = null;

function renderCheatNodes(doc) {
  const frag = document.createDocumentFragment();
  for (const n of doc.nodes) {
    if (n.type !== 'md') continue;
    for (const part of splitBlocks(n.text)) {
      if (part.type === 'prose') {
        frag.appendChild(h('div.prose', { html: renderMarkdown(part.text) }));
      } else {
        const info = parseInfo(part.info);
        const lang = info.lang === 'py' ? 'python' : info.lang || 'text';
        frag.appendChild(staticCode(part.code, { lang, label: info.attrs.file || '' }));
      }
    }
  }
  return frag;
}

function buildRefDialog() {
  const select = h('select.select.ref-select', { 'aria-label': 'Choose module cheat sheet' });
  const titleEl = h('h2', 'Quick reference');
  const bodyEl = h('div.ref-body.doc');
  const closeBtn = h('button.btn.btn-ghost.btn-icon', { type: 'button', 'aria-label': 'Close reference', onclick: () => dialog.close() }, icon('x', 18));

  const el = h(
    'dialog.cq-dialog.ref-dialog',
    { 'aria-label': 'Quick reference cheat sheet' },
    h(
      'div.cq-dialog-panel.ref-panel',
      h('header.ref-head', icon('book', 18), titleEl, select, closeBtn),
      bodyEl
    )
  );

  el.addEventListener('click', (e) => {
    if (e.target === el) el.close();
  });

  let currentCourse = null;
  let loadedCourseId = '';

  async function loadModuleCheat(courseId, moduleId) {
    bodyEl.replaceChildren(h('div.page-loading', h('span.spinner'), h('span', 'Loading reference…')));
    try {
      const course = await loadCourse(courseId);
      currentCourse = course;
      const withCheat = course.modules.filter((m) => !m.missing && m.cheatsheet);

      if (loadedCourseId !== course.id || !select.options.length) {
        loadedCourseId = course.id;
        select.replaceChildren(
          ...withCheat.map((m) => h('option', { value: m.id }, `${m.index + 1}. ${m.title}`))
        );
      }

      const target = withCheat.find((m) => m.id === moduleId) || withCheat[0];
      if (!target) {
        bodyEl.replaceChildren(h('p.muted', 'No cheat sheets available.'));
        return;
      }
      select.value = target.id;
      titleEl.textContent = `${target.title} · Reference`;
      el.dataset.line = target.line?.id || '';

      const doc = await loadOptionalDoc(courseId, target.id, target.cheatsheet);
      if (!doc) {
        bodyEl.replaceChildren(h('p.muted', 'This module does not have a cheat sheet yet.'));
        return;
      }
      bodyEl.replaceChildren(renderCheatNodes(doc));
      bodyEl.scrollTop = 0;
    } catch {
      bodyEl.replaceChildren(h('p.muted', 'Could not load the reference sheet right now.'));
    }
  }

  select.addEventListener('change', () => {
    if (currentCourse) loadModuleCheat(currentCourse.id, select.value);
  });

  el._load = loadModuleCheat;
  return el;
}

export async function openReferenceModal({ courseId = '', moduleId = '' } = {}) {
  if (!dialog) {
    dialog = buildRefDialog();
    document.body.appendChild(dialog);
  }
  let cid = courseId;
  if (!cid) {
    const list = await loadCourseList();
    cid = list[0]?.id || 'python';
  }
  if (!dialog.open) dialog.showModal();
  await dialog._load(cid, moduleId);
}
