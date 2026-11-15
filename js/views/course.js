import { h, plural, minutesLabel } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { loadCourse, moduleProgress } from '../content.js';
import { store } from '../store.js';
import { renderRouteMap } from '../ui/route-map.js';
import { filterCourseLines } from '../search.js';
import { openReferenceModal } from '../ui/cheatsheet-modal.js';

export async function courseView({ course: id }) {
  const course = await loadCourse(id);
  const state = store.state;
  const real = course.modules.filter((m) => !m.missing);
  const progress = real.map((m) => moduleProgress(m, state));
  const doneModules = progress.filter((p) => p.complete).length;
  const pct = real.length ? Math.round(progress.reduce((n, p) => n + p.pct, 0) / real.length) : 0;
  const minutes = real.reduce((n, m) => n + (m.minutes || 0), 0);
  const lessons = real.reduce((n, m) => n + m.lessons.length, 0);

  const nextIdx = progress.findIndex((p) => !p.complete);
  const next = nextIdx === -1 ? null : real[nextIdx];

  let lineId = 'all';
  let status = 'all';
  let query = '';

  const searchInput = h('input.input.course-filter-input', {
    type: 'search',
    placeholder: 'Filter modules or lessons…',
    'aria-label': 'Filter modules or lessons',
    oninput: (e) => {
      query = e.target.value;
      paintRoute();
    },
  });

  const lineTabs = h(
    'div.seg-group',
    { role: 'group', 'aria-label': 'Filter by learning line' },
    [
      { id: 'all', title: 'All lines' },
      ...course.lineList.filter((l) => l.modules.length).map((l) => ({ id: l.id, title: l.title })),
    ].map((item) =>
      h(
        'button.seg-btn' + (item.id === lineId ? '.is-active' : ''),
        {
          type: 'button',
          dataset: { line: item.id },
          'aria-pressed': item.id === lineId ? 'true' : 'false',
          onclick: () => {
            lineId = item.id;
            lineTabs.querySelectorAll('.seg-btn').forEach((b) => {
              const on = b.dataset.line === lineId;
              b.classList.toggle('is-active', on);
              b.setAttribute('aria-pressed', on ? 'true' : 'false');
            });
            paintRoute();
          },
        },
        item.title
      )
    )
  );

  const statusSelect = h(
    'select.select.course-status-select',
    {
      'aria-label': 'Filter by completion status',
      onchange: (e) => {
        status = e.target.value;
        paintRoute();
      },
    },
    h('option', { value: 'all' }, 'All modules'),
    h('option', { value: 'todo' }, 'Remaining'),
    h('option', { value: 'started' }, 'In progress'),
    h('option', { value: 'done' }, 'Completed')
  );

  const countLabel = h('p.course-filter-count', { 'aria-live': 'polite' });
  const mapHost = h('div.course-map-host');

  function clearFilters() {
    lineId = 'all';
    status = 'all';
    query = '';
    searchInput.value = '';
    statusSelect.value = 'all';
    lineTabs.querySelectorAll('.seg-btn').forEach((b) => {
      const on = b.dataset.line === 'all';
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
    paintRoute();
  }

  function paintRoute() {
    const filtered = filterCourseLines(course, store.state, { query, lineId, status });
    const count = filtered.reduce((n, f) => n + f.modules.length, 0);
    const activeFilter = lineId !== 'all' || status !== 'all' || query.trim() !== '';
    countLabel.textContent = activeFilter ? `Showing ${plural(count, 'module')} of ${real.length}` : `${plural(real.length, 'module')} across ${course.lineList.length} lines`;

    if (!count) {
      mapHost.replaceChildren(
        h(
          'div.empty-state',
          h('p', 'No modules match those filters.'),
          h('button.btn.btn-secondary', { type: 'button', onclick: clearFilters }, 'Clear filters')
        )
      );
      return;
    }
    mapHost.replaceChildren(renderRouteMap(course, store.state, { filteredLines: filtered }));
  }

  paintRoute();

  const node = h(
    'section.page.course-page',
    h(
      'header.course-head',
      h('h1', course.title),
      course.subtitle ? h('p.lede', course.subtitle) : null,
      h(
        'div.course-stats',
        h('div', h('strong', String(real.length)), h('span', real.length === 1 ? 'module' : 'modules')),
        h('div', h('strong', String(lessons)), h('span', lessons === 1 ? 'lesson' : 'lessons')),
        h('div', h('strong', minutesLabel(minutes) || '-'), h('span', 'of material')),
        h('div', h('strong', `${doneModules}/${real.length}`), h('span', 'modules complete'))
      ),
      h('div.progress-bar', { role: 'progressbar', 'aria-valuenow': pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Course progress' }, h('i', { style: { width: pct + '%' } })),
      h(
        'div.btn-row',
        next ? h('a.btn.btn-primary', { href: `#/c/${course.id}/${next.id}` }, icon('play', 16), progress[nextIdx].done ? `Continue: ${next.title}` : `Start: ${next.title}`) : h('p.callout-inline', icon('trophy', 18), 'You have completed every module. Open the Progress page to print your certificate.'),
        h('button.btn.btn-secondary', { type: 'button', onclick: () => openReferenceModal({ courseId: course.id }) }, icon('book', 16), 'Reference sheets')
      )
    ),
    h(
      'div.course-filters',
      h('div.course-filter-row', searchInput, statusSelect),
      lineTabs,
      countLabel
    ),
    mapHost
  );
  return { node, title: course.title };
}
