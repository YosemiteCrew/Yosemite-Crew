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
