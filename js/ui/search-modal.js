// Quick Search & Jump modal (<dialog>): search across all modules, lessons, and games.

import { h } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { loadCourseList, loadCourse } from '../content.js';
import { store } from '../store.js';
import { searchCurriculum } from '../search.js';

let dialog = null;
let cachedCourses = null;
let wiredShortcut = false;

const KINDS = [
  { id: 'all', label: 'All' },
  { id: 'module', label: 'Modules' },
  { id: 'lesson', label: 'Lessons' },
  { id: 'game', label: 'Games' },
];

async function getCourses() {
  if (!cachedCourses) {
    const list = await loadCourseList();
    cachedCourses = await Promise.all(list.map((c) => loadCourse(c.id)));
  }
  return cachedCourses;
}

function buildDialog() {
  let kind = 'all';
  let activeIdx = 0;
  let currentItems = [];

  const input = h('input.search-input', {
    type: 'search',
    placeholder: 'Search modules, lessons, games, or topics…',
    'aria-label': 'Search curriculum',
    autocomplete: 'off',
    spellcheck: 'false',
  });
  const closeBtn = h('button.btn.btn-ghost.btn-icon', { type: 'button', 'aria-label': 'Close search', onclick: () => dialog.close() }, icon('x', 18));
  const tabs = h(
    'div.search-tabs',
    { role: 'tablist', 'aria-label': 'Filter results by type' },
    KINDS.map((k) =>
      h(
        'button.search-tab' + (k.id === kind ? '.is-active' : ''),
        {
          type: 'button',
          role: 'tab',
          'aria-selected': k.id === kind ? 'true' : 'false',
          dataset: { kind: k.id },
          onclick: () => {
            kind = k.id;
            tabs.querySelectorAll('.search-tab').forEach((b) => {
              const on = b.dataset.kind === kind;
              b.classList.toggle('is-active', on);
              b.setAttribute('aria-selected', on ? 'true' : 'false');
            });
            refresh();
            input.focus();
          },
        },
        k.label
      )
    )
  );
  const countEl = h('p.search-count', { 'aria-live': 'polite' });
  const listEl = h('ul.search-list', { role: 'listbox', 'aria-label': 'Search results' });
  const body = h('div.search-body', countEl, listEl);

  const el = h(
    'dialog.cq-dialog.search-dialog',
    { 'aria-label': 'Quick search' },
    h(
      'div.cq-dialog-panel',
      h('header.search-head', icon('search', 18), input, closeBtn),
      h('div.search-bar', tabs, h('span.search-kbd', h('kbd', '↑↓'), ' navigate · ', h('kbd', 'Enter'), ' open · ', h('kbd', 'Esc'), ' close')),
      body
    )
  );

  el.addEventListener('click', (e) => {
    if (e.target === el) el.close();
  });

  function paintActive() {
    const links = listEl.querySelectorAll('.search-item');
    links.forEach((a, i) => {
      const on = i === activeIdx;
      a.classList.toggle('is-selected', on);
      a.setAttribute('aria-selected', on ? 'true' : 'false');
      if (on) a.scrollIntoView({ block: 'nearest' });
    });
  }

  async function refresh() {
    let courses;
    try {
      courses = await getCourses();
    } catch {
      countEl.textContent = 'Could not load course index.';
      listEl.replaceChildren();
      return;
    }
    const items = searchCurriculum(courses, store.state, input.value, { kind, limit: 24 });
    currentItems = items;
    activeIdx = 0;

    const q = input.value.trim();
    countEl.textContent = items.length
      ? `${items.length} ${items.length === 1 ? 'result' : 'results'}${q ? ` for “${q}”` : ' · top stations'}`
      : `No matches for “${q}”. Try another topic like loops, lists, files, or decorators.`;

    if (!items.length) {
      listEl.replaceChildren(
        h(
          'li.search-empty',
          h('p', 'Nothing matched that search.'),
          h(
            'button.btn.btn-secondary.btn-sm',
            {
              type: 'button',
              onclick: () => {
                input.value = '';
                kind = 'all';
                tabs.querySelectorAll('.search-tab').forEach((b) => {
                  const on = b.dataset.kind === 'all';
                  b.classList.toggle('is-active', on);
                  b.setAttribute('aria-selected', on ? 'true' : 'false');
                });
                refresh();
                input.focus();
              },
            },
            'Reset search'
          )
        )
      );
      return;
    }

    listEl.replaceChildren(
      ...items.map((item, i) => {
        const kindIcon = item.kind === 'module' ? 'map' : item.kind === 'game' ? 'gamepad' : 'book';
        return h(
          'li',
          { role: 'option', dataset: { line: item.lineId } },
          h(
            'a.search-item' + (i === 0 ? '.is-selected' : ''),
            {
              href: item.href,
              'aria-selected': i === 0 ? 'true' : 'false',
              onclick: () => el.close(),
            },
            h('span.search-dot', { 'aria-hidden': 'true' }, icon(item.done ? 'check' : kindIcon, 15)),
            h(
              'span.search-main',
              h('span.search-title', item.title),
              h('span.search-sub', item.subtitle),
              item.summary ? h('span.search-sum', item.summary) : null
            ),
            item.badge ? h('span.search-meta', item.badge) : null
          )
        );
      })
    );
  }

  input.addEventListener('input', refresh);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') {
      if (!currentItems.length) return;
      e.preventDefault();
      activeIdx = (activeIdx + 1) % currentItems.length;
      paintActive();
    } else if (e.key === 'ArrowUp') {
      if (!currentItems.length) return;
      e.preventDefault();
      activeIdx = (activeIdx - 1 + currentItems.length) % currentItems.length;
      paintActive();
    } else if (e.key === 'Enter') {
      const target = currentItems[activeIdx];
      if (target) {
        e.preventDefault();
        el.close();
        location.hash = target.href;
      }
    }
  });

  el._refresh = refresh;
  el._input = input;
  return el;
}

export async function openSearchModal(initialQuery = '') {
  if (!dialog) {
    dialog = buildDialog();
    document.body.appendChild(dialog);
  }
  if (typeof initialQuery === 'string' && initialQuery) dialog._input.value = initialQuery;
  if (!dialog.open) dialog.showModal();
  await dialog._refresh();
  dialog._input.focus();
  dialog._input.select();
}

export function wireSearchShortcuts() {
  if (wiredShortcut) return;
  wiredShortcut = true;
  document.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault();
      openSearchModal();
      return;
    }
    if (e.key === '/' && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const t = e.target;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
      if (document.querySelector('dialog[open]')) return;
      e.preventDefault();
      openSearchModal();
    }
  });
}
