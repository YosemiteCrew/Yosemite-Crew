import type { SearchDoc } from './searchIndex';

const MAX_CANDIDATES = 25;

export interface RankedSearchDoc extends SearchDoc {
  score: number;
}

const termsFor = (query: string): string[] => query.toLowerCase().split(/\s+/).filter(Boolean);

const scoreTerms = (doc: SearchDoc, terms: string[], requireAll: boolean): number | null => {
  const title = doc.title.toLowerCase();
  const text = doc.text.toLowerCase();
  let score = 0;
  let matched = 0;

  for (const term of terms) {
    if (title.includes(term)) {
      score += 10;
      matched += 1;
    } else if (text.includes(term)) {
      score += 1;
      matched += 1;
    } else if (requireAll) {
      return null;
    }
  }

  return matched ? score : null;
};

const rankByScore = (docs: SearchDoc[], terms: string[], requireAll: boolean): RankedSearchDoc[] =>
  docs
    .map((doc) => {
      const score = scoreTerms(doc, terms, requireAll);
      return score === null ? null : { ...doc, score };
    })
    .filter((doc): doc is RankedSearchDoc => doc !== null)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

/** Today's all-term result, retained unchanged for the instant and fail-open UI. */
export const rankStrictMatches = (docs: SearchDoc[], query: string): RankedSearchDoc[] => {
  const terms = termsFor(query);
  return terms.length ? rankByScore(docs, terms, true) : [];
};

/** Candidate retrieval for the server judgment: strict first, OR only below three hits. */
export const retrieveJudgmentCandidates = (docs: SearchDoc[], query: string): RankedSearchDoc[] => {
  const strict = rankStrictMatches(docs, query);
  if (strict.length >= 3) return strict.slice(0, MAX_CANDIDATES);

  const terms = termsFor(query);
  return terms.length ? rankByScore(docs, terms, false).slice(0, MAX_CANDIDATES) : [];
};
