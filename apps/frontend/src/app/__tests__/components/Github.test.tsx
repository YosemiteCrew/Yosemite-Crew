import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom';
import Github from '@/app/ui/widgets/Github/Github';

jest.mock('next/image', () => ({
  __esModule: true,
  default: (props: any) => {
    return <img {...props} alt={props.alt} />;
  },
}));

jest.mock('@/app/ui/icons/Icon', () => ({
  Icon: (props: any) => <i data-testid="mock-icon" data-icon={props.icon} />,
}));

jest.mock('react-icons/io5', () => ({
  IoCloseSharp: () => <svg data-testid="close-icon" />,
}));

const mockFetch = jest.fn();
globalThis.fetch = mockFetch;

describe('Github Component', () => {
  beforeEach(() => {
    mockFetch.mockClear();
    localStorage.clear();
    jest.useFakeTimers();
    // The widget defers its fetch via requestIdleCallback (falling back to a timer).
    // Run the idle callback synchronously so the fetch fires on mount as the tests expect.
    (globalThis.window as any).requestIdleCallback = (cb: () => void) => {
      cb();
      return 1;
    };
    (globalThis.window as any).cancelIdleCallback = jest.fn();
  });

  afterEach(() => {
    jest.useRealTimers();
    delete (globalThis.window as any).requestIdleCallback;
    delete (globalThis.window as any).cancelIdleCallback;
  });

  it('should render the banner and show a loading state initially', async () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    render(<Github />);

    expect(screen.getByText('Star us on Github')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Star/i })).toBeInTheDocument();
    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
  });

  it('should fetch and display the formatted star count successfully', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 12345 }),
    });

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText(/12.3k/i)).toBeInTheDocument();
    });

    expect(localStorage.getItem('gh:stars:YosemiteCrew/Yosemite-Crew')).toContain('12345');
  });

  it('should display cached count then update from fetch', async () => {
    const cachedValue = { value: 987, ts: Date.now() };
    localStorage.setItem('gh:stars:YosemiteCrew/Yosemite-Crew', JSON.stringify(cachedValue));
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 1234 }),
    });

    render(<Github />);

    expect(screen.getByText('987')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/1.2k/i)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should ignore expired cache and fetch new data', async () => {
    const expiredCache = { value: 500, ts: Date.now() - 2 * 60 * 60 * 1000 };
    localStorage.setItem('gh:stars:YosemiteCrew/Yosemite-Crew', JSON.stringify(expiredCache));

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 1500 }),
    });

    render(<Github />);

    expect(screen.getByText('…')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText(/1.5k/i)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle corrupted cache by fetching new data', async () => {
    localStorage.setItem('gh:stars:YosemiteCrew/Yosemite-Crew', 'invalid-json');

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 2000 }),
    });

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText(/2k/i)).toBeInTheDocument();
    });
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should handle API returning a non-finite star count', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 'not-a-number' }),
    });

    render(<Github />);
    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  it('should not crash if localStorage is unavailable or full', async () => {
    const setItemSpy = jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });

    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 3000 }),
    });

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText(/3k/i)).toBeInTheDocument();
    });

    expect(setItemSpy).toHaveBeenCalled();
    setItemSpy.mockRestore();
  });

  it('should display an error state if the fetch fails', async () => {
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  it('should display an error state if the API response is not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
    });

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument();
    });
  });

  it('should close the banner when the close button is clicked', async () => {
    const user = userEvent.setup({ advanceTimers: jest.advanceTimersByTime });
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 100 }),
    });
    render(<Github />);

    await waitFor(() => expect(screen.getByText('100')).toBeInTheDocument());

    const banner = screen.getByText('Star us on Github');
    expect(banner).toBeInTheDocument();

    const closeButton = screen.getByRole('button', { name: 'Close' });
    await user.click(closeButton);

    expect(banner).not.toBeInTheDocument();
  });

  // The 10s abort timer used to be cleared only on the path where the fetch
  // resolved, so a rejected request (or an unmount mid-request) left it pending.
  const abortTimerIdsFrom = (spy: jest.SpyInstance) =>
    spy.mock.calls.flatMap((call, i) => (call[1] === 10_000 ? [spy.mock.results[i].value] : []));

  it('clears the fetch abort timer when the request rejects', async () => {
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    mockFetch.mockRejectedValue(new Error('Network error'));

    render(<Github />);

    await waitFor(() => {
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    const abortTimerIds = abortTimerIdsFrom(setTimeoutSpy);
    expect(abortTimerIds).toHaveLength(1);
    expect(clearTimeoutSpy).toHaveBeenCalledWith(abortTimerIds[0]);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('clears a still-pending fetch abort timer on unmount', () => {
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    // A fetch that never settles leaves the abort timer live, so only the
    // effect cleanup can release it.
    mockFetch.mockReturnValue(new Promise(() => {}));

    const { unmount } = render(<Github />);

    const abortTimerIds = abortTimerIdsFrom(setTimeoutSpy);
    expect(abortTimerIds).toHaveLength(1);

    clearTimeoutSpy.mockClear();
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(abortTimerIds[0]);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('falls back to a timer when requestIdleCallback is unavailable', async () => {
    delete (globalThis.window as any).requestIdleCallback;
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 4200 }),
    });

    render(<Github />);
    expect(mockFetch).not.toHaveBeenCalled();

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(screen.getByText(/4.2k/i)).toBeInTheDocument();
    });
  });

  it('cancels a pending idle callback on unmount', () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    (globalThis.window as any).requestIdleCallback = () => 7;

    const { unmount } = render(<Github />);
    unmount();

    expect((globalThis.window as any).cancelIdleCallback).toHaveBeenCalledWith(7);
  });

  it('clears the deferred-load fallback timer on unmount', () => {
    delete (globalThis.window as any).requestIdleCallback;
    const setTimeoutSpy = jest.spyOn(globalThis, 'setTimeout');
    const clearTimeoutSpy = jest.spyOn(globalThis, 'clearTimeout');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 1 }),
    });

    const { unmount } = render(<Github />);

    const fallbackIds = setTimeoutSpy.mock.calls.flatMap((call, i) =>
      call[1] === 1000 ? [setTimeoutSpy.mock.results[i].value] : []
    );
    expect(fallbackIds).toHaveLength(1);

    clearTimeoutSpy.mockClear();
    unmount();
    expect(clearTimeoutSpy).toHaveBeenCalledWith(fallbackIds[0]);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it('should clear interval on unmount', () => {
    const clearIntervalSpy = jest.spyOn(globalThis, 'clearInterval');
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 100 }),
    });
    const { unmount } = render(<Github />);

    unmount();
    expect(clearIntervalSpy).toHaveBeenCalled();
    clearIntervalSpy.mockRestore();
  });
});
