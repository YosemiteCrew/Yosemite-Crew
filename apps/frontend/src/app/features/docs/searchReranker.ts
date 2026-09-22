import 'server-only';
import { createHash } from 'node:crypto';
import { score, TypeSafeClient } from '@typesafe-ai/sdk';
import { buildSearchIndex } from './searchIndex';
import { retrieveJudgmentCandidates } from './searchRanking';

const JUDGMENT_TIMEOUT_MS = 800;
const CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_CACHE_ENTRIES = 256;
const MAX_CANDIDATE_JUDGMENTS_PER_MINUTE = 500;
const LEVELS = [
  'answers it directly',
  'covers it as part of a larger topic',
  'mentions it in passing',
  'does not cover it',
] as const;

interface CachedOrder {
  expiresAt: number;
  order: string[];
}

let index: ReturnType<typeof buildSearchIndex> | null = null;
let indexHash: string | null = null;
// ponytail: warm-process cache and budget; shared storage if fleet-wide hit rates or quotas require it.
const cache = new Map<string, CachedOrder>();
let budgetWindowStartedAt = 0;
let judgedCandidatesThisWindow = 0;

const loadIndex = () => {
  if (!index) {
    index = buildSearchIndex();
    indexHash = createHash('sha256').update(JSON.stringify(index)).digest('hex');
  }
  return { docs: index, hash: indexHash };
};

const getCachedOrder = (key: string, now: number): string[] | null => {
  const cached = cache.get(key);
  if (!cached) return null;
  if (cached.expiresAt <= now) {
    cache.delete(key);
    return null;
  }
  return cached.order;
};

const rememberOrder = (key: string, order: string[], now: number): void => {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey !== undefined) cache.delete(oldestKey);
  }
  cache.set(key, { order, expiresAt: now + CACHE_TTL_MS });
};

const withinCandidateBudget = (count: number, now: number): boolean => {
  if (now - budgetWindowStartedAt >= 60_000) {
    budgetWindowStartedAt = now;
    judgedCandidatesThisWindow = 0;
  }
  if (judgedCandidatesThisWindow + count > MAX_CANDIDATE_JUDGMENTS_PER_MINUTE) return false;
  judgedCandidatesThisWindow += count;
  return true;
};

const mostLikelyLevel = (probabilities: unknown): number | null => {
  if (typeof probabilities !== 'object' || probabilities === null || Array.isArray(probabilities)) {
    return null;
  }
  const values = LEVELS.map(
    (_, index) => (probabilities as Record<string, unknown>)[String(index)]
  );
  if (
    values.some(
      (value) => typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 1
    )
  ) {
    return null;
  }
  return LEVELS.reduce(
    (best, _level, index) => ((values[index] as number) > (values[best] as number) ? index : best),
    0
  );
};

/** Returns an ordering only; the caller keeps its deterministic results on every failure. */
export const rerankDocs = async (query: string): Promise<string[] | null> => {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) return null;

  const normalizedQuery = query.trim().toLowerCase().replaceAll(/\s+/g, ' ');
  if (!normalizedQuery) return null;

  try {
    const { docs, hash } = loadIndex();
    const candidates = retrieveJudgmentCandidates(docs, normalizedQuery);
    if (!candidates.length) return null;

    const now = Date.now();
    const cacheKey = `${hash}:${normalizedQuery}`;
    const cached = getCachedOrder(cacheKey, now);
    if (cached) return cached;
    if (!withinCandidateBudget(candidates.length, now)) return null;

    const questions = Object.fromEntries(
      candidates.map((_, candidateIndex) => [
        `candidate_${candidateIndex}`,
        score(
          `Does the documentation page in candidates[${candidateIndex}] answer the search query in query?`,
          LEVELS
        ),
      ])
    );
    const state = {
      query: normalizedQuery,
      candidates: candidates.map(({ title, section, text }) => ({
        title,
        section,
        text: text.slice(0, 300),
      })),
    };
    const client = new TypeSafeClient({
      apiKey,
      timeout: JUDGMENT_TIMEOUT_MS,
      retry: { maxRetries: 0 },
      logLevel: 'off',
    });
    const response = await client.systemOne(
      { state, questions },
      { timeout: JUDGMENT_TIMEOUT_MS, retry: { maxRetries: 0 } }
    );

    const judgments = candidates.map((candidate, candidateIndex) => ({
      candidate,
      level: mostLikelyLevel(
        response.answers[`candidate_${candidateIndex}` as keyof typeof response.answers]
          .probabilities
      ),
    }));
    const validJudgments = judgments.filter(
      (judgment): judgment is { candidate: (typeof candidates)[number]; level: number } =>
        judgment.level !== null
    );
    if (validJudgments.length !== judgments.length) return null;

    const judged = validJudgments
      .filter(({ level }) => level <= 1)
      .sort(
        (a, b) =>
          a.level - b.level ||
          b.candidate.score - a.candidate.score ||
          a.candidate.title.localeCompare(b.candidate.title)
      )
      .map(({ candidate }) => candidate.href);

    rememberOrder(cacheKey, judged, now);
    return judged;
  } catch {
    return null;
  }
};
