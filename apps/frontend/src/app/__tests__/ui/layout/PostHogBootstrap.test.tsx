import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import posthog from 'posthog-js';
import { COOKIE_CONSENT_KEY, POSTHOG_READY_EVENT } from '@/app/lib/posthog';
import * as posthogClient from '@/app/lib/posthogClient';
import { resetPostHogClientForTests } from '@/app/lib/posthogClient';

// Delegates to the real client so the cached-handle behaviour stays intact, while
// letting a single test simulate a failed chunk load.
jest.mock('@/app/lib/posthogClient', () => {
  const actual = jest.requireActual('@/app/lib/posthogClient');
  return { ...actual, loadPostHog: jest.fn(() => actual.loadPostHog()) };
});
import PostHogBootstrap from '@/app/ui/layout/PostHogBootstrap';

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    opt_in_capturing: jest.fn(),
    opt_out_capturing: jest.fn(),
  },
}));

type PostHogInitOptions = {
  api_host?: string;
  loaded?: (ph: typeof posthog) => void;
  opt_out_capturing_by_default?: boolean;
  property_denylist?: string[];
};

const getInitOptions = () => (posthog.init as jest.Mock).mock.calls[0][1] as PostHogInitOptions;

describe('PostHogBootstrap', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_POSTHOG_HOST: 'https://eu.i.posthog.com',
      NEXT_PUBLIC_POSTHOG_TOKEN: 'phc_test',
    };
    globalThis.localStorage.clear();
    jest.clearAllMocks();
    // Each test starts like a fresh page load, with the analytics chunk not yet
    // fetched. Without this the cached client leaks between tests and the
    // already-loaded path is taken instead of initialization.
    resetPostHogClientForTests();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('does not initialize before consent is granted', async () => {
    render(<PostHogBootstrap />);

    await waitFor(() => expect(posthog.init).not.toHaveBeenCalled());
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
    expect(posthog.opt_out_capturing).not.toHaveBeenCalled();
  });

  it('initializes with privacy config when consent is already stored', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');

    render(<PostHogBootstrap />);

    await waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
    expect(posthog.init).toHaveBeenCalledWith(
      'phc_test',
      expect.objectContaining({
        api_host: 'https://eu.i.posthog.com',
        capture_pageview: 'history_change',
        defaults: '2026-01-30',
        opt_out_capturing_by_default: true,
      })
    );
    expect(getInitOptions().property_denylist).toEqual(
      expect.arrayContaining(['password', 'access_token', 'refresh_token'])
    );
    expect(getInitOptions().property_denylist).not.toContain('token');
  });

  it('opts in from the loaded callback after initialized consent', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    const onReady = jest.fn();
    globalThis.addEventListener(POSTHOG_READY_EVENT, onReady);

    render(<PostHogBootstrap />);

    await waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
    act(() => {
      getInitOptions().loaded?.(posthog);
    });
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledTimes(1);
    globalThis.removeEventListener(POSTHOG_READY_EVENT, onReady);
  });

  it('initializes once when consent is granted after render', async () => {
    render(<PostHogBootstrap />);

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'true' })
      );
    });

    await waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
    act(() => {
      getInitOptions().loaded?.(posthog);
    });
    expect(posthog.opt_in_capturing).toHaveBeenCalledTimes(1);

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'true' })
      );
    });
    expect(posthog.init).toHaveBeenCalledTimes(1);
  });

  it('opts out when consent is revoked after initialization', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');

    render(<PostHogBootstrap />);

    await waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'false' })
      );
    });
    await waitFor(() => expect(posthog.opt_out_capturing).toHaveBeenCalledTimes(1));
  });

  it('skips initialization when PostHog env is incomplete', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_TOKEN = '';
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');

    render(<PostHogBootstrap />);

    await waitFor(() => expect(posthog.init).not.toHaveBeenCalled());
  });

  it('skips initialization when PostHog host is not the EU endpoint', async () => {
    process.env.NEXT_PUBLIC_POSTHOG_HOST = 'https://us.i.posthog.com';
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');

    render(<PostHogBootstrap />);

    await waitFor(() => expect(posthog.init).not.toHaveBeenCalled());
  });

  it('does not opt in when consent is withdrawn while the analytics chunk loads', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');

    render(<PostHogBootstrap />);
    // Revoke in the same tick the mount effect starts loading the chunk, before
    // the dynamic import resolves.
    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'false' })
      );
    });

    await waitFor(() => expect(posthog.init).not.toHaveBeenCalled());
    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
  });

  it('opts out instead of opting in when consent is withdrawn before the loaded callback runs', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');

    render(<PostHogBootstrap />);
    await waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'false' })
      );
    });
    // PostHog calls `loaded` asynchronously; by now consent is gone.
    act(() => {
      getInitOptions().loaded?.(posthog);
    });

    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
    expect(posthog.opt_out_capturing).toHaveBeenCalled();
  });

  it('still signals readiness when consent was withdrawn during initialization', async () => {
    // Readiness means the client is initialized, not that we are capturing. If it
    // is skipped here it is never emitted at all, because re-consenting takes the
    // already-loaded path which only toggles capture - leaving anything that waits
    // on the event permanently inactive.
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    const onReady = jest.fn();
    globalThis.addEventListener(POSTHOG_READY_EVENT, onReady);

    render(<PostHogBootstrap />);
    await waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'false' })
      );
    });
    act(() => {
      getInitOptions().loaded?.(posthog);
    });

    expect(posthog.opt_in_capturing).not.toHaveBeenCalled();
    expect(onReady).toHaveBeenCalledTimes(1);

    // ...and re-consenting from the cached path opts back in.
    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'true' })
      );
    });
    await waitFor(() => expect(posthog.opt_in_capturing).toHaveBeenCalled());

    globalThis.removeEventListener(POSTHOG_READY_EVENT, onReady);
  });

  it('retries initialization after a failed analytics chunk load', async () => {
    const loadMock = posthogClient.loadPostHog as jest.Mock;
    loadMock.mockRejectedValueOnce(new Error('chunk load failed'));
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');

    render(<PostHogBootstrap />);
    await waitFor(() => expect(loadMock).toHaveBeenCalledTimes(1));
    expect(posthog.init).not.toHaveBeenCalled();

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'true' })
      );
    });

    await waitFor(() => expect(posthog.init).toHaveBeenCalledTimes(1));
  });
});
