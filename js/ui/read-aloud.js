// Browser-native text-to-speech controls for lesson teaching content.
//
// The reader deliberately collects rendered teaching text rather than the raw
// Markdown document. Code blocks and interface controls are excluded, while
// exercise prompts, visible hints, question choices and explanations are read.

import { h } from '../lib/util.js';
import { icon } from '../lib/icons.js';

const SPEEDS = [0.75, 1, 1.25, 1.5];
const READABLE_SELECTOR = '.prose, .q-text, .q-hint, .ex-hint, .q-explain, .callout-title, .ex-head h3';
const OMIT_FROM_CLONE = [
  'pre',
  'figure',
  'button',
  'input',
  'textarea',
  'select',
  'option',
  'svg',
  'script',
  'style',
  '[hidden]',
  '[aria-hidden="true"]',
  '.ed',
  '.con',
  '.runblock',
  '.traceblock',
  '.codeblock',
].join(',');

function isHiddenByAncestor(element, root) {
  let current = element;
  while (current && current !== root) {
    if (
      current.hidden ||
      current.getAttribute('aria-hidden') === 'true' ||
      (current.matches && current.matches('details:not([open])'))
    ) {
      return true;
    }
    current = current.parentElement;
  }
  return false;
}

/** Split long teaching text into speech-sized chunks without dropping words. */
export function splitSpeechText(value, maxLength = 520) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  if (!text) return [];

  const sentences = [];
  if (typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function') {
    const segmenter = new Intl.Segmenter('en', { granularity: 'sentence' });
    for (const part of segmenter.segment(text)) {
      if (part.segment.trim()) sentences.push(part.segment.trim());
    }
  } else {
    const parts = text.match(/[^.!?]+[.!?]+["')\]”’]*|[^.!?]+$/g);
    sentences.push(...(parts || [text]).map((part) => part.trim()).filter(Boolean));
  }

  const chunks = [];
  let current = '';

  function addWords(sentence) {
    const words = sentence.split(/\s+/);
    let piece = '';
    for (const word of words) {
      const candidate = piece ? piece + ' ' + word : word;
      if (candidate.length <= maxLength || !piece) {
        piece = candidate;
      } else {
        chunks.push(piece);
        piece = word;
      }
    }
    if (piece) return piece;
    return '';
  }

  for (const sentence of sentences) {
    const candidate = current ? current + ' ' + sentence : sentence;
    if (candidate.length <= maxLength) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    current = '';
    current = addWords(sentence);
  }
  if (current) chunks.push(current);
  return chunks;
}

function visibleTeachingItems(root, lessonTitle) {
  const elements = [...root.querySelectorAll(READABLE_SELECTOR)];
  const items = [];
  let currentSection = 'Lesson introduction';

  for (const element of elements) {
    if (isHiddenByAncestor(element, root)) continue;

    const clone = element.cloneNode(true);
    clone.querySelectorAll(OMIT_FROM_CLONE).forEach((node) => node.remove());

    const headings = [...clone.querySelectorAll('h2, h3')];
    if (headings.length) {
      currentSection = headings[0].textContent.trim() || currentSection;
    }

    const text = String(clone.innerText || clone.textContent || '')
      .replace(/[\u00a0\u200b]/g, ' ')
      .replace(/[\t\r\n]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!text) continue;
    items.push({
      element,
      section: headings[0]?.textContent.trim() || currentSection || lessonTitle,
      chunks: splitSpeechText(text),
    });
  }

  return items.filter((item) => item.chunks.length);
}

function preferredEnglishVoice(voices) {
  return (
    voices.find((voice) => /^en([_-]|$)/i.test(voice.lang || '') && voice.default) ||
    voices.find((voice) => /^en([_-]|$)/i.test(voice.lang || '')) ||
    null
  );
}

export function createReadAloud({ content, title = 'Lesson' }) {
  const supported =
    typeof window !== 'undefined' &&
    window.speechSynthesis &&
    typeof window.SpeechSynthesisUtterance === 'function';

  const status = h(
    'p.lesson-audio-status',
    { role: 'status', 'aria-live': 'polite', 'aria-atomic': 'true' },
    supported
      ? 'Ready to read. Press Play when you are ready.'
      : 'Read Aloud is not supported by this browser. Try a browser with speech synthesis enabled.'
  );
  const currentSection = h('p.lesson-audio-section', { 'aria-live': 'polite' }, 'Nothing is playing');

  const playBtn = h(
    'button.btn.btn-primary',
    { type: 'button', 'aria-label': 'Play lesson audio', onclick: play },
    icon('play', 15),
    'Play'
  );
  const pauseBtn = h(
    'button.btn.btn-secondary',
    { type: 'button', 'aria-label': 'Pause lesson audio', onclick: pause, hidden: true },
    icon('pause', 15),
    'Pause'
  );
  const resumeBtn = h(
    'button.btn.btn-secondary',
    { type: 'button', 'aria-label': 'Resume lesson audio', onclick: resume, hidden: true },
    icon('play', 15),
    'Resume'
  );
  const stopBtn = h(
    'button.btn.btn-ghost',
    { type: 'button', 'aria-label': 'Stop lesson audio', onclick: stop, hidden: true },
    icon('stop', 15),
    'Stop'
  );

  const rateSelect = h(
    'select.lesson-audio-select',
    { 'aria-label': 'Reading speed', onchange: onRateChange },
    SPEEDS.map((rate) => h('option', { value: String(rate), selected: rate === 1 }, rate === 1 ? '1.0x' : rate + 'x'))
  );
  const voiceSelect = h(
    'select.lesson-audio-select',
    { 'aria-label': 'Voice', onchange: onVoiceChange },
    h('option', { value: '-1' }, 'System default')
  );
  const controls = h(
    'div.lesson-audio-controls',
    playBtn,
    pauseBtn,
    resumeBtn,
    stopBtn
  );
  const settings = h(
    'div.lesson-audio-settings',
    h('label.lesson-audio-field', h('span', 'Reading speed'), rateSelect),
    h('label.lesson-audio-field', h('span', 'Voice'), voiceSelect)
  );
  const card = h(
    'section.lesson-audio',
    { 'aria-label': 'Listen to this lesson' },
    h(
      'div.lesson-audio-heading',
      h('h2.lesson-audio-title', icon('volume', 19), 'Listen to this lesson'),
      h('p.lesson-audio-note', 'Listen while you follow the lesson on screen.')
    ),
    currentSection,
    controls,
    settings,
    h('p.lesson-audio-help', 'Available English voices depend on your browser and device. Some voices may need an internet connection; offline playback depends on the voice installed on your device. Code examples stay on screen for you to follow.'),
    status
  );

  if (!supported) {
    playBtn.disabled = true;
    pauseBtn.disabled = true;
    resumeBtn.disabled = true;
    stopBtn.disabled = true;
    rateSelect.disabled = true;
    voiceSelect.disabled = true;
    return { el: card, cleanup() {} };
  }

  const synthesis = window.speechSynthesis;
  let voices = [];
  let selectedVoice = null;
  let queue = [];
  let itemIndex = 0;
  let chunkIndex = 0;
  let currentUtterance = null;
  let activeElement = null;
  let state = 'idle';
  let destroyed = false;
  let needsRestart = false;
  let playbackToken = 0;

  function renderState() {
    playBtn.hidden = state !== 'idle';
    pauseBtn.hidden = state !== 'speaking';
    resumeBtn.hidden = state !== 'paused';
    stopBtn.hidden = state === 'idle';
  }

  function clearHighlight() {
    if (activeElement) activeElement.classList.remove('is-read-aloud-current');
    activeElement = null;
  }

  function setActiveItem(item) {
    if (activeElement !== item.element) {
      clearHighlight();
      activeElement = item.element;
      activeElement.classList.add('is-read-aloud-current');
    }
    currentSection.textContent = 'Section: ' + item.section;
    status.textContent = 'Reading ' + item.section + '…';
  }

  function refreshVoices() {
    if (destroyed) return;
    const previousUri = selectedVoice?.voiceURI || '';
    voices = synthesis.getVoices();

    voiceSelect.replaceChildren(h('option', { value: '-1' }, 'System default'));
    voices.forEach((voice, index) => {
      voiceSelect.appendChild(
        h('option', { value: String(index) }, voice.name + ' (' + voice.lang + ')')
      );
    });

    let nextIndex = voices.findIndex((voice) => voice.voiceURI === previousUri);
    if (nextIndex < 0) {
      const preferred = preferredEnglishVoice(voices);
      nextIndex = preferred ? voices.indexOf(preferred) : -1;
    }

    selectedVoice = nextIndex >= 0 ? voices[nextIndex] : null;
    voiceSelect.value = nextIndex >= 0 ? String(nextIndex) : '-1';
    if (voices.length && !status.textContent.includes('Reading ')) {
      status.textContent = 'Ready to read. Press Play when you are ready.';
    }
  }

  function currentRate() {
    return Number(rateSelect.value) || 1;
  }

  function speakCurrent() {
    if (destroyed || state !== 'speaking') return;
    const item = queue[itemIndex];
    if (!item) {
      finish();
      return;
    }

    const text = item.chunks[chunkIndex];
    if (!text) {
      itemIndex += 1;
      chunkIndex = 0;
      speakCurrent();
      return;
    }

    setActiveItem(item);
    const token = playbackToken;
    const utterance = new window.SpeechSynthesisUtterance(text);
    currentUtterance = utterance;
    utterance.rate = currentRate();
    utterance.lang = selectedVoice?.lang || 'en';
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => {
      if (destroyed || token !== playbackToken || state !== 'speaking') return;
      chunkIndex += 1;
      if (chunkIndex >= item.chunks.length) {
        itemIndex += 1;
        chunkIndex = 0;
      }
      speakCurrent();
    };

    utterance.onerror = (event) => {
      if (destroyed || token !== playbackToken || event.error === 'canceled' || event.error === 'interrupted') return;
      currentUtterance = null;
      state = 'idle';
      queue = [];
      clearHighlight();
      currentSection.textContent = 'Playback stopped';
      status.textContent = 'The browser could not play this speech. Try another voice or press Play to try again.';
      renderState();
    };

    try {
      synthesis.speak(utterance);
    } catch {
      state = 'idle';
      queue = [];
      clearHighlight();
      currentSection.textContent = 'Playback unavailable';
      status.textContent = 'The browser could not start speech playback. Please try again.';
      renderState();
    }
  }

  function finish() {
    state = 'idle';
    queue = [];
    currentUtterance = null;
    needsRestart = false;
    clearHighlight();
    currentSection.textContent = 'Lesson finished';
    status.textContent = 'You have reached the end of this lesson. Press Play to listen again.';
    renderState();
  }

  function play() {
    if (destroyed || state !== 'idle') return;
    queue = visibleTeachingItems(content, title);
    if (!queue.length) {
      status.textContent = 'There is no visible lesson text to read yet.';
      return;
    }
    playbackToken += 1;
    synthesis.cancel();
    itemIndex = 0;
    chunkIndex = 0;
    needsRestart = false;
    state = 'speaking';
    renderState();
    speakCurrent();
  }

  function pause() {
    if (destroyed || state !== 'speaking') return;
    synthesis.pause();
    state = 'paused';
    status.textContent = 'Reading paused. Press Resume to continue.';
    renderState();
  }

  function resume() {
    if (destroyed || state !== 'paused') return;
    state = 'speaking';
    renderState();
    if (needsRestart) {
      needsRestart = false;
      speakCurrent();
    } else {
      synthesis.resume();
      status.textContent = 'Reading ' + (queue[itemIndex]?.section || 'lesson') + '…';
    }
  }

  function stop() {
    if (destroyed) return;
    playbackToken += 1;
    synthesis.cancel();
    state = 'idle';
    queue = [];
    itemIndex = 0;
    chunkIndex = 0;
    currentUtterance = null;
    needsRestart = false;
    clearHighlight();
    currentSection.textContent = 'Nothing is playing';
    status.textContent = 'Reading stopped. Press Play to start again.';
    renderState();
  }

  function restartCurrentChunk() {
    if (state !== 'speaking' && state !== 'paused') return;
    const wasSpeaking = state === 'speaking';
    playbackToken += 1;
    synthesis.cancel();
    currentUtterance = null;
    needsRestart = true;
    status.textContent = 'Playback settings changed.';
    if (wasSpeaking) {
      state = 'speaking';
      needsRestart = false;
      speakCurrent();
    }
  }

  function onRateChange() {
    restartCurrentChunk();
  }

  function onVoiceChange() {
    const index = Number(voiceSelect.value);
    selectedVoice = Number.isInteger(index) && index >= 0 ? voices[index] || null : null;
    restartCurrentChunk();
  }

  function onVoicesChanged() {
    refreshVoices();
  }

  function onPageHide() {
    stop();
  }

  refreshVoices();
  synthesis.addEventListener?.('voiceschanged', onVoicesChanged);
  window.addEventListener('pagehide', onPageHide);

  return {
    el: card,
    cleanup() {
      if (destroyed) return;
      destroyed = true;
      playbackToken += 1;
      synthesis.cancel();
      synthesis.removeEventListener?.('voiceschanged', onVoicesChanged);
      window.removeEventListener('pagehide', onPageHide);
      clearHighlight();
      queue = [];
      currentUtterance = null;
    },
  };
}
