import assert from 'node:assert/strict';
import { rank } from 'static-search-ranker';

// Public page metadata, deliberately kept separate from Gale's full search adapter.
const pages = [
  {
    id: 'btc-vs-spy-2021',
    title: 'Bitcoin vs S&P 500 (BTC vs SPY): Returns, Risk & Volatility (2021)',
    url: 'https://www.gale.finance/compare/btc-vs-spy-2021/',
    tickers: ['BTC', 'SPY'],
  },
  {
    id: 'btc-vs-spy',
    title: 'Bitcoin vs S&P 500 (SPY): 2026 Risk & Sharpe Ratio',
    url: 'https://www.gale.finance/compare/btc-vs-spy/',
    tickers: ['BTC', 'SPY'],
  },
  {
    id: 'btc-vs-spy-scorecard',
    title: 'Bitcoin vs S&P 500: 10-Year Performance Scorecard (2016-2025)',
    url: 'https://www.gale.finance/scorecard/btc-vs-spy/',
    tickers: ['BTC', 'SPY'],
  },
  {
    id: 'calculator',
    title: 'What If I Invested $1,000? Compare Bitcoin, Gold, SPY & Ethereum',
    url: 'https://www.gale.finance/calculator/',
    tickers: ['BTC', 'SPY', 'ETH'],
  },
];

const policy = {
  fields: [
    {
      name: 'title',
      getValue: (page) => page.title,
      weights: { exact: 100, prefix: 60, token: 40, includes: 20 },
    },
    {
      name: 'tickers',
      getValue: (page) => page.tickers,
      weights: { exact: 50, prefix: 35, token: 25, includes: 12 },
    },
  ],
  stopwords: ['the', 'and', 'vs'],
  tieBreaker: (page) => page.id,
};

const results = rank(pages, 'btc vs spy', policy, {
  now: Date.parse('2026-01-01T00:00:00Z'),
  limit: 5,
});

assert.deepEqual(results.map(({ document }) => document.id), [
  'btc-vs-spy-2021',
  'btc-vs-spy',
  'calculator',
  'btc-vs-spy-scorecard',
]);
console.log(JSON.stringify(
  results.map(({ document, score }) => ({
    title: document.title,
    url: document.url,
    score,
  })),
  null,
  2,
));
