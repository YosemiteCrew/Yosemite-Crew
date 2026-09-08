/**
 * Page-level invariants that hold on every screen, checked against data the
 * browser hands back rather than against a fixture.
 *
 * These exist because unit tests structurally cannot catch this class. Every
 * defect below shipped with a passing suite: the fixture the test author wrote
 * made the two sides agree, so no assertion over it could ever have failed.
 * A rule that reads the rendered page has no such blind spot.
 *
 * Pure functions, so they are tested directly. A checker that cannot fail is
 * worse than no checker, and the only way to know is to test it.
 */

export type Violation = { rule: string; detail: string };

/** Text a component was supposed to humanise and did not: PARENT_TASK, OUT_OF_STOCK. */
export const rawEnumViolations = (texts: readonly string[]): Violation[] =>
  texts.flatMap((t) =>
    // Searched WITHIN the node, not anchored to it. The defect this rule exists
    // for renders as "MEDICATION • PARENT_TASK" in a single text node, and an
    // anchored match returned nothing for exactly that string.
    //
    // Underscore still required. Bare capitals are ordinary product vocabulary
    // here - DHPP, FHIR, DEA - and flagging them would make the rule noise,
    // which is how a rule gets switched off.
    [...t.matchAll(/\b[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)+\b/g)].map((m) => ({
      rule: 'raw-enum',
      detail: m[0],
    }))
  );

/** Database identifiers rendered to a vet: 6971e5d25934bff94ee07942. */
export const rawIdViolations = (texts: readonly string[]): Violation[] =>
  texts.flatMap((t) =>
    [...t.matchAll(/\b[0-9a-f]{24}\b/g)].map((m) => ({ rule: 'raw-id', detail: m[0] }))
  );

/** A value that reached the DOM without being formatted, or at all. */
export const placeholderValueViolations = (texts: readonly string[]): Violation[] =>
  texts.flatMap((t) =>
    [...t.matchAll(/\[object Object\]|\bundefined\b|\bNaN\b/g)].map((m) => ({
      rule: 'unformatted-value',
      detail: `${m[0]} in ${JSON.stringify(t.trim().slice(0, 80))}`,
    }))
  );

/**
 * The same heading twice on one page.
 *
 * This is the "Check-in board nested inside Front desk" shape: a rename applied
 * to a wrapper while the thing inside kept announcing its old name, so the page
 * claims to be two different boards. Case-insensitive, because "Board" and
 * "board" read identically to a person.
 */
export const duplicateHeadingViolations = (headings: readonly string[]): Violation[] => {
  const seen = new Map<string, number>();
  for (const h of headings) {
    const key = h.trim().toLowerCase();
    if (key) seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  return [...seen.entries()]
    .filter(([, n]) => n > 1)
    .map(([key, n]) => ({ rule: 'duplicate-heading', detail: `"${key}" x${n}` }));
};

/**
 * An error message and an empty-state message rendered at the same time.
 *
 * The patient overview shipped showing "Could not load the problem list" directly
 * above "No problems recorded for this patient yet." Those contradict: one says
 * the data is unknown, the other says it is known to be absent. A panel must
 * render exactly one of loading, error, empty, content.
 */
export const contradictoryStateViolations = (
  panels: readonly { name: string; hasError: boolean; hasEmptyState: boolean }[]
): Violation[] =>
  panels
    .filter((p) => p.hasError && p.hasEmptyState)
    .map((p) => ({
      rule: 'error-and-empty-together',
      detail: `${p.name} renders an error and an empty state at once`,
    }));

/**
 * Two elements on one page claiming the same quantity with different numbers.
 *
 * Inventory shipped reading "0 items below reorder point" directly above a panel
 * headed "Low stock 21", because the header counted only LOW_STOCK client-side
 * while the panel used the server's `onHand <= reorderLevel`, which includes
 * zero. Both were tested. Neither test could see the other number.
 */
export const countMismatchViolations = (
  counts: readonly { label: string; sources: readonly { where: string; value: number }[] }[]
): Violation[] =>
  counts
    .filter((c) => new Set(c.sources.map((s) => s.value)).size > 1)
    .map((c) => {
      const sources = c.sources.map((s) => `${s.where}=${s.value}`).join(' vs ');
      return { rule: 'count-mismatch', detail: `${c.label}: ${sources}` };
    });

/**
 * A date in the past under a heading that promises the future.
 *
 * "Expiring soon" listed batches 222 days expired, because the alerts endpoint
 * bounds the window above and not below.
 */
export const staleForwardLookingViolations = (
  rows: readonly { section: string; label: string; daysFromNow: number }[]
): Violation[] =>
  rows
    .filter((r) => /soon|upcoming|next\b/i.test(r.section) && r.daysFromNow < 0)
    .map((r) => ({
      rule: 'past-date-in-forward-looking-section',
      detail: `${r.section}: "${r.label}" is ${Math.abs(r.daysFromNow)} days in the past`,
    }));

export const formatViolations = (route: string, violations: readonly Violation[]): string =>
  violations.map((v) => `${route}  [${v.rule}]  ${v.detail}`).join('\n');

/**
 * Whether a console error says something about the product.
 *
 * A sweep that walks nineteen routes in a row makes the API shed load, and the
 * first run of this spec reported its own 429s and the 503s behind them as
 * findings. Reporting a rule's own side effects is how a rule gets ignored.
 */
export const isReportableConsoleError = (text: string): boolean =>
  !/\b429\b|Too Many Requests/i.test(text);

/**
 * How long to hold off before the next request, decided from the API's own
 * rate-limit headers rather than from a fixed sleep.
 *
 * The limiter sets `standardHeaders: true`, so every response carries
 * RateLimit-Remaining and RateLimit-Reset. A sweep that walks nineteen routes
 * exhausts the window and then reports its own 429s as findings, so it has to
 * throttle - but throttling on a timer is both slower than necessary in the
 * normal case and not slow enough in the bad one. Reading the budget means no
 * wait at all while there is headroom, and a wait of exactly the right length
 * when there is not.
 */
export const throttleDelayMs = ({
  remaining,
  resetAtMs,
  now,
  lowWater = 40,
}: {
  remaining?: number;
  resetAtMs?: number;
  now: number;
  lowWater?: number;
}): number => {
  // No headers yet, or plenty of budget: do not wait.
  if (remaining === undefined || remaining > lowWater) return 0;
  if (resetAtMs === undefined) return 0;
  return Math.max(0, resetAtMs - now);
};

/**
 * Violations not already accounted for by the baseline, comparing MULTIPLICITY
 * rather than membership.
 *
 * `includes` treats the baseline as a set: with one raw id already recorded, a
 * regression rendering the same id in a second component matched the single
 * baseline entry and reported nothing. Each baseline line now excuses exactly
 * one occurrence.
 */
export const regressionsAgainstBaseline = (
  found: readonly string[],
  baseline: readonly string[],
): string[] => {
  const budget = new Map<string, number>();
  for (const line of baseline) budget.set(line, (budget.get(line) ?? 0) + 1);
  const out: string[] = [];
  for (const line of found) {
    const left = budget.get(line) ?? 0;
    if (left > 0) budget.set(line, left - 1);
    else out.push(line);
  }
  return out;
};
