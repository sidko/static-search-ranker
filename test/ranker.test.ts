import assert from 'node:assert/strict';
import test from 'node:test';
import { createRanker, normalizeText, rank, type RankerPolicy } from '../src/index.js';

type Article = { id: string; title: string; summary: string; updatedAt?: string };

const policy: RankerPolicy<Article> = {
  fields: [
    { name: 'title', getValue: (article) => article.title, weights: { exact: 100, prefix: 60, token: 40, includes: 20 } },
    { name: 'summary', getValue: (article) => article.summary, weights: { exact: 20, prefix: 12, token: 8, includes: 4 } },
  ],
  stopwords: ['the', 'and'],
  tieBreaker: (article) => article.id,
};

const articles: Article[] = [
  { id: 'alpha', title: 'Cafe in Porto', summary: 'Coffee and pastries.' },
  { id: 'beta', title: 'Porto walking guide', summary: 'A guide to cafés and streets.' },
  { id: 'gamma', title: 'Portland guide', summary: 'A different city.' },
];

test('normalizes accents, ampersands, punctuation, and whitespace', () => {
  assert.equal(normalizeText('  Café & Tea: $5  '), 'cafe and tea $5');
});

test('ranks weighted title matches while rejecting a partial token collision', () => {
  const results = rank(articles, 'cafe porto', policy);
  assert.equal(results[0]?.document.id, 'alpha');
  assert.equal(results.some((result) => result.document.id === 'gamma'), false);
});

test('empty and stopword-only queries have no results', () => {
  assert.deepEqual(rank(articles, '   ', policy), []);
  assert.deepEqual(rank(articles, 'the and', policy), []);
});

test('an alphanumeric single-character policy keeps punctuation terms for boosts but out of mandatory matching', () => {
  const results = rank(articles, '$ cafe', {
    ...policy,
    singleCharacterTermPolicy: 'alphanumeric',
    boost: ({ terms, mandatoryTerms }) => (
      terms.includes('$') && !mandatoryTerms.includes('$') ? 1 : 0
    ),
  });
  assert.equal(results[0]?.document.id, 'alpha');
});

test('ties use the explicit code-unit key instead of runtime locale collation', () => {
  const results = rank([
    { id: 'z', title: 'Map', summary: '' },
    { id: 'a', title: 'Map', summary: '' },
  ], 'map', policy);
  assert.deepEqual(results.map((result) => result.document.id), ['a', 'z']);
});

test('the default numeric index tie breaker preserves input order after ten results', () => {
  const results = rank(
    Array.from({ length: 12 }, (_, index) => ({ id: String(index), title: 'Map', summary: '' })),
    'map',
    { ...policy, tieBreaker: undefined },
  );
  assert.deepEqual(results.map((result) => result.document.id), Array.from({ length: 12 }, (_, index) => String(index)));
});

test('mixed tie keys have a total deterministic order independent of input order', () => {
  const mixed = [
    { id: 'string-fifteen', title: 'Map', summary: '', key: '15' },
    { id: 'number-ten', title: 'Map', summary: '', key: 10 },
    { id: 'string-zero-five', title: 'Map', summary: '', key: '05' },
    { id: 'number-two', title: 'Map', summary: '', key: 2 },
    { id: 'not-a-number', title: 'Map', summary: '', key: Number.NaN },
  ];
  const mixedPolicy = { ...policy, tieBreaker: (article: typeof mixed[number]) => article.key };
  const expected = ['number-two', 'number-ten', 'string-zero-five', 'string-fifteen', 'not-a-number'];
  assert.deepEqual(rank(mixed, 'map', mixedPolicy).map((result) => result.document.id), expected);
  assert.deepEqual(rank([...mixed].reverse(), 'map', mixedPolicy).map((result) => result.document.id), expected);
});

test('phrase weights score a whole-query title match once', () => {
  const results = rank([
    { id: 'phrase', title: 'Porto guide', summary: '' },
    { id: 'terms', title: 'Guide to Porto', summary: '' },
  ], 'porto guide', {
    ...policy,
    fields: [{
      name: 'title',
      getValue: (article) => article.title,
      weights: { exact: 10, prefix: 10, token: 10, includes: 0 },
      phraseWeights: { exact: 100, includes: 50 },
    }],
  });
  assert.equal(results[0]?.document.id, 'phrase');
  assert.ok((results[0]?.score ?? 0) > (results[1]?.score ?? 0));
});

test('a policy receives an injected clock for deterministic recency boosts', () => {
  const recentPolicy: RankerPolicy<Article> = {
    ...policy,
    boost: ({ document, now }) => Date.parse(document.updatedAt ?? '1970-01-01T00:00:00Z') >= now - 86_400_000 ? 10 : 1,
  };
  const results = rank([
    { id: 'old', title: 'Map', summary: '', updatedAt: '2020-01-01T00:00:00Z' },
    { id: 'new', title: 'Map', summary: '', updatedAt: '2020-01-02T00:00:00Z' },
  ], 'map', recentPolicy, { now: new Date('2020-01-03T00:00:00Z') });
  assert.deepEqual(results.map((result) => result.document.id), ['new', 'old']);
});

test('declarative recency bands share the rank call clock and include their boundary', () => {
  const results = rank([
    { id: 'old', title: 'Map', summary: '', updatedAt: '2020-01-01T00:00:00Z' },
    { id: 'edge', title: 'Map', summary: '', updatedAt: '2020-01-02T00:00:00Z' },
  ], 'map', {
    ...policy,
    recency: {
      getTimestamp: (article) => Date.parse(article.updatedAt ?? ''),
      bands: [{ maxAgeMs: 86_400_000, score: 10 }, { maxAgeMs: 365 * 86_400_000, score: 1 }],
    },
  }, { now: Date.parse('2020-01-03T00:00:00Z') });
  assert.deepEqual(results.map((result) => result.document.id), ['edge', 'old']);
});

test('a custom tie comparator can retain an application-specific tie policy', () => {
  const results = rank([
    { id: 'z', title: 'Map', summary: '' },
    { id: 'a', title: 'Map', summary: '' },
  ], 'map', {
    ...policy,
    tieBreaker: undefined,
    compare: (left, right) => left.document.id.localeCompare(right.document.id),
  });
  assert.deepEqual(results.map((result) => result.document.id), ['a', 'z']);
});

test('createRanker preserves policy and applies limits', () => {
  const search = createRanker(policy);
  assert.equal(search(articles, 'porto', { limit: 1 })[0]?.document.id, 'beta');
});
