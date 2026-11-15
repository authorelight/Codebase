// Accessible in-app confirmation modal (<dialog>) replacing blocking window.confirm().
// Does not use backdrop-filter so headless Chromium dialog rendering remains crisp and fast.

import { h } from '../lib/util.js';
import { icon } from '../lib/icons.js';

let activePromise = null;

/**
 * Ask the learner to confirm an action inside an accessible <dialog>.
 * Resolves to `true` if confirmed, `false` if cancelled or dismissed via Escape/backdrop.
 */
export function confirmAction({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  tone = 'primary',
} = {}) {
  if (activePromise) return activePromise;

  activePromise = new Promise((resolve) => {
    let settled = false;
    const prevFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    const titleId = 'cq-confirm-title-' + Date.now().toString(36);
    const descId = 'cq-confirm-desc-' + Date.now().toString(36);

    const cancelBtn = h(
      'button.btn.btn-secondary',
      { type: 'button', onclick: () => finish(false) },
      cancelLabel
    );
    const okBtn = h(
      `button.btn.${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`,
      { type: 'button', onclick: () => finish(true) },
      tone === 'danger' ? icon('warn', 16) : icon('check', 16),
      confirmLabel
    );

    const closeBtn = h(
      'button.btn.btn-ghost.btn-sm.btn-icon',
      { type: 'button', 'aria-label': 'Close confirmation', onclick: () => finish(false) },
      icon('x', 16)
    );

    const panel = h(
      'div.cq-dialog-panel.cq-confirm-panel',
      h(
        'header.cq-confirm-head',
        h('span.cq-confirm-badge' + (tone === 'danger' ? '.is-danger' : ''), icon(tone === 'danger' ? 'warn' : 'info', 18)),
        h(`h2#${titleId}`, title),
        closeBtn
      ),
      message ? h(`p.cq-confirm-msg#${descId}`, message) : null,
      h('footer.cq-confirm-actions', cancelBtn, okBtn)
    );

    const dialog = h(
      'dialog.cq-dialog.cq-confirm-dialog',
      {
        'aria-labelledby': titleId,
        'aria-describedby': message ? descId : null,
        oncancel: (e) => {
          e.preventDefault();
          finish(false);
        },
        onclick: (e) => {
          if (e.target === dialog) finish(false);
        },
      },
      panel
    );

    function finish(result) {
      if (settled) return;
      settled = true;
      try {
        if (dialog.open) dialog.close();
      } catch {}
      dialog.remove();
      activePromise = null;
      if (prevFocus && prevFocus.isConnected) prevFocus.focus();
      resolve(result);
    }

    document.body.appendChild(dialog);
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    cancelBtn.focus();
  });

  return activePromise;
}
