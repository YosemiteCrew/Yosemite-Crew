import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import {
  ensureSessionChecked,
  resetLazyAuthStoreForTests,
  useLazyAuthSlice,
} from '@/app/hooks/useLazyAuthStore';

type FakeState = { status: string; role: string | null; checkSession: jest.Mock };

const mockCheckSession = jest.fn();
let state: FakeState;
const listeners = new Set<() => void>();

const setState = (partial: Partial<FakeState>) => {
  state = { ...state, ...partial };
  listeners.forEach((listener) => listener());
};

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  },
}));

const selectRole = (s: unknown) => (s as FakeState).role;

const RoleProbe = () => {
  const role = useLazyAuthSlice(selectRole as never, 'pending' as string | null);
  return <span data-testid="role">{role ?? 'none'}</span>;
};

describe('useLazyAuthStore', () => {
  beforeEach(() => {
    listeners.clear();
    mockCheckSession.mockReset().mockResolvedValue(null);
    state = { status: 'idle', role: null, checkSession: mockCheckSession };
    resetLazyAuthStoreForTests();
  });

  it('returns the fallback until the auth store chunk has loaded', async () => {
    render(<RoleProbe />);

    // Synchronously after the first render the dynamic import has not resolved.
    expect(screen.getByTestId('role')).toHaveTextContent('pending');

    // Let the import settle so its state update lands inside act.
    await act(async () => {});
  });

  it('swaps in the selected slice once the store loads', async () => {
    setState({ role: 'developer' });

    await act(async () => {
      render(<RoleProbe />);
    });

    expect(screen.getByTestId('role')).toHaveTextContent('developer');
  });

  it('re-renders when the subscribed slice changes', async () => {
    render(<RoleProbe />);
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('none'));

    await act(async () => {
      setState({ role: 'vet' });
    });

    expect(screen.getByTestId('role')).toHaveTextContent('vet');
  });

  it('does not re-render when the slice is unchanged', async () => {
    // Counted in an effect rather than during render: an effect without deps
    // runs after every committed render, so its length is the commit count.
    const commits: (string | null)[] = [];
    const CountingProbe = () => {
      const role = useLazyAuthSlice(selectRole as never, null as string | null);
      React.useEffect(() => {
        commits.push(role);
      });
      return <span data-testid="role">{role ?? 'none'}</span>;
    };

    render(<CountingProbe />);
    await waitFor(() => expect(screen.getByTestId('role')).toHaveTextContent('none'));
    const before = commits.length;

    await act(async () => {
      setState({ status: 'unauthenticated' }); // role untouched
    });

    expect(commits.length).toBe(before);
  });

  it('unsubscribes on unmount', async () => {
    const { unmount } = render(<RoleProbe />);
    await waitFor(() => expect(listeners.size).toBe(1));

    unmount();

    expect(listeners.size).toBe(0);
  });

  it('starts the session check only when the status is idle', async () => {
    await ensureSessionChecked();
    expect(mockCheckSession).toHaveBeenCalledTimes(1);

    setState({ status: 'authenticated' });
    await ensureSessionChecked();

    expect(mockCheckSession).toHaveBeenCalledTimes(1);
  });
});
