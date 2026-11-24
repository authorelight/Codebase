import test from 'node:test';
import assert from 'node:assert/strict';
import { splitSpeechText } from './read-aloud.js';

const normalize = (value) => value.replace(/\s+/g, ' ').trim();

test('splitSpeechText returns no chunks for empty or whitespace-only content', () => {
  assert.deepEqual(splitSpeechText(''), []);
  assert.deepEqual(splitSpeechText('   \n  '), []);
});

test('splitSpeechText preserves every word and punctuation mark', () => {
  const original = 'First, learn the idea. Then run the code! Finally, explain the result?';
  const chunks = splitSpeechText(original);
  assert.equal(normalize(chunks.join(' ')), normalize(original));
});

test('splitSpeechText fallback preserves sentence-ending punctuation', () => {
  const original = Intl.Segmenter;
  try {
    Intl.Segmenter = undefined;
    const text = 'First sentence. "Second sentence!" Is this the third? Yes.';
    const chunks = splitSpeechText(text);
    assert.equal(chunks.join(' '), text);
  } finally {
    Intl.Segmenter = original;
  }
});

test('splitSpeechText divides long prose into manageable chunks', () => {
  const sentence = 'A learner should understand the reason for an instruction before ' +
    'seeing the code. This familiar example explains the purpose of repeating work. ';
  const original = sentence.repeat(14);
  const chunks = splitSpeechText(original);
  assert.ok(chunks.length > 1);
  assert.ok(chunks.every((chunk) => chunk.length <= 520));
  assert.equal(normalize(chunks.join(' ')), normalize(original));
});

test('splitSpeechText does not lose a long word', () => {
  const original = 'A ' + 'x'.repeat(600) + ' follows the explanation.';
  const chunks = splitSpeechText(original);
  assert.equal(normalize(chunks.join(' ')), normalize(original));
});
