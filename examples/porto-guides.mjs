import assert from 'node:assert/strict';
import { rank } from 'static-search-ranker';

const guides = [
  {
    id: 'porto',
    title: 'Porto walking guide',
    summary: 'Riverside routes and tiled streets.',
  },
  {
    id: 'cafe',
    title: 'Cafés in Porto',
    summary: 'Coffee and pastries near the river.',
  },
  {
    id: 'portland',
    title: 'Portland guide',
    summary: 'A guide to a different city.',
  },
];

const policy = {
  fields: [
    {
      name: 'title',
      getValue: (guide) => guide.title,
      weights: { exact: 100, prefix: 60, token: 40, includes: 20 },
    },
    {
      name: 'summary',
      getValue: (guide) => guide.summary,
      weights: { exact: 20, prefix: 12, token: 8, includes: 4 },
    },
  ],
  stopwords: ['the', 'and'],
  tieBreaker: (guide) => guide.id,
};

const results = rank(guides, 'porto guide', policy, {
  now: Date.parse('2026-01-01T00:00:00Z'),
  limit: 5,
});

assert.deepEqual(results.map(({ document }) => document.id), ['porto']);
console.log(JSON.stringify(
  results.map(({ document, score }) => ({ id: document.id, title: document.title, score })),
  null,
  2,
));
