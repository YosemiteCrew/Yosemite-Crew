import PostHog from 'posthog-react-native';
import {POSTHOG_CONFIG} from '@/config/variables';

let posthogClient: PostHog | null = null;
let didWarnMissingConfig = false;

const getTrimmedValue = (value: string) => value.trim();

const canInitializePostHog = () => {
  if (!POSTHOG_CONFIG.enabled) {
    return false;
  }

  const apiKey = getTrimmedValue(POSTHOG_CONFIG.apiKey);
  const host = getTrimmedValue(POSTHOG_CONFIG.host);
  if (apiKey && host) {
    return true;
  }

  if (!didWarnMissingConfig) {
    didWarnMissingConfig = true;
    console.warn(
      '[PostHog] Missing apiKey or host; SDK initialization skipped.',
    );
  }

  return false;
};

export const initializePostHog = () => {
  if (posthogClient) {
    return posthogClient;
  }

  if (!canInitializePostHog()) {
    return null;
  }

  posthogClient = new PostHog(getTrimmedValue(POSTHOG_CONFIG.apiKey), {
    captureAppLifecycleEvents: true,
    defaultOptIn: POSTHOG_CONFIG.defaultOptIn,
    enableSessionReplay: POSTHOG_CONFIG.enableSessionReplay,
    host: getTrimmedValue(POSTHOG_CONFIG.host),
    persistence: 'file',
  });

  return posthogClient;
};

export const getPostHogClient = () => initializePostHog();

export const trackPostHogScreen = async (screenName: string) => {
  if (!POSTHOG_CONFIG.captureScreens) {
    return;
  }

  const client = getPostHogClient();
  if (!client) {
    return;
  }

  await client.screen(screenName);
};

export const setPostHogTrackingEnabled = async (enabled: boolean) => {
  const client = getPostHogClient();
  if (!client) {
    return;
  }

  if (enabled) {
    await client.optIn();
    return;
  }

  await client.optOut();
};

export const resetPostHog = () => {
  posthogClient?.reset();
};
