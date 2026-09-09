# Contributing

Thank you for considering a contribution. Please open an issue or pull request
that explains the behavior change, includes focused synthetic tests, and keeps
the public API small.

## Local checks

Use Node.js 20 or newer:

```bash
npm ci
npm test
npm run build
node examples/porto-guides.mjs
```

Changes to ranking behavior should state the effect on normalization, matching,
score ordering, clocks, or tie-breaking. Avoid adding Gale Finance documents,
provider data, credentials, internal routes, or operational configuration.

By submitting a contribution, you confirm that you have the right to submit it
under the [Apache-2.0 License](LICENSE).
