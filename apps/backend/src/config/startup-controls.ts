/**
 * A record of whether each security control actually applied at boot.
 *
 * The Stream chat upload blocklist failed to apply on every environment,
 * production included, for as long as its extension format was wrong. Nothing
 * noticed, because the only trace was one error line in a log nobody reads: the
 * process started fine, `/health` returned 200, and the control the code called
 * "the authoritative control" was simply absent.
 *
 * A control that FAILS TO APPLY must not look the same as one that was never
 * asked to. Anything registered here shows up on /health/controls, so a monitor
 * can see the difference from outside without anyone reading a log.
 *
 * This deliberately does not stop the boot. A Stream outage should not take the
 * API down - it should be VISIBLE.
 */
/**
 * The controls this process registers before it answers on its port.
 *
 * Reported alongside the reports themselves, because a response that lists only
 * what WAS recorded cannot distinguish "this bundle is too old to record X"
 * from "this bundle registers X and did not". Those are the same bytes, and the
 * deploy gate has to ship on the first and stop on the second: absence of this
 * key is what marks an older bundle, so it must never be conditional.
 *
 * A MANIFEST rather than a declare() call beside each recordControl. Putting the
 * declaration next to the recording makes them impossible to drift apart - and
 * also makes the declaration vanish exactly when the code path is skipped,
 * which is the case a deploy gate most needs to see. The cost is that this list
 * can go stale, and a name left here after its control is deleted would block
 * every deploy forever, so test/config/expected-controls.test.ts boots the app
 * in each configuration and asserts the recorded set covers this one.
 *
 * Anything added here must be recorded BEFORE app.listen - see that same file.
 */
export const EXPECTED_CONTROLS = [
  "authentication",
  "stream-upload-policy",
] as const;

export const getExpectedControls = (): string[] => [...EXPECTED_CONTROLS];

export type ControlState = "applied" | "failed" | "skipped";

export type ControlReport = {
  name: string;
  state: ControlState;
  /** Why it is skipped or failed. Never include credentials or response bodies. */
  detail?: string;
  at: string;
};

const reports = new Map<string, ControlReport>();

export const recordControl = (
  name: string,
  state: ControlState,
  detail?: string,
): void => {
  reports.set(name, {
    name,
    state,
    ...(detail ? { detail } : {}),
    at: new Date().toISOString(),
  });
};

export const getControlReports = (): ControlReport[] =>
  [...reports.values()].sort((a, b) => a.name.localeCompare(b.name));

/**
 * `failed` is the only state that should page someone.
 *
 * `skipped` is a deployment fact, not a fault - an environment without Stream
 * credentials genuinely has nothing to configure, and treating that as an
 * incident would train people to ignore this endpoint, which is the failure
 * mode it exists to fix.
 */
export const hasFailedControl = (): boolean =>
  [...reports.values()].some((report) => report.state === "failed");

/** Test seam only. */
export const resetControlsForTest = (): void => reports.clear();
