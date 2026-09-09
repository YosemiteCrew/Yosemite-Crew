import type { Meta, StoryObj } from '@storybook/react';
import { expect, fn, waitFor } from 'storybook/test';

import { COOKIE_CONSENT_KEY } from '@/app/lib/posthog';
import { loadPostHog } from '@/app/lib/posthogClient';
import { removeStorageItem, setStorageItem } from '@/app/lib/browserStorage';
import { useAuthStore } from '@/app/stores/authStore';
import type { AuthStore } from '@/app/stores/authStore';
import PostHogUserSync from './PostHogUserSync';

const FULL_ATTRIBUTES: AuthStore['attributes'] = {
  sub: 'user-sub-1',
  email: 'taylor@harboursidevet.example',
  given_name: 'Taylor',
  family_name: 'Doctor',
  'custom:role': 'OWNER',
};

const EMAIL_ONLY_ATTRIBUTES: AuthStore['attributes'] = {
  email: 'reception@harboursidevet.example',
};

type Fixture = {
  consent: boolean;
  posthogReady: boolean;
  authStatus: AuthStore['status'];
  attributes: AuthStore['attributes'];
};

// Reassigned by prepare() before every story, so a play() function always
// asserts against the spies its own beforeEach installed.
let identifySpy = fn();
let resetSpy = fn();

/**
 * The component only ever reaches two seams: the PostHog singleton behind
 * getLoadedPostHog()/loadPostHog(), and the auth store behind the lazy
 * useLazyAuthSlice hook. loadPostHog() here does the real dynamic import of
 * posthog-js (already a project dependency) rather than a fake client -
 * only its identify/reset methods are swapped for spies, and .init() is
 * never called, so nothing reaches PostHog's servers. useAuthStore is
 * seeded directly, the same way Discounts/index.stories.tsx seeds its
 * stores: the module the lazy hook dynamically imports resolves to the same
 * singleton this file already imports, so setState here is visible to it.
 */
const prepare = (fixture: Fixture) => async () => {
  const authSnapshot = useAuthStore.getState();

  if (fixture.consent) {
    setStorageItem('local', COOKIE_CONSENT_KEY, 'true');
  } else {
    removeStorageItem('local', COOKIE_CONSENT_KEY);
  }

  const client = (await loadPostHog()) as unknown as {
    identify: (...args: unknown[]) => void;
    reset: (...args: unknown[]) => void;
    __loaded: boolean;
  };
  identifySpy = fn();
  resetSpy = fn();
  client.identify = identifySpy;
  client.reset = resetSpy;
  client.__loaded = fixture.posthogReady;

  useAuthStore.setState({ status: fixture.authStatus, attributes: fixture.attributes });

  return () => {
    removeStorageItem('local', COOKIE_CONSENT_KEY);
    useAuthStore.setState(authSnapshot);
  };
};

const meta = {
  title: 'Layout/PostHogUserSync',
  component: PostHogUserSync,
  parameters: {
    docs: {
      description: {
        component:
          'Headless component mounted once in the root layout - it renders nothing and exists ' +
          'only to call posthog.identify (or posthog.reset) as consent and auth state change. ' +
          'Two gates both have to be true before it does anything: cookie consent, read from the ' +
          '`cookieConsentGiven` localStorage key, and the PostHog client itself having loaded and ' +
          'initialized. A visitor who has not consented never triggers a fetch of the auth store ' +
          'either, which is what keeps the SuperTokens stack out of the public-page bundle. Once ' +
          'past both gates it identifies the current user by their `sub` (falling back to email) ' +
          'with only four properties allow-listed - email, first name, last name, role - and only ' +
          're-identifies when the distinct id actually changes. If consent is revoked or the ' +
          'session ends after an identify, it calls reset so the next visitor on that browser is ' +
          'not attributed to the account that just left.',
      },
    },
  },
  tags: ['autodocs'],
  args: {},
} satisfies Meta<typeof PostHogUserSync>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  name: 'Identifies a consented, authenticated visitor',
  beforeEach: prepare({
    consent: true,
    posthogReady: true,
    authStatus: 'authenticated',
    attributes: FULL_ATTRIBUTES,
  }),
  play: async () => {
    await waitFor(() =>
      expect(identifySpy).toHaveBeenCalledWith('user-sub-1', {
        email: 'taylor@harboursidevet.example',
        first_name: 'Taylor',
        last_name: 'Doctor',
        role: 'OWNER',
      })
    );
  },
};

export const AwaitingConsent: Story = {
  name: 'No consent yet - never identifies',
  beforeEach: prepare({
    consent: false,
    posthogReady: true,
    authStatus: 'authenticated',
    attributes: FULL_ATTRIBUTES,
  }),
  play: async () => {
    // Both gated calls stay untouched: no consent means the auth store is
    // never even fetched, so there is nothing to identify with yet.
    await waitFor(() => expect(identifySpy).not.toHaveBeenCalled());
    expect(resetSpy).not.toHaveBeenCalled();
  },
};

export const ConsentGrantedAfterMount: Story = {
  name: 'Consent granted after mount',
  beforeEach: prepare({
    consent: false,
    posthogReady: true,
    authStatus: 'authenticated',
    attributes: FULL_ATTRIBUTES,
  }),
  play: async () => {
    await waitFor(() => expect(identifySpy).not.toHaveBeenCalled());

    // A second tab accepting the cookie banner fires this exact event.
    setStorageItem('local', COOKIE_CONSENT_KEY, 'true');
    globalThis.dispatchEvent(
      new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'true' })
    );

    await waitFor(() =>
      expect(identifySpy).toHaveBeenCalledWith('user-sub-1', {
        email: 'taylor@harboursidevet.example',
        first_name: 'Taylor',
        last_name: 'Doctor',
        role: 'OWNER',
      })
    );
  },
};

export const ConsentRevoked: Story = {
  name: 'Consent revoked resets identity',
  beforeEach: prepare({
    consent: true,
    posthogReady: true,
    authStatus: 'authenticated',
    attributes: FULL_ATTRIBUTES,
  }),
  play: async () => {
    await waitFor(() => expect(identifySpy).toHaveBeenCalledTimes(1));

    setStorageItem('local', COOKIE_CONSENT_KEY, 'false');
    globalThis.dispatchEvent(
      new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'false' })
    );

    await waitFor(() => expect(resetSpy).toHaveBeenCalledTimes(1));
  },
};

export const EmailFallbackId: Story = {
  name: 'Falls back to email as the distinct id',
  beforeEach: prepare({
    consent: true,
    posthogReady: true,
    authStatus: 'signin-authenticated',
    attributes: EMAIL_ONLY_ATTRIBUTES,
  }),
  play: async () => {
    await waitFor(() =>
      expect(identifySpy).toHaveBeenCalledWith('reception@harboursidevet.example', {
        email: 'reception@harboursidevet.example',
      })
    );
  },
};
