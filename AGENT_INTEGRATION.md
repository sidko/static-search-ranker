# Integrating `static-search-ranker`

`static-search-ranker` ranks an in-memory array using fields and a caller-owned
policy. It supports Node.js 20+ and ESM consumers. It does not crawl documents,
choose result URLs, perform authorization, or supply locale-aware search.

## Install and map the policy

```bash
npm install static-search-ranker@<version>
```

This updates the consumer’s `package.json` and lockfile. Keep the consumer’s
existing document creation, routing, locale rules, and product policy local.
Replace a local scoring import with the package import, then express the
previous fields, weights, stopwords, filters, boosts, recency bands, and stable
tie-break rule in a `RankerPolicy`.

```ts
import { rank, type RankerPolicy } from 'static-search-ranker';

const policy: RankerPolicy<Document> = {
  fields: [{ name: 'title', getValue: (document) => document.title, weights }],
  tieBreaker: (document) => document.id,
};

const ranked = rank(documents, query, policy, { now: fixedTimestamp });
```

Pass a fixed `now` whenever the policy has time-based logic. Use a stable,
explicit tie-breaker so equal scores have reproducible ordering. Read the
[README](README.md) for normalization limits before replacing a locale-aware or
fuzzy search implementation.

## Verify

Run the consumer’s relevant type-check and tests. Compare old and new complete
ranked result lists using the same documents, query, clock, and ordering policy.
Use synthetic inputs in public logs and examples. Confirm the installed package
is imported, rather than a copied source file.

For this repository:

```bash
npm ci
npm test
npm run build
node examples/porto-guides.mjs
```

After release, install the registry artifact in a clean consumer and run the
same minimal example.

## Undo a first migration

Restore the prior consumer commit or reintroduce its previous local scoring
implementation, imports, package version, and lockfile together. Reverting only
the package version cannot undo a first extraction if its adapter or policy also
changed. Regenerate any derived search index if the consumer stores one.

## When it does not fit

Stop and report the unsupported requirement when a consumer needs fuzzy search,
stemming, full locale collation, implicit business intent, or an incompatible
normalization rule. Do not paste private documents or credentials into an issue.
Use [SECURITY.md](SECURITY.md) for vulnerability reports.
