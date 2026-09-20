import type { Meta, StoryObj } from '@storybook/react';
import { expect, waitFor } from 'storybook/test';

import { getStorageItem, removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { COOKIE_CONSENT_KEY, POSTHOG_READY_EVENT } from '@/app/lib/posthog';
import { getLoadedPostHog, resetPostHogClientForTests } from '@/app/lib/posthogClient';
import PostHogBootstrap from './PostHogBootstrap';

/** The only host the component will ever load posthog-js for. Any other value resolves to an empty `apiHost`. */
const POSTHOG_EU_HOST = 'https://eu.i.posthog.com';
const PROJECT_TOKEN = 'phc_storybook_bootstrap_token';

type Fixture = {
  /** Seeds `cookieConsentGiven`. `null` clears the key, matching a first-time visitor. */
  consent?: 'true' | 'false' | null;
  host?: string;
  token?: string;
};

/**
 * The two env vars and the one localStorage key are the whole surface of this
 * component - there is no store and no axios call to seed. `resetPostHogClientForTests`
 * is the part that matters most: `loadPostHog` caches the imported posthog-js module in a
 * module-level variable that outlives any one story, so a story that actually
 * loads it would otherwise hand every later story an already-initialized
 * client instead of a fresh mount.
 */
const prepare =
  ({ consent = null, host = '', token = '' }: Fixture) =>
  () => {
    const previousConsent = getStorageItem('local', COOKIE_CONSENT_KEY);
    if (consent === null) {
      removeStorageItem('local', COOKIE_CONSENT_KEY);
    } else {
      setStorageItem('local', COOKIE_CONSENT_KEY, consent);
    }

    const env = process.env as Record<string, string | undefined>;
    const previousHost = env.NEXT_PUBLIC_POSTHOG_HOST;
    const previousToken = env.NEXT_PUBLIC_POSTHOG_TOKEN;
    env.NEXT_PUBLIC_POSTHOG_HOST = host;
    env.NEXT_PUBLIC_POSTHOG_TOKEN = token;

    resetPostHogClientForTests();

    return () => {
      if (previousConsent === null) {
        removeStorageItem('local', COOKIE_CONSENT_KEY);
      } else {
        setStorageItem('local', COOKIE_CONSENT_KEY, previousConsent);
      }
      env.NEXT_PUBLIC_POSTHOG_HOST = previousHost;
      env.NEXT_PUBLIC_POSTHOG_TOKEN = previousToken;
      resetPostHogClientForTests();
    };
  };

/** Mirrors the Cookies banner: same-tab consent changes are only observed because it dispatches this itself. */
const setConsent = (value: 'true' | 'false') => {
  setStorageItem('local', COOKIE_CONSENT_KEY, value);
  globalThis.dispatchEvent(
    new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: value })
  );
};

const wait = (ms: number) => new Promise((resolve) => globalThis.setTimeout(resolve, ms));

/**
 * Proves a negative: the mount effect never reached for the posthog-js chunk.
 * A generous grace period past the effect and its microtasks, short enough
 * not to slow the suite down.
 */
const expectNeverLoads = async () => {
  await wait(100);
  await expect(getLoadedPostHog()).toBeNull();
};

const meta = {
  title: 'Layout/PostHogBootstrap',
  component: PostHogBootstrap,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component:
          'A headless bootstrapper mounted once in the root layout - it renders nothing. On mount it ' +
          'reads the `cookieConsentGiven` flag the Cookies banner writes to localStorage and, only ' +
          'when consent is already `true` and both `NEXT_PUBLIC_POSTHOG_HOST` (pinned to the EU ' +
          'endpoint) and `NEXT_PUBLIC_POSTHOG_TOKEN` resolve to real values, lazy-loads the ~193KB ' +
          'posthog-js chunk and initializes it with masking, denylisted properties and capture opted ' +
          'out by default. It keeps listening for the `storage` event the banner dispatches on every ' +
          'consent change, so accepting or rejecting cookies later in the same session opts capturing ' +
          'in or out live, without a reload - and it fires `yc:posthog-ready` exactly once, from the ' +
          "SDK's own `loaded` callback, once the client has actually finished initializing.",
      },
    },
  },
  tags: ['autodocs'],
} satisfies Meta<typeof PostHogBootstrap>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AwaitingConsent: Story = {
  name: 'Awaiting consent (default)',
  beforeEach: prepare({ consent: null, host: POSTHOG_EU_HOST, token: PROJECT_TOKEN }),
  parameters: {
    docs: {
      description: {
        story:
          'What every first-time visitor renders as, even with analytics fully configured: no choice ' +
          'has been recorded yet, so the mount effect never loads the posthog-js chunk at all.',
      },
    },
  },
  play: expectNeverLoads,
};

export const AnalyticsNotConfigured: Story = {
  name: 'Consent given, analytics unconfigured',
  beforeEach: prepare({ consent: 'true', host: '', token: '' }),
  parameters: {
    docs: {
      description: {
        story:
          'This is what Storybook itself renders by default - there is no PostHog project token in ' +
          'this preview. Consent alone is never enough; both env vars have to resolve to real values ' +
          'before anything loads.',
      },
    },
  },
  play: expectNeverLoads,
};

export const NonEuHostRefused: Story = {
  name: 'Non-EU host is refused',
  beforeEach: prepare({ consent: 'true', host: 'https://us.i.posthog.com', token: PROJECT_TOKEN }),
  parameters: {
    docs: {
      description: {
        story:
          'A host outside the EU allowlist resolves to an empty `apiHost`, which the same "both must ' +
          'resolve" guard then refuses - a deliberate data-residency gate, not a bug in the config ' +
          'lookup, and worth its own story because it is a different branch than an unset token.',
      },
    },
  },
  play: expectNeverLoads,
};

export const ConsentGrantedInitializes: Story = {
  name: 'Consent already granted - initializes and tracks live opt-out',
  beforeEach: prepare({ consent: 'true', host: POSTHOG_EU_HOST, token: PROJECT_TOKEN }),
  parameters: {
    docs: {
      description: {
        story:
          'Consent was recorded on an earlier visit and both env vars resolve, so the mount effect ' +
          "loads the real posthog-js chunk, initializes it and opts in from the SDK's own `loaded` " +
          "callback. Storybook's offline guard 404s the config request the SDK fires at init - the " +
          'same way a network hiccup would in production - and initialization completes anyway, ' +
          'because the ready event is not gated on that call succeeding. Withdrawing consent afterwards ' +
          '(as the Cookies banner would on a second visit) opts capturing back out live, with no remount.',
      },
    },
  },
  play: async () => {
    let readyFired = false;
    const onReady = () => {
      readyFired = true;
    };
    globalThis.addEventListener(POSTHOG_READY_EVENT, onReady);

    try {
      await waitFor(() => expect(readyFired).toBe(true), { timeout: 5000 });

      const client = getLoadedPostHog();
      await expect(client).not.toBeNull();
      await expect(client?.has_opted_in_capturing()).toBe(true);

      // The banner dispatches this same event on a real withdrawal; nothing here remounts.
      setConsent('false');

      await waitFor(() => expect(client?.has_opted_out_capturing()).toBe(true));
    } finally {
      globalThis.removeEventListener(POSTHOG_READY_EVENT, onReady);
    }
  },
};
