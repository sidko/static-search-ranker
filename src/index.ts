/**
 * A small, dependency-free ranker for static search indexes.
 *
 * The default normalization intentionally uses an ASCII-oriented token model:
 * it folds combining marks, lowercases text, turns `&` into `and`, and keeps
 * letters, digits, and `$`. It does not provide stemming, fuzzy matching, or
 * full locale-aware collation.
 */
export const normalizeText = (value: string): string => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9$]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

export const tokenize = (value: string): string[] => normalizeText(value)
  .split(' ')
  .filter(Boolean);

export type SearchFieldValue = string | readonly string[] | null | undefined;

export type FieldWeights = Readonly<{
  exact: number;
  prefix: number;
  token: number;
  includes: number;
}>;

export type PhraseWeights = Readonly<{
  /** Points when the whole normalized query equals the field. */
  exact: number;
  /** Points when the whole normalized query occurs in the field. */
  includes: number;
}>;

export type SearchField<T> = Readonly<{
  /** A field name for diagnostics and policy readability. */
  name: string;
  /** Returns text to index for one document. Arrays are joined with spaces. */
  getValue: (document: T) => SearchFieldValue;
  /** Per-term match points. Omit a field to make it filter-only. */
  weights?: FieldWeights;
  /** Whole-query match points, applied once per field. */
  phraseWeights?: PhraseWeights;
}>;

export type RecencyBand = Readonly<{
  /** Inclusive maximum age in milliseconds. Bands are checked from smallest to largest. */
  maxAgeMs: number;
  score: number;
}>;

export type RecencyPolicy<T> = Readonly<{
  getTimestamp: (document: T) => number | null | undefined;
  bands: readonly RecencyBand[];
}>;

export type RankContext<T> = Readonly<{
  query: string;
  normalizedQuery: string;
  rawTerms: readonly string[];
  terms: readonly string[];
  mandatoryTerms: readonly string[];
  /** Milliseconds since the Unix epoch, supplied by the caller. */
  now: number;
  fields: ReadonlyMap<string, string>;
  document: T;
}>;

export type RankComparisonContext = Readonly<{
  query: string;
  normalizedQuery: string;
  rawTerms: readonly string[];
  terms: readonly string[];
  mandatoryTerms: readonly string[];
  now: number;
}>;

export type RankerPolicy<T> = Readonly<{
  fields: readonly SearchField<T>[];
  /** Defaults to the module's documented ASCII-oriented normalization. */
  normalize?: (value: string) => string;
  /** Terms removed before matching and scoring. */
  stopwords?: Iterable<string>;
  /** Require every remaining query term to appear at a token boundary. Default: true. */
  requireAllTerms?: boolean;
  /**
   * Whether a one-character term participates in the mandatory token gate.
   * Multi-character terms are always mandatory when requireAllTerms is true.
   * Default: `all`.
   */
  singleCharacterTermPolicy?: 'all' | 'alphanumeric';
  /** Allow substring scoring only at or above this term length. Default: 4. */
  minimumSubstringLength?: number;
  /** Exclude a document before it receives a score. */
  filter?: (context: RankContext<T>) => boolean;
  /** Declarative recency scoring using the same injected clock as this rank call. */
  recency?: RecencyPolicy<T>;
  /** Add domain-specific points, such as recency, from an explicit clock. */
  boost?: (context: RankContext<T>) => number;
  /**
   * A stable key used after score. Finite numeric keys sort before string keys;
   * each type then sorts ascending (numbers numerically, strings by code unit).
   * Non-finite numbers are treated as strings. No comparison uses locale state.
   */
  tieBreaker?: (document: T) => string | number;
  /**
   * Called only after score ties. It can preserve an existing application order;
   * return 0 to continue with tieBreaker and finally input order.
   */
  compare?: (left: Ranked<T>, right: Ranked<T>, context: RankComparisonContext) => number;
}>;

export type RankOptions = Readonly<{
  limit?: number;
  /** Required for time-based policies; defaults to 0 for deterministic ranking. */
  now?: Date | number;
}>;

export type Ranked<T> = Readonly<{
  document: T;
  score: number;
}>;

type TieBreaker = Readonly<
  | { kind: 'number'; value: number }
  | { kind: 'string'; value: string }
>;

type IndexedRanked<T> = Ranked<T> & Readonly<{ index: number; tieBreaker: TieBreaker }>;

const asTimestamp = (value: Date | number | undefined): number => {
  if (value === undefined) return 0;
  const timestamp = typeof value === 'number' ? value : value.getTime();
  if (!Number.isFinite(timestamp)) throw new TypeError('options.now must be a finite Date or number.');
  return timestamp;
};

const normalizeFieldValue = (value: SearchFieldValue, normalize: (value: string) => string): string => {
  if (typeof value !== 'string' && value != null) return normalize(Array.from(value).join(' '));
  return normalize(value ?? '');
};

const matchesTokenPrefix = (field: string, term: string): boolean => (
  field === term || field.startsWith(`${term} `) || field.includes(` ${term}`)
);

const scoreField = (field: string, term: string, weights: FieldWeights, minimumSubstringLength: number): number => {
  if (!field) return 0;
  if (field === term) return weights.exact;
  if (field.startsWith(term)) return weights.prefix;
  if (field.includes(` ${term}`)) return weights.token;
  if (term.length >= minimumSubstringLength && field.includes(term)) return weights.includes;
  return 0;
};

/** Score an explicit timestamp against ordered recency bands with an injected clock. */
export const scoreRecency = (
  timestamp: number | null | undefined,
  now: number,
  bands: readonly RecencyBand[],
): number => {
  if (typeof timestamp !== 'number' || !Number.isFinite(timestamp) || !Number.isFinite(now)) return 0;
  const ageMs = Math.max(0, now - timestamp);
  for (const band of [...bands].sort((left, right) => left.maxAgeMs - right.maxAgeMs)) {
    if (!Number.isFinite(band.maxAgeMs) || !Number.isFinite(band.score)) continue;
    if (ageMs <= band.maxAgeMs) return band.score;
  }
  return 0;
};

const compareText = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

const asTieBreaker = (value: string | number): TieBreaker => (
  typeof value === 'number' && Number.isFinite(value)
    ? { kind: 'number', value }
    : { kind: 'string', value: String(value) }
);

const compareTieBreaker = (left: TieBreaker, right: TieBreaker): number => {
  if (left.kind === 'number' && right.kind === 'number') return left.value - right.value;
  if (left.kind !== right.kind) return left.kind === 'number' ? -1 : 1;
  if (left.kind === 'string' && right.kind === 'string') return compareText(left.value, right.value);
  return 0;
};

/**
 * Compare results by descending score, then a caller-supplied stable key, then
 * input order. The final input-order rule makes otherwise identical results
 * deterministic without relying on engine sort stability.
 */
const compareRanked = <T>(
  left: IndexedRanked<T>,
  right: IndexedRanked<T>,
  context: RankComparisonContext,
  compare?: RankerPolicy<T>['compare'],
): number => {
  if (right.score !== left.score) return right.score - left.score;
  const customOrder = compare?.(left, right, context) ?? 0;
  if (customOrder !== 0) return customOrder;
  const byTieBreaker = compareTieBreaker(left.tieBreaker, right.tieBreaker);
  return byTieBreaker || left.index - right.index;
};

/** Rank static documents with a declarative text policy. */
export const rank = <T>(
  documents: readonly T[],
  query: string,
  policy: RankerPolicy<T>,
  options: RankOptions = {},
): Ranked<T>[] => {
  const normalize = policy.normalize ?? normalizeText;
  const normalizedQuery = normalize(query);
  if (!normalizedQuery) return [];

  const rawTerms = normalizedQuery.split(' ').filter(Boolean);
  const stopwords = new Set(Array.from(policy.stopwords ?? [], normalize));
  const terms = rawTerms.filter((term) => !stopwords.has(term));
  if (!terms.length) return [];

  const now = asTimestamp(options.now);
  const minimumSubstringLength = policy.minimumSubstringLength ?? 4;
  const requireAllTerms = policy.requireAllTerms ?? true;
  const mandatoryTerms = policy.singleCharacterTermPolicy === 'alphanumeric'
    ? terms.filter((term) => term.length > 1 || /^[a-z0-9]$/.test(term))
    : terms;
  const limit = options.limit === undefined ? Infinity : Math.max(0, Math.floor(options.limit));
  const comparisonContext: RankComparisonContext = { query, normalizedQuery, rawTerms, terms, mandatoryTerms, now };

  return documents
    .map((document, index): IndexedRanked<T> | null => {
      const fields = new Map(policy.fields.map((field) => [field.name, normalizeFieldValue(field.getValue(document), normalize)]));
      const context: RankContext<T> = { query, normalizedQuery, rawTerms, terms, mandatoryTerms, now, fields, document };
      const allText = Array.from(fields.values()).join(' ');
      if (requireAllTerms && !mandatoryTerms.every((term) => matchesTokenPrefix(allText, term))) return null;
      if (policy.filter && !policy.filter(context)) return null;

      let score = 0;
      for (const field of policy.fields) {
        const phraseWeights = field.phraseWeights;
        const value = fields.get(field.name) ?? '';
        if (phraseWeights && value) {
          score += value === normalizedQuery ? phraseWeights.exact : value.includes(normalizedQuery) ? phraseWeights.includes : 0;
        }
      }
      for (const term of terms) {
        for (const field of policy.fields) {
          if (field.weights) {
            score += scoreField(fields.get(field.name) ?? '', term, field.weights, minimumSubstringLength);
          }
        }
      }
      if (policy.recency) {
        score += scoreRecency(policy.recency.getTimestamp(document), now, policy.recency.bands);
      }
      score += policy.boost?.(context) ?? 0;
      if (!Number.isFinite(score) || score <= 0) return null;

      return {
        document,
        score,
        index,
        tieBreaker: asTieBreaker(policy.tieBreaker?.(document) ?? index),
      };
    })
    .filter((result): result is IndexedRanked<T> => result !== null)
    .sort((left, right) => compareRanked(left, right, comparisonContext, policy.compare))
    .slice(0, limit)
    .map(({ document, score }) => ({ document, score }));
};

/** Bind a policy once when ranking repeated queries against the same schema. */
export const createRanker = <T>(policy: RankerPolicy<T>) => (
  (documents: readonly T[], query: string, options?: RankOptions): Ranked<T>[] => rank(documents, query, policy, options)
);
