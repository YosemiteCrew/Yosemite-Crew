import React from 'react';
import { act, render, waitFor } from '@testing-library/react';
import posthog from 'posthog-js';
import { COOKIE_CONSENT_KEY, POSTHOG_READY_EVENT } from '@/app/lib/posthog';
import PostHogUserSync from '@/app/ui/layout/PostHogUserSync';

const mockUseAuthStore = jest.fn();

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: {
    __loaded: false,
    identify: jest.fn(),
    reset: jest.fn(),
  },
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: (selector: (state: unknown) => unknown) => mockUseAuthStore(selector),
}));

describe('PostHogUserSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.localStorage.clear();
    (posthog as { __loaded?: boolean }).__loaded = false;
  });

  it('does not identify authenticated users before analytics consent and readiness', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: {
          sub: 'user-sub-1',
          email: 'vet@example.com',
          family_name: 'Doctor',
          given_name: 'Taylor',
          'custom:role': 'OWNER',
        },
        status: 'authenticated',
      })
    );

    render(<PostHogUserSync />);

    await waitFor(() => expect(posthog.identify).not.toHaveBeenCalled());
  });

  it('identifies authenticated users with safe person properties after opt-in', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: {
          sub: 'user-sub-1',
          email: 'vet@example.com',
          family_name: 'Doctor',
          given_name: 'Taylor',
          'custom:role': 'OWNER',
        },
        status: 'authenticated',
      })
    );

    render(<PostHogUserSync />);

    act(() => {
      (posthog as { __loaded?: boolean }).__loaded = true;
      globalThis.dispatchEvent(new Event(POSTHOG_READY_EVENT));
    });

    await waitFor(() =>
      expect(posthog.identify).toHaveBeenCalledWith('user-sub-1', {
        email: 'vet@example.com',
        first_name: 'Taylor',
        last_name: 'Doctor',
        role: 'OWNER',
      })
    );
  });

  it('identifies when consent is granted after render', async () => {
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: {
          sub: 'user-sub-1',
          email: 'vet@example.com',
        },
        status: 'authenticated',
      })
    );

    render(<PostHogUserSync />);

    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'true' })
      );
      (posthog as { __loaded?: boolean }).__loaded = true;
      globalThis.dispatchEvent(new Event(POSTHOG_READY_EVENT));
    });

    await waitFor(() =>
      expect(posthog.identify).toHaveBeenCalledWith('user-sub-1', {
        email: 'vet@example.com',
      })
    );
  });

  it('resets analytics state when consent is revoked after identification', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: {
          sub: 'user-sub-1',
          email: 'vet@example.com',
        },
        status: 'authenticated',
      })
    );

    render(<PostHogUserSync />);

    act(() => {
      (posthog as { __loaded?: boolean }).__loaded = true;
      globalThis.dispatchEvent(new Event(POSTHOG_READY_EVENT));
    });

    await waitFor(() => expect(posthog.identify).toHaveBeenCalledTimes(1));
    act(() => {
      globalThis.dispatchEvent(
        new StorageEvent('storage', { key: COOKIE_CONSENT_KEY, newValue: 'false' })
      );
    });

    await waitFor(() => expect(posthog.reset).toHaveBeenCalledTimes(1));
  });

  it('uses email as a fallback distinct id', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: {
          email: 'vet@example.com',
        },
        status: 'signin-authenticated',
      })
    );

    render(<PostHogUserSync />);

    act(() => {
      (posthog as { __loaded?: boolean }).__loaded = true;
      globalThis.dispatchEvent(new Event(POSTHOG_READY_EVENT));
    });

    await waitFor(() =>
      expect(posthog.identify).toHaveBeenCalledWith('vet@example.com', {
        email: 'vet@example.com',
      })
    );
  });

  it('does not identify the same user twice', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: {
          sub: 'user-sub-1',
          email: 'vet@example.com',
        },
        status: 'authenticated',
      })
    );

    const { rerender } = render(<PostHogUserSync />);

    act(() => {
      (posthog as { __loaded?: boolean }).__loaded = true;
      globalThis.dispatchEvent(new Event(POSTHOG_READY_EVENT));
    });

    await waitFor(() => expect(posthog.identify).toHaveBeenCalledTimes(1));
    rerender(<PostHogUserSync />);

    expect(posthog.identify).toHaveBeenCalledTimes(1);
  });

  it('resets analytics state when the user becomes unauthenticated after identification', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: {
          sub: 'user-sub-1',
          email: 'vet@example.com',
        },
        status: 'authenticated',
      })
    );

    const { rerender } = render(<PostHogUserSync />);

    act(() => {
      (posthog as { __loaded?: boolean }).__loaded = true;
      globalThis.dispatchEvent(new Event(POSTHOG_READY_EVENT));
    });

    await waitFor(() => expect(posthog.identify).toHaveBeenCalledTimes(1));
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: null,
        status: 'unauthenticated',
      })
    );
    rerender(<PostHogUserSync />);

    expect(posthog.reset).toHaveBeenCalledTimes(1);
  });

  it('does not reset analytics state before any user has been identified', async () => {
    globalThis.localStorage.setItem(COOKIE_CONSENT_KEY, 'true');
    (posthog as { __loaded?: boolean }).__loaded = true;
    mockUseAuthStore.mockImplementation((selector: (state: unknown) => unknown) =>
      selector({
        attributes: null,
        status: 'unauthenticated',
      })
    );

    render(<PostHogUserSync />);

    await waitFor(() => expect(posthog.reset).not.toHaveBeenCalled());
  });
});
