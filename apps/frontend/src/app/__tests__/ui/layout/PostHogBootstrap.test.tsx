import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import posthog from 'posthog-js';
import { COOKIE_CONSENT_KEY, POSTHOG_READY_EVENT } from '@/app/lib/posthog';
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
});
