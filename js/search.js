// Pure curriculum search, filtering, and line-level progress helpers.
// No DOM dependencies so the logic can be unit-tested directly with node:test.

import { moduleProgress } from './content.js';

export function normalizeQuery(q) {
  return String(q || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function matchScore(query, fields) {
  if (!query) return 1;
  const terms = query.split(' ').filter(Boolean);
  const joined = fields.map((f) => String(f || '').toLowerCase()).join(' \n ');
  for (const term of terms) {
    if (!joined.includes(term)) return 0;
  }
  const primary = String(fields[0] || '').toLowerCase();
  if (primary === query) return 100;
  if (primary.startsWith(query)) return 70;
  if (primary.includes(query)) return 50;
  return 20;
}

/**
 * Filter modules in a course by line, difficulty level, completion status, and search query.
 * Returns { line, modules: [{ module, progress }] } entries preserving course line order.
 */
export function filterCourseLines(course, state, { query = '', lineId = 'all', level = 'all', status = 'all' } = {}) {
  const q = normalizeQuery(query);
  const out = [];

  for (const line of course.lineList || []) {
    if (lineId !== 'all' && line.id !== lineId) continue;
    const matched = [];
    for (const m of line.modules || []) {
      const progress = m.missing ? { pct: 0, complete: false, done: 0, lessonsDone: 0, lessonsTotal: 0 } : moduleProgress(m, state);
      if (level !== 'all' && (m.level || '') !== level) continue;
      if (status === 'done' && !progress.complete) continue;
      if (status === 'started' && (progress.complete || !progress.done)) continue;
      if (status === 'todo' && (m.missing || progress.complete)) continue;

      if (q) {
        const fields = [
          m.title,
          m.summary,
          line.title,
          m.gameTitle,
          m.gameSummary,
          ...(m.outcomes || []),
          ...(m.lessons || []).flatMap((l) => [l.title, l.summary]),
        ];
        if (!matchScore(q, fields)) continue;
      }
      matched.push({ module: m, progress });
    }
    if (matched.length) out.push({ line, modules: matched });
  }
  return out;
}

/**
 * Build flat searchable items across all courses (modules, lessons, games, quizzes)
 * and return ranked matches for `query`.
 */
export function searchCurriculum(courses, state, query = '', { kind = 'all', lineId = 'all', limit = 30 } = {}) {
  const q = normalizeQuery(query);
  const results = [];

  for (const course of courses || []) {
    for (const m of course.modules || []) {
      if (m.missing) continue;
      if (lineId !== 'all' && m.line?.id !== lineId) continue;
      const p = moduleProgress(m, state);

      if (kind === 'all' || kind === 'module') {
        const score = matchScore(q, [m.title, m.summary, m.line?.title, ...(m.outcomes || [])]);
        if (score) {
          results.push({
            kind: 'module',
            score: score + 6,
            title: m.title,
            subtitle: `${m.line?.title || ''} · Module ${m.index + 1}`,
            summary: m.summary || '',
            href: `#/c/${course.id}/${m.id}`,
            lineId: m.line?.id || '',
            done: p.complete,
            badge: p.complete ? 'Complete' : p.done ? `${p.pct}%` : '',
          });
        }
      }

      if (kind === 'all' || kind === 'lesson') {
        for (const l of m.lessons || []) {
          const score = matchScore(q, [l.title, l.summary, m.title, m.line?.title]);
          if (score) {
            const done = !!state.lessons?.[l.key];
            results.push({
              kind: 'lesson',
              score: score + 3,
              title: l.title,
              subtitle: `${m.index + 1}. ${m.title} · Lesson ${l.index + 1}`,
              summary: l.summary || '',
              href: `#/c/${course.id}/${m.id}/${l.id}`,
              lineId: m.line?.id || '',
              done,
              badge: done ? 'Done' : l.minutes ? `${l.minutes} min` : '',
            });
          }
        }
      }

      if ((kind === 'all' || kind === 'game') && m.game) {
        const gTitle = m.gameTitle || `${m.title} game`;
        const score = matchScore(q, [gTitle, m.gameSummary, m.title, 'game']);
        if (score) {
          const g = state.games?.[m.key];
          const cleared = g ? Object.keys(g.levels || {}).length : 0;
          results.push({
            kind: 'game',
            score,
            title: gTitle,
            subtitle: `${m.index + 1}. ${m.title} · Module game`,
            summary: m.gameSummary || '',
            href: `#/c/${course.id}/${m.id}/game`,
            lineId: m.line?.id || '',
            done: p.gameDone,
            badge: p.gameDone ? 'Cleared' : cleared ? `${cleared} lvl` : '',
          });
        }
      }
    }
  }

  results.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));
  return results.slice(0, limit);
}

/**
 * Compute per-line progress and overall next recommended station for a course.
 */
export function computeLineMastery(course, state) {
  const lines = [];
  let nextStation = null;

  for (const line of course.lineList || []) {
    const mods = (line.modules || []).filter((m) => !m.missing);
    if (!mods.length) continue;
    let totalPct = 0;
    let completedModules = 0;
    let lessonsDone = 0;
    let lessonsTotal = 0;
    let gamesDone = 0;
    let gamesTotal = 0;

    for (const m of mods) {
      const p = moduleProgress(m, state);
      totalPct += p.pct;
      if (p.complete) completedModules += 1;
      lessonsDone += p.lessonsDone;
      lessonsTotal += p.lessonsTotal;
      if (p.hasGame) {
        gamesTotal += 1;
        if (p.gameDone) gamesDone += 1;
      }
      if (!nextStation && !p.complete) {
        const nextLesson = m.lessons.find((l) => !state.lessons?.[l.key]);
        if (nextLesson) {
          nextStation = {
            courseId: course.id,
            moduleId: m.id,
            moduleTitle: m.title,
            lineId: line.id,
            lineTitle: line.title,
            kind: 'lesson',
            title: nextLesson.title,
            href: `#/c/${course.id}/${m.id}/${nextLesson.id}`,
          };
        } else if (m.quiz && !p.quizDone) {
          nextStation = {
            courseId: course.id,
            moduleId: m.id,
            moduleTitle: m.title,
            lineId: line.id,
            lineTitle: line.title,
            kind: 'quiz',
            title: `${m.title} quiz`,
            href: `#/c/${course.id}/${m.id}/quiz`,
          };
        } else if (m.game && !p.gameDone) {
          nextStation = {
            courseId: course.id,
            moduleId: m.id,
            moduleTitle: m.title,
            lineId: line.id,
            lineTitle: line.title,
            kind: 'game',
            title: m.gameTitle || `${m.title} game`,
            href: `#/c/${course.id}/${m.id}/game`,
          };
        }
      }
    }

    lines.push({
      id: line.id,
      title: line.title,
      summary: line.summary || '',
      modulesTotal: mods.length,
      modulesComplete: completedModules,
      lessonsDone,
      lessonsTotal,
      gamesDone,
      gamesTotal,
      pct: Math.round(totalPct / mods.length),
    });
  }

  return { lines, nextStation };
}

/**
 * Compute overall dashboard lesson and module completion progress for a course.
 */
export function computeDashboardProgress(course, state) {
  const mods = (course?.modules || []).filter((m) => !m.missing);
  const { lines, nextStation } = computeLineMastery(course || { lineList: [] }, state || { lessons: {}, quizzes: {}, games: {} });
  const lessonsTotal = lines.reduce((n, l) => n + l.lessonsTotal, 0) || mods.reduce((n, m) => n + (m.lessons?.length || 0), 0);
  const lessonsDone = lines.reduce((n, l) => n + l.lessonsDone, 0);
  const modulesTotal = mods.length;
  const modulesDone = lines.reduce((n, l) => n + l.modulesComplete, 0);
  const lessonsPct = lessonsTotal ? Math.round((lessonsDone / lessonsTotal) * 100) : 0;
  return {
    lessonsDone,
    lessonsTotal,
    lessonsPct,
    modulesDone,
    modulesTotal,
    nextStation,
  };
}

/**
 * Format elapsed seconds as MM:SS (or H:MM:SS at >= 1 hour) for the non-intrusive lesson timer.
 */
export function formatElapsedClock(seconds) {
  const n = Math.floor(Number(seconds));
  const safe = Number.isFinite(n) && n > 0 ? n : 0;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  const s = safe % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/**
 * Format accumulated study time into a compact human-readable label (e.g. 0m, 42s, 14m, 1h 25m).
 */
export function formatStudyDuration(seconds) {
  const n = Math.floor(Number(seconds));
  const safe = Number.isFinite(n) && n > 0 ? n : 0;
  if (safe === 0) return '0m';
  if (safe < 60) return `${safe}s`;
  if (safe < 3600) return `${Math.floor(safe / 60)}m`;
  const h = Math.floor(safe / 3600);
  const m = Math.floor((safe % 3600) / 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

/**
 * Sum valid per-module tracked seconds from learner state.
 */
export function computeTotalStudyTime(state) {
  const map = state?.moduleTime;
  if (!map || typeof map !== 'object') return 0;
  let total = 0;
  for (const val of Object.values(map)) {
    const n = Math.floor(Number(val));
    if (Number.isFinite(n) && n > 0) total += n;
  }
  return total;
}

