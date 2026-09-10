# static-search-ranker

A small, dependency-free TypeScript ranker for static search indexes where the
scoring policy and ordering rules should be visible in code.

**Used in production:** [Gale Finance search](https://www.gale.finance/search/)

![Live Gale Finance search results for “btc vs spy”](https://raw.githubusercontent.com/sidko/static-search-ranker/main/docs/assets/gale-search.jpg)

The image is a captured result from [Gale's live search for “btc vs spy”](https://www.gale.finance/search/?q=btc%20vs%20spy). The small example below is deliberately narrower: it reproduces a transparent ranking policy with a few verified public page titles and URLs.

`static-search-ranker` turns an array of records plus a declarative field policy
into deterministic ranked results. It is useful for a documentation site,
catalog, help center, or other local index that does not need a server search
service.

```bash
npm install static-search-ranker
```

```ts
import { rank, type RankerPolicy } from 'static-search-ranker';

type Page = { id: string; title: string; url: string; tickers: string[] };

const pages: Page[] = [
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

const policy: RankerPolicy<Page> = {
  fields: [
    { name: 'title', getValue: (page) => page.title, weights: { exact: 100, prefix: 60, token: 40, includes: 20 } },
    { name: 'tickers', getValue: (page) => page.tickers, weights: { exact: 50, prefix: 35, token: 25, includes: 12 } },
  ],
  stopwords: ['the', 'and', 'vs'],
  tieBreaker: (page) => page.id,
};

const results = rank(pages, 'btc vs spy', policy, {
  now: Date.parse('2026-01-01T00:00:00Z'),
  limit: 5,
});

console.log(results.map(({ document, score }) => ({ id: document.id, score })));
```

The package exports `rank`, `createRanker`, `normalizeText`, `tokenize`, and
`scoreRecency`, plus its public TypeScript types. See
[the runnable Gale Finance example](https://github.com/sidko/static-search-ranker/blob/main/examples/gale-finance-search.mjs) for the complete
example and its checked output.

The example deliberately uses only four public Gale page titles, URLs, and
tickers. It shows a minimal, illustrative field policy for this package; Gale's production
search adapter also owns document creation, routing, finance-specific intent,
and result presentation.

![Illustrative output from the minimal Gale example](https://raw.githubusercontent.com/sidko/static-search-ranker/main/docs/assets/gale-finance-search-results.svg)

For time-based policies, `scoreRecency(timestamp, now, bands)` assigns the
score from the first matching inclusive age band; invalid timestamps produce
zero. A policy can instead set `recency: { getTimestamp, bands }`, which uses
the single `now` value passed to `rank`. A declarative `recency` policy requires
an explicit `options.now`; without it `rank` throws rather than silently using
the Unix epoch. Policies without declarative recency retain the deterministic
default clock value of `0`.

## Why use it

- **Policy is explicit.** Fields, weights, stopwords, filters, boosts, recency
  bands, and tie-breaking live in a plain object.
- **Ordering is predictable.** Supply a stable tie-breaker; results do not rely
  on runtime locale collation or an implicit current clock.
- **Small and local.** The package has no runtime dependencies and ranks the
  documents already in memory.

## Behavior and limits

The default normalizer folds combining marks, lowercases text, changes `&` to
`and`, and uses an ASCII-oriented token model. It is not a stemming, fuzzy,
synonym, or full locale-aware search engine. Provide a custom normalizer or
search service when those semantics are required.

Search quality depends on the policy and the indexed text you supply. A
`RankerPolicy` is intentionally application-owned: this package does not infer
business intent, routing, permissions, or result presentation. Pass `now` when
using time-based ranking so the result can be reproduced in tests.

Field names must be unique within a policy. `stopwords` accepts only a reusable
readonly string array or `ReadonlySet<string>`; strings and one-shot iterables
such as generators are rejected so repeated calls produce the same policy.

The initial release supports Node.js 20 or newer and ESM consumers. Browser
bundlers that support standard ESM can use the package; its source does not
access browser globals.

## Development

```bash
npm ci
npm test
npm run build
node examples/gale-finance-search.mjs
```

The example imports the built package, so it exercises the published export
shape rather than a sibling source file. CI also packs the distribution and
runs that same example from a clean install.

## Origin and history

Gale Finance uses `static-search-ranker@0.1.0` for the ranking layer behind its
[site search](https://www.gale.finance/search/). Gale-specific search documents,
routing, locale handling, finance intent rules, and content remain in Gale.

Early commits reconstruct a milestone developed in the private Gale Finance
monorepo. Author dates reflect the original work; public content and hashes were
rewritten to exclude private details. Some early development used Claude as a
coding assistant; Sid Kalla selected, reviewed and maintains this code.

The Apache-2.0 license covers this code. It does not grant rights to Gale
Finance’s logos or visual identity.

## Contributing and security

Contributions are welcome under Apache-2.0; see
[CONTRIBUTING.md](https://github.com/sidko/static-search-ranker/blob/main/CONTRIBUTING.md).
Please report vulnerabilities privately as described in
[SECURITY.md](https://github.com/sidko/static-search-ranker/blob/main/SECURITY.md).
For adoption notes, including an integration and rollback recipe, see
[AGENT_INTEGRATION.md](https://github.com/sidko/static-search-ranker/blob/main/AGENT_INTEGRATION.md).

Maintenance is best effort. The latest released version is supported unless a
release note says otherwise.
