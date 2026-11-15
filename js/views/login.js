// The password screen. Integrates the learner profile portrait, neural-synaptic resonance field,
// and smooth cognitive unlock transition before booting the workspace.
import { h, prefersReducedMotion } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { brandMark } from '../ui/brand.js';
import { createProfileAvatar } from '../ui/avatar.js';
import { createNeuralBackdrop } from '../ui/neural-bg.js';
import { createThemeToggle } from '../ui/theme-toggle.js';
import { SITE } from '../config.js';
import { canCheck, checkPassword, unlock } from '../auth.js';

const WRONG = 'That password is not right. Passwords are case-sensitive, so check the capital letters.';

function savedLearnerName() {
  try {
    const raw = localStorage.getItem('cq:v1');
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed.name === 'string' ? parsed.name.trim() : '';
  } catch {
    return '';
  }
}

/** Shows the screen inside `app` and resolves once the right password has been typed. */
export function showLogin(app) {
  document.title = `Log in · ${SITE.name}`;
  return new Promise((resolve) => {
    const secure = canCheck();
    const learnerName = savedLearnerName();

    const pw = h('input.input#login-pw', {
      type: 'password',
      name: 'password',
      autocomplete: 'current-password',
      autocapitalize: 'none',
      autocorrect: 'off',
      spellcheck: 'false',
      enterkeyhint: 'go',
      required: true,
      disabled: !secure,
      'aria-describedby': 'login-caps login-msg',
    });
    const show = h('button.btn.btn-secondary.login-show', { type: 'button', 'aria-controls': 'login-pw', 'aria-label': 'Show password', disabled: !secure }, 'Show');
    const caps = h('p.login-caps#login-caps', { 'aria-live': 'polite' });
    const msg = h('p.login-msg#login-msg', { role: 'alert' });
    const remember = h('input', { type: 'checkbox', id: 'login-remember', checked: true });
    const idle = () => [icon('lock', 18), 'Log in'];
    const go = h('button.btn.btn-primary.btn-lg.login-go', { type: 'submit', disabled: !secure }, ...idle());

    const avatar = createProfileAvatar({
      size: 'xl',
      breathing: true,
      label: learnerName ? `${learnerName} profile photo` : 'Learner profile photo',
    });

    const form = h(
      'form.login-card',
      { novalidate: true, onsubmit: submit },
      h(
        'div.login-profile-hero',
        avatar,
        h(
          'div.login-profile-copy',
          h('p.login-kicker', SITE.name),
          h('h1', learnerName ? `Welcome back, ${learnerName}` : 'Log in to continue'),
          h('p.login-lede', 'Enter your password to resume your Python journey.')
        )
      ),
      secure ? null : h('div.notice.is-warn', { role: 'alert' }, icon('warn', 18), h('span', 'This address is not secure, so the browser cannot check the password. Open the site from its https:// address, or from http://localhost.')),
      h('label.login-label', { for: 'login-pw' }, 'Password'),
      h('div.login-field', pw, show),
      caps,
      msg,
      h('label.login-remember', { for: 'login-remember' }, remember, h('span', 'Keep me logged in on this device')),
      go,
      h('p.login-note.muted', 'Lost the password? Ask the person who gave you the link. Your progress stays in this browser only.')
    );

    const showcase = h(
      'section.login-showcase',
      { 'aria-label': 'Learning approach' },
      h('div.login-brand', brandMark(), h('span', SITE.name)),
      h('h2.login-showcase-title', 'Train your programming intuition'),
      h('p.login-showcase-lede', 'Designed around how the brain encodes procedural fluency: short active recall cycles, step-through memory visualization, and calm rhythm.'),
      h(
        'dl.login-pillars',
        h('div.login-pillar', h('dt', '01. Active recall'), h('dd', 'Write and verify real Python directly inside every reading with instant diagnostics.')),
        h('div.login-pillar', h('dt', '02. Visible state'), h('dd', 'Step line-by-line through variables and call frames so mental models click fast.')),
        h('div.login-pillar', h('dt', '03. Focused pacing'), h('dd', 'Fifteen modular stations with a non-intrusive study timer and zero setup.')),
      )
    );

    const topTools = h('div.login-topbar', createThemeToggle());
    const page = h(
      'main.login-page#main',
      { tabindex: '-1' },
      createNeuralBackdrop({ variant: 'portal' }),
      topTools,
      h('div.login-shell', showcase, form)
    );

    show.addEventListener('click', () => {
      const reveal = pw.type === 'password';
      pw.type = reveal ? 'text' : 'password';
      show.textContent = reveal ? 'Hide' : 'Show';
      show.setAttribute('aria-label', reveal ? 'Hide password' : 'Show password');
      pw.focus();
    });

    const watchCaps = (e) => {
      if (e.getModifierState) caps.textContent = e.getModifierState('CapsLock') ? 'Caps Lock is on.' : '';
    };
    pw.addEventListener('keydown', watchCaps);
    pw.addEventListener('keyup', watchCaps);
    pw.addEventListener('blur', () => (caps.textContent = ''));
    pw.addEventListener('input', () => {
      if (msg.textContent) msg.textContent = '';
      pw.removeAttribute('aria-invalid');
    });

    function fail(text) {
      msg.textContent = '';
      setTimeout(() => (msg.textContent = text), 40);
      pw.setAttribute('aria-invalid', 'true');
      form.classList.remove('is-wrong');
      void form.offsetWidth;
      form.classList.add('is-wrong');
      pw.focus();
    }

    let busy = false;
    async function submit(e) {
      e.preventDefault();
      if (busy || !secure) return;
      if (!pw.value.trim()) return fail('Type the password first.');
      busy = true;
      go.disabled = true;
      go.replaceChildren('Checking…');
      let ok = false;
      try {
        ok = await checkPassword(pw.value);
      } catch (err) {
        console.warn('Password check failed:', err);
        busy = false;
        go.disabled = false;
        go.replaceChildren(...idle());
        return fail('Your browser could not check the password. Try again, or use a recent version of Chrome, Edge, Firefox or Safari.');
      }
      if (ok) {
        unlock(remember.checked);
        page.classList.add('is-unlocking');
        const delay = prefersReducedMotion() ? 0 : 220;
        setTimeout(() => {
          app.replaceChildren();
          resolve();
        }, delay);
        return;
      }
      busy = false;
      go.disabled = false;
      go.replaceChildren(...idle());
      fail(WRONG);
      pw.select();
    }

    app.replaceChildren(page);
    if (secure) pw.focus();
  });
}
