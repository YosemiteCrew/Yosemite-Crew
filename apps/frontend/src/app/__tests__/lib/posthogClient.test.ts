import posthog from 'posthog-js';
import { getLoadedPostHog, loadPostHog, resetPostHogClientForTests } from '@/app/lib/posthogClient';

jest.mock('posthog-js', () => ({
  __esModule: true,
  default: { init: jest.fn() },
}));

describe('posthogClient', () => {
  beforeEach(() => {
    resetPostHogClientForTests();
  });

  it('reports no client until the analytics chunk has been loaded', () => {
    expect(getLoadedPostHog()).toBeNull();
  });

  it('resolves the posthog client on load and exposes it synchronously afterwards', async () => {
    const loaded = await loadPostHog();

    expect(loaded).toBe(posthog);
    expect(getLoadedPostHog()).toBe(posthog);
  });

  it('reuses the same client across repeated loads', async () => {
    const first = await loadPostHog();
    const second = await loadPostHog();

    expect(second).toBe(first);
  });

  it('clears the cached client when reset', async () => {
    await loadPostHog();
    expect(getLoadedPostHog()).not.toBeNull();

    resetPostHogClientForTests();

    expect(getLoadedPostHog()).toBeNull();
  });
});
