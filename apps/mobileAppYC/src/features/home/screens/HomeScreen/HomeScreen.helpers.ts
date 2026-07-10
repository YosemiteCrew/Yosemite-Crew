export const deriveHomeGreetingName = (rawFirstName?: string | null) => {
  const trimmed = rawFirstName?.trim() ?? '';
  const resolvedName = trimmed.length > 0 ? trimmed : 'Sky';
  const displayName =
    resolvedName.length > 13 ? `${resolvedName.slice(0, 13)}...` : resolvedName;
  return {resolvedName, displayName};
};
