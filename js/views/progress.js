import { h, plural, download, formatDate } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { loadCourseList, loadCourse, moduleProgress } from '../content.js';
import { store, rankFor } from '../store.js';
import { allBadgeDefs, EXTRA_BADGES } from '../badges.js';
import { RANKS } from '../config.js';
import { toast } from '../ui/toast.js';
import { computeLineMastery, formatStudyDuration, computeTotalStudyTime } from '../search.js';
import { GOAL_PRESETS, computeDailyGoalProgress, buildWeeklyActivitySeries, summarizeWeeklyActivity } from '../lib/study-stats.js';
import { confirmAction } from '../ui/confirm-modal.js';
import { createProfileAvatar } from '../ui/avatar.js';

export async function progressView() {
  const list = await loadCourseList();
  const courses = await Promise.all(list.map((c) => loadCourse(c.id)));
  const s = store.state;
  const rank = rankFor(s.xp);

  const lessonsDone = Object.keys(s.lessons).length;
  const exercisesDone = Object.values(s.exercises).filter((e) => e.done).length;
  const quizzesPassed = Object.values(s.quizzes).filter((q) => q.passed).length;
  const levels = Object.values(s.games).reduce((n, g) => n + Object.keys(g.levels).length, 0);
  const stars = Object.values(s.games).reduce((n, g) => n + Object.values(g.levels).reduce((k, l) => k + l.stars, 0), 0);
  const totalLessons = courses.reduce((n, c) => n + c.modules.reduce((k, m) => k + m.lessons.length, 0), 0);
  const totalSeconds = computeTotalStudyTime(s);

  const rankCard = h(
    'section.rank-card',
    h(
      'div.rank-identity',
      createProfileAvatar({
        size: 'lg',
        breathing: true,
        label: s.name ? `${s.name} profile photo` : 'Learner profile photo',
      }),
      h(
        'div.rank-main',
        h('p.rank-level', s.name ? `${s.name} · Rank ${rank.level}` : `Rank ${rank.level}`),
        h('h2', rank.name),
        h('p.rank-xp', h('strong', s.xp.toLocaleString()), ' XP')
      )
    ),
    h(
      'div.rank-next',
      rank.next ? h('p', `${(rank.next.xp - s.xp).toLocaleString()} XP to ${rank.next.name}`) : h('p', 'You have reached the top rank.'),
      h('div.progress-bar', { role: 'progressbar', 'aria-valuenow': rank.pct, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-label': 'Progress to next rank' }, h('i', { style: { width: rank.pct + '%' } }))
    ),
    h('div.streak', icon('flame', 22), h('div', h('strong', plural(s.streak.count, 'day')), h('span', `streak · best ${s.streak.best}`)))
  );

  const tiles = h(
    'ul.tiles',
    tile('book', lessonsDone, `of ${totalLessons}`, 'lessons finished'),
    tile('terminal', exercisesDone, '', 'exercises solved'),
    tile('list', quizzesPassed, '', 'quizzes passed'),
    tile('gamepad', levels, '', 'game levels cleared'),
    tile('star', stars, '', 'game stars'),
    tile('clock', formatStudyDuration(totalSeconds), '', 'time spent')
  );

  const rhythmGoalBarFill = h('i');
  const rhythmGoalBar = h(
    'div.progress-bar.rhythm-goal-bar',
    { role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0, 'aria-label': 'Daily study goal progress' },
    rhythmGoalBarFill
  );
  const rhythmStatus = h('p.rhythm-status');
  const rhythmSummary = h('p.rhythm-week-sum');
  const weekGrid = h('ol.week-bars', { 'aria-label': '7-day study activity' });
  const presetBtns = h(
    'div.seg-group.goal-presets',
    { role: 'group', 'aria-label': 'Daily study goal minutes' },
    GOAL_PRESETS.map((min) =>
      h(
        'button.seg-btn',
        {
          type: 'button',
          dataset: { goalMin: String(min) },
          onclick: () => {
            store.setDailyGoalMinutes(min);
            toast(`Daily goal set to ${min} minutes`, { icon: 'check' });
          },
        },
        `${min}m`
      )
    )
  );

  function paintRhythm() {
    const curState = store.state;
    const goal = computeDailyGoalProgress(curState);
    const series = buildWeeklyActivitySeries(curState);
    const weekSum = summarizeWeeklyActivity(series);

    presetBtns.querySelectorAll('.seg-btn').forEach((btn) => {
      const on = Number(btn.dataset.goalMin) === goal.goalMinutes;
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });

    const studiedLabel = goal.studiedSeconds > 0 ? formatStudyDuration(goal.studiedSeconds) : '0m';
    const remMin = Math.ceil(goal.remainingSeconds / 60);
    rhythmStatus.replaceChildren(
      h('strong', goal.reached ? `Goal reached (${studiedLabel})` : `${studiedLabel} of ${goal.goalMinutes}m today`),
      h('span.muted', goal.reached ? ` · ${goal.lessonsToday} lessons · ${goal.exercisesToday} exercises today` : ` · ${remMin}m remaining · ${goal.pct}%`)
    );
    rhythmGoalBar.setAttribute('aria-valuenow', String(goal.pct));
    rhythmGoalBar.classList.toggle('is-reached', goal.reached);
    rhythmGoalBarFill.style.width = `${goal.pct}%`;

    weekGrid.replaceChildren(
      ...series.map((d) => {
        const dur = d.seconds > 0 ? formatStudyDuration(d.seconds) : '0m';
        const tip = `${d.dateKey}: ${dur}, ${plural(d.lessons, 'lesson')}, ${plural(d.exercises, 'exercise')}`;
        return h(
          'li.week-bar-col' + (d.isToday ? '.is-today' : '') + (d.goalReached ? '.is-goal' : ''),
          { title: tip },
          h('span.week-bar-val', d.seconds > 0 ? dur : ''),
          h(
            'div.week-bar-track',
            { 'aria-label': tip },
            h('i.week-bar-fill', { style: { height: `${Math.max(d.seconds > 0 ? 8 : 0, d.heightPct)}%` } })
          ),
          h('span.week-bar-day', d.weekdayLabel)
        );
      })
    );

    const weekDur = weekSum.totalSeconds > 0 ? formatStudyDuration(weekSum.totalSeconds) : '0m';
    rhythmSummary.textContent = `Last 7 days: ${weekDur} total · ${plural(weekSum.activeDays, 'active day')} · ${plural(weekSum.lessons, 'lesson')} · ${plural(weekSum.exercises, 'exercise')}`;
  }
  paintRhythm();
  const unsubscribeRhythm = store.subscribe(paintRhythm);

  const rhythmSection = h(
    'section.study-rhythm-card',
    { 'aria-label': 'Daily study goal and weekly activity' },
    h(
      'div.rhythm-head',
      h('div', h('h2', 'Daily study goal'), rhythmStatus),
      h('div.rhythm-controls', h('span.rhythm-label', 'Target'), presetBtns)
    ),
    rhythmGoalBar,
    h('div.rhythm-week-head', h('h3', 'Last 7 days'), rhythmSummary),
    weekGrid
  );

  const mastery = courses[0] ? computeLineMastery(courses[0], s) : { lines: [], nextStation: null };
  const nextCard = mastery.nextStation
    ? h(
        'section.next-station-card',
        { dataset: { line: mastery.nextStation.lineId } },
        h(
          'div',
          h('p.next-station-kicker', `${mastery.nextStation.lineTitle} line · ${mastery.nextStation.moduleTitle}`),
          h('h2', `Next up: ${mastery.nextStation.title}`)
        ),
        h('a.btn.btn-primary', { href: mastery.nextStation.href }, icon('play', 16), 'Continue')
      )
    : null;

  const linesSection = mastery.lines.length
    ? h(
        'section.line-mastery',
        h('h2', 'Learning lines'),
        h(
          'ul.line-mastery-grid',
          mastery.lines.map((ln) =>
            h(
              'li.line-mastery-card',
              { dataset: { line: ln.id } },
              h('div.lm-head', h('strong', ln.title), h('span.lm-pct', `${ln.pct}%`)),
              h('div.progress-bar', { 'aria-hidden': 'true' }, h('i', { style: { width: ln.pct + '%' } })),
              h('p.lm-meta', `${ln.modulesComplete}/${ln.modulesTotal} modules · ${ln.lessonsDone}/${ln.lessonsTotal} lessons · ${ln.gamesDone}/${ln.gamesTotal} games`)
            )
          )
        )
      )
    : null;

  const modulesSection = h(
    'section.prog-modules',
    h('h2', 'Modules'),
    courses.map((c) =>
      h(
        'ul.mod-bars',
        c.modules
          .filter((m) => !m.missing)
          .map((m) => {
            const p = moduleProgress(m, s);
            const modSec = store.moduleSeconds(m.key);
            const statusText = p.complete ? 'Complete' : p.pct + '%';
            const label = modSec > 0 ? `${formatStudyDuration(modSec)} · ${statusText}` : statusText;
            return h('li', { dataset: { line: m.line.id } }, h('a', { href: `#/c/${c.id}/${m.id}` }, h('span.mb-title', `${m.index + 1}. ${m.title}`), h('span.mb-pct', label)), h('div.progress-bar', { 'aria-hidden': 'true' }, h('i', { style: { width: p.pct + '%' } })));
          })
      )
    )
  );

  const defs = [...allBadgeDefs(courses), ...EXTRA_BADGES];
  const earnedCount = defs.filter((d) => s.badges[d.id]).length;
  const badgesSection = h(
    'section.badges',
    h('h2', 'Badges'),
    h('p.muted', `${earnedCount} of ${defs.length} earned`),
    h(
      'ul.badge-grid',
      defs.map((d) => {
        const at = s.badges[d.id];
        return h('li.badge' + (at ? '.is-earned' : ''), { dataset: d.line ? { line: d.line } : {}, title: at ? `Earned ${formatDate(at)}` : 'Not earned yet' }, h('span.badge-icon', icon(at ? d.icon : 'lock', 22)), h('div', h('strong', d.title), h('span', d.text)));
      })
    )
  );

  const courseDone = courses.length && courses.every((c) => c.modules.filter((m) => !m.missing).every((m) => moduleProgress(m, s).complete));
  const certSection = h(
    'section.cert-card',
    h('h2', 'Certificate'),
    courseDone ? h('p', 'You have finished every module. You can print a certificate of completion.') : h('p', 'Finish every lesson, quiz and game in the course to unlock a printable certificate of completion.'),
    courseDone ? h('a.btn.btn-primary', { href: `#/certificate/${courses[0].id}` }, icon('award', 16), 'Open my certificate') : null
  );

  const nameInput = h('input.input', { type: 'text', maxlength: 60, value: s.name, placeholder: 'Your name (used on the certificate)', 'aria-label': 'Your name', onchange: (e) => store.setName(e.target.value.trim()) });
  const fileInput = h('input', {
    type: 'file',
    accept: 'application/json,.json',
    hidden: true,
    onchange: async (e) => {
      const f = e.target.files[0];
      if (!f) return;
      try {
        store.importJson(await f.text());
        toast('Progress restored', { icon: 'check' });
        location.reload();
      } catch (err) {
        toast(err.message || 'Could not read that file', { kind: 'error' });
      }
    },
  });
  const dataSection = h(
    'section.data-card',
    h('h2', 'Your data'),
    h('p', 'Your progress is saved only in this browser. To keep it safe, or to move to another device, download a backup file and restore it there.'),
    h('div.field', h('label', 'Name'), nameInput),
    h(
      'div.btn-row',
      h('button.btn.btn-secondary', { type: 'button', onclick: () => download(`codequest-backup-${new Date().toISOString().slice(0, 10)}.json`, store.exportJson(), 'application/json') }, icon('download', 16), 'Download backup'),
      h('button.btn.btn-secondary', { type: 'button', onclick: () => fileInput.click() }, icon('upload', 16), 'Restore from backup'),
      fileInput,
      h(
        'button.btn.btn-ghost.btn-danger-text',
        {
          type: 'button',
          onclick: async () => {
            const ok = await confirmAction({
              title: 'Erase all saved progress?',
              message: 'This will remove all completed lessons, XP, badges, study history, and saved code in this browser. This cannot be undone.',
              confirmLabel: 'Erase everything',
              tone: 'danger',
            });
            if (ok) {
              store.reset();
              toast('Progress erased');
              location.hash = '#/';
              location.reload();
            }
          },
        },
        icon('trash', 15),
        'Erase everything'
      )
    )
  );

  const node = h('section.page.progress-page', h('h1', 'Your progress'), rankCard, nextCard, tiles, rhythmSection, linesSection, modulesSection, badgesSection, certSection, dataSection, h('details.rank-ladder', h('summary', 'All ranks'), h('ol', RANKS.map((r) => h('li' + (r.name === rank.name ? '.is-current' : ''), h('strong', r.name), h('span', `${r.xp.toLocaleString()} XP`))))));
  return {
    node,
    title: 'Progress',
    cleanup() {
      unsubscribeRhythm();
    },
  };
}

function tile(ic, n, of, label) {
  return h('li.tile', icon(ic, 20), h('strong', String(n), of ? h('small', ` ${of}`) : null), h('span', label));
}
