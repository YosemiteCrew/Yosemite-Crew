import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import posthog from 'posthog-js';
import { COOKIE_CONSENT_KEY } from '@/app/lib/posthog';
import PostHogBootstrap from '@/app/ui/layout/PostHogBootstrap';

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    init: jest.fn(),
    opt_in_capturing: jest.fn(),
    opt_out_capturing: jest.fn(),
  },
}));

describe('PostHogBootstrap', () => {
  beforeEach(() => {
    globalThis.localStorage.clear();
    jest.clearAllMocks();
  });

  it('does not initialize PostHog before consent', () => {
    render(<PostHogBootstrap apiHost="https://us.i.posthog.com" projectToken="ph_test" />);

    expect(posthog.init).not.toHaveBeenCalled();
  });

  it('initializes PostHog after stored consent', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');

    render(<PostHogBootstrap apiHost="https://us.i.posthog.com" projectToken="ph_test" />);

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalledWith(
        'ph_test',
        expect.objectContaining({
          api_host: 'https://us.i.posthog.com',
          enable_heatmaps: true,
          mask_all_element_attributes: true,
          mask_all_text: true,
          opt_out_capturing_by_default: true,
        })
      );
      expect(posthog.opt_in_capturing).toHaveBeenCalled();
    });
  });

  it('opts into PostHog when consent is granted after render', async () => {
    render(<PostHogBootstrap apiHost="https://us.i.posthog.com" projectToken="ph_test" />);

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'true' })
      );
    });

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalledTimes(1);
      expect(posthog.opt_in_capturing).toHaveBeenCalled();
    });
  });

  it('opts out when consent is revoked after initialization', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');

    render(<PostHogBootstrap apiHost="https://us.i.posthog.com" projectToken="ph_test" />);

    await waitFor(() => {
      expect(posthog.init).toHaveBeenCalledTimes(1);
    });

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'false' })
      );
    });

    await waitFor(() => {
      expect(posthog.opt_out_capturing).toHaveBeenCalled();
    });
  });
});
