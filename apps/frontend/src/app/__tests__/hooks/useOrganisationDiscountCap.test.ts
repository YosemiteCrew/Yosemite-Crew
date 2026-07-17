import { act, renderHook, waitFor } from '@testing-library/react';

const discountSettingsMock = {
  getOrganisationDiscountSettings: jest.fn(),
};
jest.mock('@/app/features/finance/services/discountSettingsService', () => ({
  getOrganisationDiscountSettings: (...args: unknown[]) =>
    discountSettingsMock.getOrganisationDiscountSettings(...args),
  getDiscountSettingsErrorMessage: (error: unknown, fallback: string) =>
    error instanceof Error && error.message ? error.message : fallback,
}));

import { useOrganisationDiscountCap } from '@/app/features/finance/hooks/useOrganisationDiscountCap';

/** A promise plus the handles to settle it, so a test can unmount mid-flight. */
const deferred = <T>() => {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

beforeEach(() => {
  jest.clearAllMocks();
  discountSettingsMock.getOrganisationDiscountSettings.mockResolvedValue({
    organisationId: 'org-1',
    maxOverallDiscountPercent: 20,
  });
});

describe('useOrganisationDiscountCap', () => {
  it('loads the organisation cap', async () => {
    const { result } = renderHook(() => useOrganisationDiscountCap('org-1'));

    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.maxOverallDiscountPercent).toBe(20);
    expect(result.current.error).toBeNull();
    expect(discountSettingsMock.getOrganisationDiscountSettings).toHaveBeenCalledWith('org-1');
  });

  it('reports a null cap as unconstrained, not as zero', async () => {
    discountSettingsMock.getOrganisationDiscountSettings.mockResolvedValue({
      organisationId: 'org-1',
      maxOverallDiscountPercent: null,
    });

    const { result } = renderHook(() => useOrganisationDiscountCap('org-1'));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.maxOverallDiscountPercent).toBeNull();
  });

  it('does not fetch without an organisation id', async () => {
    const { result } = renderHook(() => useOrganisationDiscountCap(undefined));

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.maxOverallDiscountPercent).toBeNull();
    expect(discountSettingsMock.getOrganisationDiscountSettings).not.toHaveBeenCalled();
  });

  it('captures a load error and leaves the cap unconstrained', async () => {
    discountSettingsMock.getOrganisationDiscountSettings.mockRejectedValue(
      new Error('Organisation not found.')
    );

    const { result } = renderHook(() => useOrganisationDiscountCap('org-1'));

    await waitFor(() => expect(result.current.error).toBe('Organisation not found.'));
    expect(result.current.loading).toBe(false);
    // A failed lookup must not be mistaken for "capped at 0".
    expect(result.current.maxOverallDiscountPercent).toBeNull();
  });

  it('refetches on reload', async () => {
    discountSettingsMock.getOrganisationDiscountSettings
      .mockResolvedValueOnce({ organisationId: 'org-1', maxOverallDiscountPercent: 20 })
      .mockResolvedValueOnce({ organisationId: 'org-1', maxOverallDiscountPercent: 45 });

    const { result } = renderHook(() => useOrganisationDiscountCap('org-1'));
    await waitFor(() => expect(result.current.maxOverallDiscountPercent).toBe(20));

    act(() => result.current.reload());

    await waitFor(() => expect(result.current.maxOverallDiscountPercent).toBe(45));
    expect(discountSettingsMock.getOrganisationDiscountSettings).toHaveBeenCalledTimes(2);
  });

  it('refetches when the organisation changes', async () => {
    const { result, rerender } = renderHook(({ orgId }) => useOrganisationDiscountCap(orgId), {
      initialProps: { orgId: 'org-1' as string | undefined },
    });
    await waitFor(() => expect(result.current.loading).toBe(false));

    discountSettingsMock.getOrganisationDiscountSettings.mockResolvedValue({
      organisationId: 'org-2',
      maxOverallDiscountPercent: 5,
    });
    rerender({ orgId: 'org-2' });

    await waitFor(() => expect(result.current.maxOverallDiscountPercent).toBe(5));
    expect(discountSettingsMock.getOrganisationDiscountSettings).toHaveBeenLastCalledWith('org-2');
  });

  it('drops the previous org cap when a new org lookup fails, rather than keeping it stale', async () => {
    discountSettingsMock.getOrganisationDiscountSettings.mockResolvedValue({
      organisationId: 'org-1',
      maxOverallDiscountPercent: 10,
    });
    const { result, rerender } = renderHook(({ orgId }) => useOrganisationDiscountCap(orgId), {
      initialProps: { orgId: 'org-1' as string | undefined },
    });
    await waitFor(() => expect(result.current.maxOverallDiscountPercent).toBe(10));

    // Switch to an org whose lookup fails: the cap must go null (unconstrained),
    // not remain at org-1's 10% - otherwise the new org is wrongly capped.
    discountSettingsMock.getOrganisationDiscountSettings.mockRejectedValue(
      new Error('lookup failed')
    );
    rerender({ orgId: 'org-2' });

    await waitFor(() => expect(result.current.error).toBe('lookup failed'));
    expect(result.current.maxOverallDiscountPercent).toBeNull();
  });

  it('applies a locally saved cap via setCap without refetching', async () => {
    const { result } = renderHook(() => useOrganisationDiscountCap('org-1'));
    await waitFor(() => expect(result.current.maxOverallDiscountPercent).toBe(20));

    act(() => result.current.setCap(60));

    expect(result.current.maxOverallDiscountPercent).toBe(60);
    expect(discountSettingsMock.getOrganisationDiscountSettings).toHaveBeenCalledTimes(1);
  });

  it('ignores a resolution that lands after unmount', async () => {
    const pending = deferred<{ organisationId: string; maxOverallDiscountPercent: number }>();
    discountSettingsMock.getOrganisationDiscountSettings.mockReturnValue(pending.promise);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useOrganisationDiscountCap('org-1'));
    unmount();

    await act(async () => {
      pending.resolve({ organisationId: 'org-1', maxOverallDiscountPercent: 20 });
      await pending.promise;
    });

    // No state update on the unmounted hook => no React act/update warning.
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });

  it('ignores a rejection that lands after unmount', async () => {
    const pending = deferred<never>();
    discountSettingsMock.getOrganisationDiscountSettings.mockReturnValue(pending.promise);
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    const { unmount } = renderHook(() => useOrganisationDiscountCap('org-1'));
    unmount();

    await act(async () => {
      pending.reject(new Error('too late'));
      await pending.promise.catch(() => undefined);
    });

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
