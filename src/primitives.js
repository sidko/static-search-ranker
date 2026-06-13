/** Normalize text into the ASCII-oriented token representation used for search. */
export const normalizeText = (value) => value
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLowerCase()
  .replace(/&/g, ' and ')
  .replace(/[^a-z0-9$]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** Match an exact token or a token-prefix at a word boundary. */
export const matchesTokenPrefix = (field, term) => (
  field === term || field.startsWith(`${term} `) || field.includes(` ${term}`)
);

/** Score one normalized field against one term. */
export const scoreField = (field, term, weights) => {
  if (!field) return 0;
  if (field === term) return weights.exact;
  if (field.startsWith(term)) return weights.prefix;
  if (field.includes(` ${term}`)) return weights.token;
  if (term.length >= 4 && field.includes(term)) return weights.includes;
  return 0;
};
