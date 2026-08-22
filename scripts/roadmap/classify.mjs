// Decide where an issue belongs on the public roadmap board, from evidence that
// already exists on the issue.
//
// Why this exists:
//
// The org roadmap (https://github.com/orgs/YosemiteCrew/projects/6) rotted into
// an archive. On 2026-08-22 it held 388 items of which 387 were already closed,
// the newest of those closed on 2026-07-14, and exactly one of the 79 open issues
// was on the board at all. A board that only lists finished work is worse than no
// board: it is a public page promising "upcoming launches" that shows none.
//
// The fix is to stop hand-curating it. Everything here is derived from the issue,
// so the board cannot drift from the tracker again. Classification lives in its
// own module, with no network access, so it can be unit tested - the sync engine
// in sync.mjs is then a thin, boring transport around these decisions.
//
// Precedence rule: PRODUCT SURFACE WINS. A chore scoped to the mobile app is
// still Mobile App work to a reader of the roadmap; only genuinely cross-cutting
// work (runtime, CI, dependency and performance sweeps that span every app) falls
// through to Platform & Infra. Sorting maintenance into an infra bucket is what
// makes roadmaps read as though no product work is happening.

// Category option names. These must match the single-select options on the board;
// sync.mjs resolves them by name and refuses to run if one is missing, so a
// rename here fails loudly instead of silently dropping items into no column.
export const CATEGORIES = {
  MOBILE: 'Mobile App',
  PMS: 'Web PMS',
  DESKTOP: 'Desktop App',
  DEVPLATFORM: 'Developer Platform',
  SUPERADMIN: 'Super Admin',
  PLATFORM: 'Platform & Infra',
  GROWTH: 'Growth',
  SPIKE: 'Spike',
};

export const STATUSES = {
  NOT_STARTED: 'Not Started',
  IN_PROGRESS: 'In Progress',
  UNDER_TESTING: 'Under Testing',
  COMPLETED: 'Completed',
};

export const PRIORITIES = {
  URGENT: 'Urgent',
  HIGH: 'High',
  NORMAL: 'Normal',
  LOW: 'Low',
};

// The conventional-commit scope in a title, e.g. "fix(mobile): ..." -> "mobile".
// Titles in this repo are commitlint-enforced on PRs and followed by hand on
// issues, so the scope is the single most reliable signal available.
export const scopeOf = (title = '') => {
  const m = /^[a-z]+\(([a-z0-9\-.]+)\)!?:/i.exec(title.trim());
  return m ? m[1].toLowerCase() : null;
};

// The bug template (.github/ISSUE_TEMPLATE/bug_report.yml) asks for an affected
// area in prose, so it is free text rather than a fixed enum. Read it as a hint,
// never as an authority.
export const affectedAreaOf = (body = '') => {
  const m = /###\s*Affected area\s*\r?\n+\s*(.+)/i.exec(body || '');
  return m ? m[1].trim() : null;
};

const has = (labels, name) =>
  (labels || []).some((l) => String(l).toLowerCase() === name.toLowerCase());

// Count workspace path mentions in the body. An issue that names apps/frontend
// four times and apps/backend twice is frontend work with a backend edge, not the
// other way round, and the argmax says so without anyone having to label it.
const pathEvidence = (body = '') => {
  const b = body || '';
  const count = (re) => (b.match(re) || []).length;
  return {
    [CATEGORIES.MOBILE]: count(/apps\/mobileAppYC|react-native|Podfile|\bios\/|\bandroid\//gi),
    [CATEGORIES.PMS]: count(/apps\/frontend/g),
    [CATEGORIES.DESKTOP]: count(/apps\/desktop/g),
    [CATEGORIES.SUPERADMIN]: count(/superadmin/gi),
    [CATEGORIES.PLATFORM]: count(/apps\/backend/g),
  };
};

/**
 * Decide a category, and say why.
 *
 * Returns { category, reason }. category is null when nothing in the issue
 * justifies a guess - sync.mjs leaves those uncategorised and reports them, on
 * the principle that an empty cell a human can see beats a wrong cell nobody
 * checks.
 */
export function classifyCategory({ title = '', body = '', labels = [] } = {}) {
  const scope = scopeOf(title);
  const area = (affectedAreaOf(body) || '').toLowerCase();
  const t = title.toLowerCase();

  // 1. Growth is a different kind of work entirely and is labelled explicitly.
  if (has(labels, 'Marketing') || has(labels, 'Sales')) {
    return { category: CATEGORIES.GROWTH, reason: 'Marketing/Sales label' };
  }

  // 2. Surface labels are a human's explicit statement about which product this
  //    touches. Nothing derived should ever outrank one - an earlier draft let a
  //    keyword match on the body beat the `App` label and filed a companion-app
  //    backlog under Developer Platform.
  if (has(labels, 'Superadmin'))
    return { category: CATEGORIES.SUPERADMIN, reason: 'Superadmin label' };
  if (has(labels, 'App')) return { category: CATEGORIES.MOBILE, reason: 'App label' };
  if (has(labels, 'PMS')) return { category: CATEGORIES.PMS, reason: 'PMS label' };

  // 3. Developer platform work predates the label set, so it is recognised by
  //    name. Matched against the TITLE only: bodies mention MCP, API keys and
  //    federation in passing far too often for a body match to mean anything.
  if (scope === 'mcp') return { category: CATEGORIES.DEVPLATFORM, reason: 'scope(mcp)' };
  if (
    /developer portal|\bmcp\b|metered billing|api keys|activitypub|federation|public data api|developer platform/i.test(
      title
    )
  ) {
    return { category: CATEGORIES.DEVPLATFORM, reason: 'developer platform keyword in title' };
  }

  // 4. Desktop before frontend: "fix(frontend): desktop week calendar" is a
  //    viewport, not the Electron app. Only an explicit desktop scope or area
  //    counts, never the word "desktop" in a sentence.
  if (scope === 'desktop' || /\bdesktop app\b|electron/i.test(area)) {
    return { category: CATEGORIES.DESKTOP, reason: 'desktop scope/area' };
  }

  // 5. Conventional-commit scope, then the bug template's affected area.
  if (scope === 'mobile') return { category: CATEGORIES.MOBILE, reason: 'scope(mobile)' };
  if (scope === 'frontend') return { category: CATEGORIES.PMS, reason: 'scope(frontend)' };
  if (/\bmobile\b/.test(area))
    return { category: CATEGORIES.MOBILE, reason: 'affected area: mobile' };
  if (/web app|frontend \(pims\)|\bpims\b/.test(area)) {
    return { category: CATEGORIES.PMS, reason: 'affected area: web' };
  }

  // 6. Repo-wide toolchain work. A chore, ci, test or perf change scoped to the
  //    whole repo is infrastructure by definition, and its body is full of
  //    per-app examples that would otherwise capture it for whichever app got
  //    listed most. Decide it here, before any path evidence is consulted.
  const repoWideToolchain =
    /^(chore|ci|test|perf|build|refactor)\((repo|deps|deps-dev|ci|tooling)\)/i.test(title.trim());
  if (
    repoWideToolchain ||
    has(labels, 'CI/CD') ||
    has(labels, 'Cloud') ||
    has(labels, 'security') ||
    has(labels, 'engineering') ||
    has(labels, 'automation')
  ) {
    return { category: CATEGORIES.PLATFORM, reason: 'repo-wide toolchain or engineering label' };
  }

  // 7. Everything else: let the body's workspace paths speak, but only when they
  //    speak clearly. A single stray "android/" in a TypeScript upgrade is noise,
  //    so a winner must have at least two mentions and double the runner-up.
  const ev = pathEvidence(body);
  const ranked = Object.entries(ev).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  if (top && top[1] >= 2 && top[1] >= (second?.[1] || 0) * 2) {
    return { category: top[0], reason: `path evidence: ${top[0]} x${top[1]}` };
  }

  if (
    has(labels, 'Backend') ||
    scope === 'backend' ||
    scope === 'repo' ||
    scope === 'auth' ||
    scope === 'api'
  ) {
    return { category: CATEGORIES.PLATFORM, reason: 'backend/repo scope' };
  }
  if (/\bbackend\b|runtime|node 2\d/.test(t)) {
    return { category: CATEGORIES.PLATFORM, reason: 'title keyword: backend/runtime' };
  }

  return { category: null, reason: 'no usable signal' };
}

/**
 * Priority from the labels a human already applied.
 *
 * Kept crude on purpose. The board lets a human override any cell, and sync.mjs
 * never overwrites a value that is already set, so this only has to produce a
 * sane starting point for a brand new issue.
 */
export function classifyPriority({ labels = [], title = '' } = {}) {
  if (has(labels, 'security')) return PRIORITIES.URGENT;
  // A bug that blocks signup or launch is not the same as a contrast nit, and
  // the QA sweeps say so in the title.
  if (
    has(labels, 'bug') &&
    /blocking every|cannot be created|dead end|never reach|404s|crash/i.test(title)
  ) {
    return PRIORITIES.URGENT;
  }
  if (has(labels, 'bug')) return PRIORITIES.HIGH;
  if (has(labels, 'future-scope')) return PRIORITIES.LOW;
  return PRIORITIES.NORMAL;
}

/**
 * Status from the issue's own state.
 *
 * The tracker is the source of truth for "is this done", which is exactly the
 * fact the old board got wrong on four items. Everything softer than that -
 * whether open work has actually started - is inferred, and sync.mjs treats the
 * inference as a default rather than an instruction.
 */
export function classifyStatus({ state, assignees = [], linkedPrs = [] } = {}) {
  if (state === 'CLOSED' || state === 'MERGED') return STATUSES.COMPLETED;
  const openPrs = linkedPrs.filter((p) => p.state === 'OPEN');
  // A PR that is out of draft is code waiting on review or QA, not code being
  // written. That is the distinction the board's "Under Testing" column exists
  // to show, and it is the column nobody ever moved an item into by hand.
  if (openPrs.some((p) => !p.isDraft)) return STATUSES.UNDER_TESTING;
  if (openPrs.length > 0) return STATUSES.IN_PROGRESS;
  if (assignees.length > 0) return STATUSES.IN_PROGRESS;
  return STATUSES.NOT_STARTED;
}
