// Typed judgments for the rows the deterministic ladder in classify.mjs has
// already given up on.
//
// Why this exists:
//
// classifyCategory returns `{ category: null }` for any issue whose title has no
// conventional-commit scope, whose labels name no surface, and whose body names
// no workspace path. sync.mjs then publishes that issue on a PUBLIC board with an
// empty Category cell. classifyPriority returns null for the same kind of issue.
// Both nulls are correct - an empty cell a human can see beats a wrong cell
// nobody checks - but they are also the board's largest category of nothing.
//
// This module asks a typed question about exactly those rows and nothing else.
// It cannot reach an issue the ladder judged, so a human's label, a scope, an
// affected area and the path evidence all keep their existing precedence
// untouched. If it is unconfigured, times out, or errors, the ladder's null
// stands and the board behaves exactly as it does today.
//
// Shape borrowed from packages/agent-runtime (#3049): the transport is injected
// and the credential is a lazy resolver, so nothing here needs a network or a
// paid key to be tested, and a credential is never held on a config object where
// it could be captured in a log line by being in scope. It does NOT route
// through AgentRuntime itself: this is one stateless request with no tools, no
// run identity and no checkpoint, and the roadmap workflow deliberately installs
// no dependencies and builds nothing - it runs `node` against these .mjs files
// directly, on every issue event.

import { env } from 'node:process';
import { readFileSync, writeFileSync } from 'node:fs';
import {
  CATEGORIES,
  PRIORITIES,
  classifyCategory,
  classifyPriority,
  isRepoWideToolchain,
} from './classify.mjs';

// Re-exported so the skip rule and the ladder step it is named after stay one
// regex, in classify.mjs, with one owner.
export { isRepoWideToolchain };

// TypeSafe System One. One request carries both questions; independent questions
// over the same state are answered in parallel server-side.
export const JUDGMENT_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';
export const JUDGMENT_MODEL = 'jev-latest';

// The whole request, not per question. The two questions are independent and are
// evaluated in parallel, so they do not cost 1.5s each.
export const DEFAULT_TIMEOUT_MS = 1500;

// How concentrated the answer's probability distribution must be before anything
// is written to a public board. UNVALIDATED: the acceptance measurement on issue
// #3376 is what sets this number. Until it has run, treat the default as a
// placeholder chosen to be conservative rather than as a tuned value.
export const DEFAULT_MIN_CONFIDENCE = 0.5;

// Only ever this many characters of the body are sent. An earlier comparison on
// 45 issues found longer bodies changed the answer very little at materially
// higher token cost; the cut is pinned by a test so the next measurement can
// overturn it deliberately rather than by drift.
export const BODY_LIMIT = 500;

export const QUESTION_CATEGORY = 'category';
export const QUESTION_URGENCY = 'urgency';

// Dependabot's own label plus the ecosystem defaults it applies here. See the
// note at the top of .github/dependabot.yml: security updates arrive with the
// ecosystem label rather than this file's `dependencies` label, so listing only
// `dependencies` would leave the larger half of the dependency traffic eligible
// for an urgency judgment.
const DEPENDABOT_LABELS = ['dependencies', 'javascript', 'github_actions', 'ruby'];

// Ordered LOWEST harm first, because that is the order the score primitive reads:
// the first entry is level 0 and the last is the maximum. The issue lists them
// strongest first; this is the same ladder reversed, not a different one.
export const URGENCY_LEVELS = [
  'No user impact at all. Internal notes, tracking issues, or work nobody using the product could notice.',
  'Cosmetic or internal only. Wording, spacing, colour, refactoring, tooling or test changes that leave every clinical and billing flow working exactly as before.',
  'A visible defect with a workaround. Something is wrong and a practice can see it, but there is another way to complete the task today.',
  'Degrades a core clinical or billing flow. Appointments, clinical records, prescriptions, invoicing or payments still work but are slower, lossy, or wrong in a way staff must correct by hand.',
  'Blocks a practice from working. Staff cannot complete a core task at all, or data they entered is lost.',
];

// Level index -> published priority. The top two levels are Urgent, the middle is
// High, and everything below is Normal. Nothing here can produce Low: Low is a
// statement that work is deliberately deferred, which is a decision rather than a
// judgment about harm, and `future-scope` already carries it in the ladder.
export const URGENCY_PRIORITY_BY_LEVEL = [
  PRIORITIES.NORMAL,
  PRIORITIES.NORMAL,
  PRIORITIES.HIGH,
  PRIORITIES.URGENT,
  PRIORITIES.URGENT,
];

const CATEGORY_CRITERIA = {
  [CATEGORIES.MOBILE]:
    'The React Native companion app that pet owners install on a phone or tablet.',
  [CATEGORIES.PMS]:
    'The web practice management system veterinary staff use in the clinic: appointments, clinical records, inventory, invoicing.',
  [CATEGORIES.DESKTOP]: 'The Electron desktop build of the practice management system.',
  [CATEGORIES.DEVPLATFORM]:
    'Interfaces other people build against: the developer portal, API keys, metered billing, MCP, federation and the public data API.',
  [CATEGORIES.SUPERADMIN]:
    'The internal Super Admin console used to administer practices, not to run one.',
  [CATEGORIES.PLATFORM]:
    'Cross-cutting engineering with no single product surface: the backend service, CI, the toolchain, dependencies, runtime upgrades, infrastructure and repo-wide performance or security sweeps.',
  [CATEGORIES.GROWTH]: 'Marketing, sales, pricing pages and campaigns rather than product code.',
  [CATEGORIES.SPIKE]:
    'A time-boxed investigation whose deliverable is a decision or a written finding, not shipped behaviour.',
};

const CATEGORY_VALUES = new Set(Object.values(CATEGORIES));

/**
 * Everything that is ever sent off this machine about an issue.
 *
 * The board is public but the issue bodies still belong to the people who wrote
 * them, so the payload is built by an allowlist rather than by deleting fields
 * from the GitHub node: a field added to the query later cannot leak by being
 * forgotten here. Asserted field-by-field in judgment.test.mjs.
 */
export function judgmentPayload({ title = '', body = '', labels = [] } = {}) {
  return {
    title: String(title),
    labels: (labels || []).map((l) => String(l)),
    body: String(body || '').slice(0, BODY_LIMIT),
  };
}

/**
 * The urgency judgment is skipped in CODE, before any request is made, for the
 * two classes that are known to over-escalate: a chore or dependency bump reads
 * to any classifier like whatever it happens to touch, and there are a lot of
 * them. Category is NOT skipped for these - the ladder already sends repo-wide
 * toolchain work to Platform & Infra, so the judgment never sees it anyway.
 */
export function skipUrgencyJudgment({ title = '', labels = [] } = {}) {
  if (isRepoWideToolchain(title)) return 'repo-wide toolchain title';
  const lower = (labels || []).map((l) => String(l).toLowerCase());
  const hit = DEPENDABOT_LABELS.find((l) => lower.includes(l));
  return hit ? `dependency label: ${hit}` : null;
}

/** Cache identity for one issue. `updated_at` moves on every edit, label change
 *  and comment, which is exactly when a judgment could differ. */
export function judgmentCacheKey({ number, updatedAt }) {
  return `${number}@${updatedAt}`;
}

function buildQuestions({ askCategory, askUrgency }) {
  const questions = {};
  if (askCategory) {
    questions[QUESTION_CATEGORY] = {
      type: 'choice',
      instructions:
        'This is an issue in the tracker for Yosemite Crew, an open-source veterinary practice management product. Which product surface does the work described here land in? Judge where the change would be made, not which surface happens to be mentioned.',
      criteria: CATEGORY_CRITERIA,
    };
  }
  if (askUrgency) {
    questions[QUESTION_URGENCY] = {
      type: 'score',
      instructions:
        'This is an issue in the tracker for Yosemite Crew, a veterinary practice management product used by working clinics. How much does the situation described here hurt a practice using the product today? Judge the harm described, not how urgently the author writes.',
      criteria: URGENCY_LEVELS,
    };
  }
  return questions;
}

/** Read a `choice` answer, refusing anything outside the eight board options. A
 *  category that is not a board option would be dropped by sync.mjs as a skipped
 *  write and fail the whole run, so it is rejected here instead. */
function readCategory(answer, minConfidence) {
  if (!answer || typeof answer.choice !== 'string') return null;
  if (!CATEGORY_VALUES.has(answer.choice)) return null;
  if (!(Number(answer.confidence) >= minConfidence)) return null;
  return answer.choice;
}

/** Read a `score` answer. The score is a probability-weighted position that can
 *  land between two levels, so it is rounded to the nearest level before the
 *  mapping - taking the floor would round every answer down towards Normal. */
function readUrgency(answer, minConfidence) {
  const score = Number(answer?.score);
  if (!Number.isFinite(score)) return null;
  if (!(Number(answer.confidence) >= minConfidence)) return null;
  const level = Math.round(score);
  if (level < 0 || level >= URGENCY_PRIORITY_BY_LEVEL.length) return null;
  return URGENCY_PRIORITY_BY_LEVEL[level];
}

/**
 * Build the judgment client, or return null when it is not configured.
 *
 * Returning null rather than a throwing stub is the whole fail-open contract:
 * sync.mjs holds `judge` and simply does not call it, so an unconfigured run
 * makes exactly the board writes dev makes today.
 *
 * @param {object} options
 * @param {() => Promise<string>|string} [options.credential] resolver, not a value
 * @param {(req) => Promise<object>} [options.transport] injected for tests
 * @param {{get:Function,set:Function}} [options.store] cache store
 */
export function createJudgmentClient({
  credential,
  transport,
  store = new Map(),
  endpoint = JUDGMENT_ENDPOINT,
  model = JUDGMENT_MODEL,
  timeoutMs = DEFAULT_TIMEOUT_MS,
  minConfidence = DEFAULT_MIN_CONFIDENCE,
  now = () => Date.now(),
} = {}) {
  if (!credential && !transport) return null;

  const send = transport || defaultTransport(endpoint);
  const stats = {
    calls: 0,
    errors: 0,
    cacheHits: 0,
    inputTokens: 0,
    outputTokens: 0,
    latencies: [],
  };

  async function judge(issue, { askCategory, askUrgency }) {
    if (!askCategory && !askUrgency) return empty();

    const key = judgmentCacheKey(issue);
    const cached = store.get(key);
    // A cached answer is only usable if it answered the questions being asked.
    // A run that asked for a category alone must not silently satisfy a later
    // urgency question with a `null` it never asked for.
    if (
      cached &&
      (!askCategory || cached.asked.category) &&
      (!askUrgency || cached.asked.urgency)
    ) {
      stats.cacheHits += 1;
      return cached.result;
    }

    const started = now();
    let result;
    try {
      const body = {
        state: judgmentPayload(issue),
        model,
        questions: buildQuestions({ askCategory, askUrgency }),
      };
      const response = await withTimeout(
        // async: the credential resolver runs INSIDE the deadline, so a hanging
        // resolver fails open like any other slow step rather than stalling the
        // whole sync.
        async (signal) =>
          send({
            method: 'POST',
            url: endpoint,
            headers: { authorization: `Bearer ${await resolve(credential)}` },
            body,
            signal,
          }),
        timeoutMs
      );
      const answers = response?.answers || {};
      result = {
        category: askCategory ? readCategory(answers[QUESTION_CATEGORY], minConfidence) : null,
        priority: askUrgency ? readUrgency(answers[QUESTION_URGENCY], minConfidence) : null,
        confidence: {
          category: numberOrNull(answers[QUESTION_CATEGORY]?.confidence),
          urgency: numberOrNull(answers[QUESTION_URGENCY]?.confidence),
        },
        score: numberOrNull(answers[QUESTION_URGENCY]?.score),
        error: null,
      };
      stats.inputTokens += Number(response?.usage?.input_tokens) || 0;
      stats.outputTokens += Number(response?.usage?.output_tokens) || 0;
    } catch (err) {
      // Fail open, always. A judgment that cannot answer leaves the ladder's
      // null in place, which is a cell a human can see.
      stats.errors += 1;
      result = { ...empty(), error: String(err?.message || err) };
    }
    stats.calls += 1;
    stats.latencies.push(now() - started);
    store.set(key, {
      asked: { category: Boolean(askCategory), urgency: Boolean(askUrgency) },
      result,
    });
    return result;
  }

  judge.stats = () => ({
    calls: stats.calls,
    errors: stats.errors,
    cacheHits: stats.cacheHits,
    inputTokens: stats.inputTokens,
    outputTokens: stats.outputTokens,
    latencyMs: { p50: percentile(stats.latencies, 50), p95: percentile(stats.latencies, 95) },
  });
  return judge;
}

const empty = () => ({
  category: null,
  priority: null,
  confidence: { category: null, urgency: null },
  score: null,
  error: null,
});

const numberOrNull = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

const resolve = async (credential) =>
  typeof credential === 'function' ? await credential() : credential;

/**
 * The deadline that produces the fail-open answer is the race below. The abort
 * signal handed to the transport does a different job: it releases the socket a
 * real `fetch` would otherwise hold until the process exits. Neither substitutes
 * for the other, so both are here and both are exercised in the tests.
 */
function withTimeout(run, timeoutMs) {
  const controller = new AbortController();
  let timer;
  const deadline = new Promise((_, reject) => {
    timer = setTimeout(() => {
      controller.abort();
      reject(new Error(`judgment timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    if (typeof timer.unref === 'function') timer.unref();
  });
  return Promise.race([Promise.resolve(run(controller.signal)), deadline]).finally(() =>
    clearTimeout(timer)
  );
}

function defaultTransport(endpoint) {
  return async ({ headers, body, signal }) => {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { ...headers, 'content-type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });
    // The response text is NOT included in the error. It is an upstream body on
    // a request that carried an Authorization header, and this error string
    // reaches a public Actions log.
    if (!res.ok) throw new Error(`judgment HTTP ${res.status}`);
    return res.json();
  };
}

/** Nearest-rank percentile. Returns null for an empty sample rather than NaN,
 *  so an unconfigured run reports "not measured" instead of a number. */
export function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

/**
 * The ladder, then the judgment on whatever the ladder abandoned.
 *
 * This is the only plug point. classifyCategory and classifyPriority are called
 * first and unchanged, so every existing precedence rule - a human's surface
 * label, a conventional-commit scope, the bug template's affected area, the path
 * argmax - decides before anything is asked, and a judgment can only ever fill a
 * `null`. It lives here rather than in classify.mjs so that module stays what its
 * own header promises: pure, synchronous, and with no network access.
 *
 * `judge` may be null. That is the unconfigured path and it returns exactly the
 * ladder's answers.
 */
export async function classifyWithJudgment(
  issue,
  judge,
  // Which cells the caller can still write. A board cell a human has already
  // filled is never overwritten, so asking about it would send an issue to a
  // third party to produce an answer that is discarded on arrival.
  { wantCategory = true, wantPriority = true } = {}
) {
  const ladderCategory = classifyCategory(issue);
  const ladderPriority = classifyPriority(issue);
  const urgencySkip = skipUrgencyJudgment(issue);

  const askCategory = wantCategory && ladderCategory.category === null;
  const askUrgency = wantPriority && ladderPriority === null && !urgencySkip;

  const base = {
    category: ladderCategory.category,
    categoryReason: ladderCategory.reason,
    priority: ladderPriority,
    priorityReason: ladderPriority ? 'label' : 'no priority-bearing label yet',
    ladder: {
      category: ladderCategory.category,
      categoryReason: ladderCategory.reason,
      priority: ladderPriority,
    },
    judgment: null,
  };

  if (!judge || (!askCategory && !askUrgency)) {
    if (urgencySkip)
      base.priorityReason = `${base.priorityReason} (urgency judgment skipped: ${urgencySkip})`;
    return base;
  }

  const judged = await judge(issue, { askCategory, askUrgency });

  const out = { ...base, judgment: { ...judged, asked: { askCategory, askUrgency }, urgencySkip } };

  if (askCategory && judged.category) {
    out.category = judged.category;
    out.categoryReason = `judgment: ${judged.category} (confidence ${fmt(judged.confidence.category)})`;
  } else if (askCategory) {
    out.categoryReason = `${ladderCategory.reason}; judgment declined${suffix(judged, judged.confidence.category)}`;
  }

  if (askUrgency && judged.priority) {
    out.priority = judged.priority;
    out.priorityReason = `judgment: level ${fmt(judged.score)} (confidence ${fmt(judged.confidence.urgency)})`;
  } else if (askUrgency) {
    out.priorityReason = `no priority-bearing label yet; judgment declined${suffix(judged, judged.confidence.urgency)}`;
  } else if (urgencySkip) {
    out.priorityReason = `${base.priorityReason} (urgency judgment skipped: ${urgencySkip})`;
  }

  return out;
}

const fmt = (n) => (n === null || n === undefined ? 'n/a' : Number(n).toFixed(2));
const suffix = (judged, confidence) =>
  judged.error ? ` (${judged.error})` : ` (confidence ${fmt(confidence)})`;

/**
 * A cache store that survives the process, when ROADMAP_JUDGMENT_CACHE names
 * one. With the variable unset this is a plain in-memory Map and the run
 * behaves exactly as it does with no cache at all.
 *
 * The workflow fires on every issue event and again on a daily cron, so an
 * in-memory Map would re-judge every uncategorised row on the board several
 * times a day for answers that cannot have changed. The key carries the issue's
 * `updated_at`, so a stale entry is unreachable rather than wrong, and the file
 * can be thrown away at any time with no effect beyond cost.
 *
 * A missing or corrupt file is an empty cache, never a failure: the cache is an
 * optimisation and must not be able to fail a sync.
 */
export function createJudgmentCacheStore({ log = () => {} } = {}) {
  // The path is read from the environment HERE rather than taken as an
  // argument. Nothing arrives from a parameter, so there is no caller-supplied
  // component to confine and no guard standing in for one - and Aikido's
  // file-inclusion rule, which reports a read whose path derives from a
  // parameter, has nothing to report. Tests set the variable around the call.
  const path = env.ROADMAP_JUDGMENT_CACHE;
  if (!path) return new Map();

  let entries;
  try {
    entries = new Map(Object.entries(JSON.parse(readFileSync(path, 'utf8'))));
  } catch (err) {
    if (err?.code !== 'ENOENT') log(`judgment cache unreadable, starting empty: ${err.message}`);
    entries = new Map();
  }
  let dirty = false;
  return {
    get: (k) => entries.get(k),
    set: (k, v) => {
      entries.set(k, v);
      dirty = true;
    },
    get size() {
      return entries.size;
    },
    save() {
      if (!dirty) return false;
      try {
        // A failure is deduped for this run and then thrown away. Persisting it
        // would make one outage permanent for every row it touched, because the
        // key only moves when the issue does - so a row nobody edits would stay
        // uncategorised on a public board until somebody touched the issue.
        const durable = [...entries].filter(([, value]) => !value?.result?.error);
        writeFileSync(path, JSON.stringify(Object.fromEntries(durable)));
        return true;
      } catch (err) {
        log(`judgment cache could not be written: ${err.message}`);
        return false;
      }
    },
  };
}
