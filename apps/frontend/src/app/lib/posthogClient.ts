import type { PostHog } from 'posthog-js';

// posthog-js is ~193KB minified (~75KB gzipped). A static import puts it in the
// shared bundle for every route, so every visitor downloads and parses the
// analytics library before they have consented to anything - and visitors who
// never consent pay for it without it ever initializing.
//
// Loading it through here keeps it in its own chunk, fetched only when consent
// has actually been given. `getLoadedPostHog` stays synchronous so callers that
// only act once analytics is running (identify/reset) do not have to become
// async: it returns the client if and only if it has already been loaded.
let client: PostHog | null = null;

export const loadPostHog = async (): Promise<PostHog> => {
  client ??= (await import('posthog-js')).default;
  return client;
};

export const getLoadedPostHog = (): PostHog | null => client;

// Test seam: jest module registry resets do not clear this module-level handle.
export const resetPostHogClientForTests = (): void => {
  client = null;
};
