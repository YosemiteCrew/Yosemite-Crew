export const deriveHomeGreetingName = (rawFirstName?: string | null) => {
  const trimmed = rawFirstName?.trim() ?? '';
  const resolvedName = trimmed.length > 0 ? trimmed : 'Sky';
  const displayName =
    resolvedName.length > 13 ? `${resolvedName.slice(0, 13)}...` : resolvedName;
  return {resolvedName, displayName};
};

/**
 * Whether one of Home's startup requests has SETTLED - succeeded or failed.
 *
 * The readiness gate used to ask only "did it hydrate", and hydration flags are
 * set exclusively in a thunk's `.fulfilled` case. A rejected fetch therefore
 * looked exactly like one still in flight, so a single failure pinned the
 * full-screen loader up until the 12s escape hatch fired and then dropped the
 * user onto a Home with silently blank sections (issue #2368). Treating a
 * recorded failure as settled lets the loader clear immediately and lets the
 * screen say what went wrong.
 */
export const isHomeRequestSettled = (
  loading: boolean | undefined,
  hydrated: boolean,
  failed: string | undefined,
): boolean => !loading && (hydrated || Boolean(failed));
