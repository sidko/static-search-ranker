import assert from 'node:assert/strict';
import test from 'node:test';
import { matchesTokenPrefix, normalizeText, scoreField } from '../src/primitives.js';

test('normalizes accents, ampersands, punctuation, and whitespace', () => {
  assert.equal(normalizeText('  Café & Tea: $5  '), 'cafe and tea $5');
});

test('matches terms at token boundaries without fuzzy matching', () => {
  assert.equal(matchesTokenPrefix('porto walking guide', 'porto'), true);
  assert.equal(matchesTokenPrefix('portland guide', 'porto'), false);
});

test('scores exact, prefix, token, and long substring matches', () => {
  const weights = { exact: 8, prefix: 6, token: 4, includes: 2 };
  assert.equal(scoreField('porto', 'porto', weights), 8);
  assert.equal(scoreField('porto guide', 'port', weights), 6);
  assert.equal(scoreField('guide to porto', 'porto', weights), 4);
  assert.equal(scoreField('walking-portos', 'port', weights), 2);
});
