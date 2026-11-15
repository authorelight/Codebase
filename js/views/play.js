import { h, debounce, copyText, download, prefersReducedMotion } from '../lib/util.js';
import { icon } from '../lib/icons.js';
import { createEditor } from '../ui/editor.js';
import { createConsole } from '../ui/console.js';
import { createTraceBlock } from '../ui/tracer.js';
import { runInto, requestFor, INPUT_RE, engineProblem } from '../ui/run.js';
import { runner } from '../py/runner.js';
import { store } from '../store.js';
import { toast } from '../ui/toast.js';
import { EXAMPLES } from '../examples.js';
import { encodeShare, decodeShare } from '../lib/share.js';
import { openReferenceModal } from '../ui/cheatsheet-modal.js';

export async function playView({ code: shared }) {
  let initial = store.getDraft('playground');
  let notice = null;
  if (shared) {
    try {
      initial = await decodeShare(shared);
      notice = 'You opened a shared program. Press Run to see what it does. Your own playground code is untouched until you edit this one.';
    } catch {
      notice = 'That share link could not be read, so the playground opened with your last program instead.';
    }
  }
  if (initial === null || initial === undefined) initial = EXAMPLES[0].code;

  const ed = createEditor({ value: initial, minLines: 18, maxLines: 44, onRun: () => run(), onFocus: () => runner.warm(), ariaLabel: 'Playground code editor' });
  const con = createConsole({ title: 'Output', placeholder: 'Run your program to see its output here.' });
  con.el.classList.add('con-tall');
  const stdin = h('textarea.stdin-area', { rows: 3, spellcheck: 'false', 'aria-label': 'Program input, one line per input() call', placeholder: 'One line per input() call' });
  const stdinHelp = h('span.muted');
  const stdinBox = h('div.stdin', { hidden: true }, h('label', 'Program input'), stdinHelp, stdin);

  const save = debounce((v) => !shared && store.setDraft('playground', v), 600);
  const syncInput = () => {
    const needs = INPUT_RE.test(ed.getValue());
    stdinBox.hidden = !needs;
    if (needs) stdinHelp.textContent = runner.jspi === false ? ' Type your answers here before you run, one per line.' : ' Optional: type answers here, or leave it empty and answer in the output panel.';
  };
  ed.onChange((v) => {
    save(v);
    syncInput();
  });
  syncInput();

  let running = false;
  const runTimeEl = h('span.play-runtime.muted', { 'aria-live': 'polite' });
  const runBtn = h('button.btn.btn-primary', { type: 'button', onclick: () => run(), onpointerenter: () => runner.warm() }, icon('play', 16), 'Run');
  const stopBtn = h('button.btn.btn-danger', { type: 'button', hidden: true, onclick: () => runner.stop() }, icon('stop', 14), 'Stop');
  async function run() {
    if (running) return;
    running = true;
    runBtn.disabled = true;
    stopBtn.hidden = false;
    runTimeEl.textContent = '';
    try {
      const res = await runInto({ con, editor: ed, request: requestFor({ code: ed.getValue(), stdin: stdin.value }), countAs: 'playground' });
      const problem = engineProblem(res);
      if (problem) toast(problem, { kind: 'error', ms: 9000 });
      else if (res && typeof res.ms === 'number') runTimeEl.textContent = `${res.ms} ms`;
    } finally {
      running = false;
      runBtn.disabled = false;
      stopBtn.hidden = true;
    }
  }

  // Step through: runs the program once under the tracer, then shows it line by line (the same viewer as the lessons)
  const traceHost = h('section.play-trace', { hidden: true, 'aria-label': 'Step through your program' });
  const traceBtn = h(
    'button.btn.btn-secondary',
    { type: 'button', title: 'Run the program once, then move through it one line at a time and watch the variables', onclick: () => stepThrough() },
    icon('eye', 16),
    'Step through'
  );
  function stepThrough() {
    const code = ed.getValue();
    if (!code.trim()) return toast('Write some code first', { kind: 'error' });
    if (INPUT_RE.test(code) && !stdin.value.trim()) {
      stdin.focus();
      return toast('This program asks for input', { kind: 'error', detail: 'Type the answers in the Program input box, one per line, then press Step through again.', ms: 7000 });
    }
    const block = createTraceBlock({ code, stdin: stdin.value, label: 'Your program, step by step' });
    const close = h(
      'button.btn.btn-ghost.btn-sm',
      {
        type: 'button',
        onclick: () => {
          traceHost.hidden = true;
          traceHost.replaceChildren();
          ed.focus();
        },
      },
      icon('x', 15),
      'Close'
    );
    traceHost.replaceChildren(h('div.play-trace-bar', h('h2', 'Step through'), close), block);
    traceHost.hidden = false;
    block.traceBlock.start();
    block.scrollIntoView({ block: 'nearest', behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  const select = h(
    'select.select',
    {
      'aria-label': 'Load an example',
      onchange: (e) => {
        const ex = EXAMPLES.find((x) => x.id === e.target.value);
        if (ex) {
          ed.setValue(ex.code);
          stdin.value = ex.stdin || '';
          con.reset();
        }
        e.target.value = '';
      },
    },
    h('option', { value: '' }, 'Load an example…'),
    EXAMPLES.map((x) => h('option', { value: x.id }, x.title))
  );

  // ---- saved snippets (localStorage) ----
  const snipNameInput = h('input.input.snip-name-input', {
    type: 'text',
    maxlength: 48,
    placeholder: 'Snippet name (e.g. Fibonacci helper)',
    'aria-label': 'Snippet name',
  });
  const saveForm = h(
    'form.snip-save-form',
    {
      hidden: true,
      onsubmit: (e) => {
        e.preventDefault();
        const name = snipNameInput.value.trim();
        if (!name) {
          snipNameInput.focus();
          return toast('Give the snippet a name first', { kind: 'error' });
        }
        const saved = store.saveSnippet(name, ed.getValue());
        if (saved) {
          snipNameInput.value = '';
          saveForm.hidden = true;
          renderSnippets();
          toast(`Saved “${saved.name}”`, { icon: 'check' });
        }
      },
    },
    snipNameInput,
    h('button.btn.btn-primary.btn-sm', { type: 'submit' }, 'Save'),
    h('button.btn.btn-ghost.btn-sm', { type: 'button', onclick: () => (saveForm.hidden = true) }, 'Cancel')
  );
  const saveToggleBtn = h(
    'button.btn.btn-secondary',
    {
      type: 'button',
      onclick: () => {
        saveForm.hidden = !saveForm.hidden;
        if (!saveForm.hidden) snipNameInput.focus();
      },
    },
    icon('edit', 15),
    'Save snippet'
  );
  const snipBar = h('div.snip-bar', { hidden: true });
  function renderSnippets() {
    const list = store.snippets();
    snipBar.hidden = !list.length;
    if (!list.length) {
      snipBar.replaceChildren();
      return;
    }
    snipBar.replaceChildren(
      h('span.snip-label', 'Saved snippets'),
      h(
        'ul.snip-list',
        list.map((item) =>
          h(
            'li.snip-item',
            h(
              'button.snip-load',
              {
                type: 'button',
                title: `Load ${item.name}`,
                onclick: () => {
                  ed.setValue(item.code);
                  con.reset();
                  if (!shared) store.setDraft('playground', item.code);
                  toast(`Loaded “${item.name}”`, { icon: 'check' });
                },
              },
              item.name
            ),
            h(
              'button.snip-del',
              {
                type: 'button',
                'aria-label': `Delete snippet ${item.name}`,
                title: `Delete ${item.name}`,
                onclick: () => {
                  store.deleteSnippet(item.id);
                  renderSnippets();
                },
              },
              icon('x', 13)
            )
          )
        )
      )
    );
  }
  renderSnippets();

  const refBtn = h('button.btn.btn-secondary', { type: 'button', onclick: () => openReferenceModal() }, icon('book', 15), 'Reference');
  const shareBtn = h(
    'button.btn.btn-secondary',
    {
      type: 'button',
      onclick: async () => {
        const token = await encodeShare(ed.getValue());
        const link = `${location.origin}${location.pathname}#/play/${token}`;
        if (link.length > 6000) toast('That program is too long for a link. Download it instead.', { kind: 'error' });
        else if (await copyText(link)) {
          store.bump('shares');
          toast('Link copied', { icon: 'link', detail: 'Anyone who opens it sees your code.' });
        } else toast('Could not copy the link', { kind: 'error' });
      },
    },
    icon('link', 16),
    'Copy share link'
  );
  const dlBtn = h('button.btn.btn-secondary', { type: 'button', onclick: () => download('program.py', ed.getValue().replace(/\s*$/, '\n'), 'text/x-python') }, icon('download', 16), 'Download .py');
  const clearBtn = h(
    'button.btn.btn-ghost',
    {
      type: 'button',
      onclick: () => {
        if (ed.getValue().trim() && !confirm('Clear the editor? This cannot be undone.')) return;
        ed.setValue('');
        con.reset();
        ed.focus();
      },
    },
    icon('trash', 15),
    'Clear'
  );

  const node = h(
    'section.page.play-page',
    h('header.play-head', h('h1', 'Playground'), h('p.lede', 'A blank page for any Python you like. It runs in your browser, so the standard library is available but there is no internet access.')),
    notice ? h('p.notice', icon('info', 16), notice) : null,
    h('div.toolbar', runBtn, stopBtn, traceBtn, select, saveToggleBtn, refBtn, runTimeEl, h('span.toolbar-gap'), shareBtn, dlBtn, clearBtn),
    saveForm,
    snipBar,
    h('div.play-grid', h('div.play-editor', ed.el), h('div.play-side', stdinBox, con.el)),
    traceHost
  );
  return { node, title: 'Playground' };
}
