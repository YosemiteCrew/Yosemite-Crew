import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {AppState, Text} from 'react-native';
import {AppLockGate} from '@/features/appLock/AppLockGate';
import {useTheme} from '@/hooks';
import {useAuth} from '@/features/auth/context/AuthContext';
import {useAppDispatch, useAppSelector} from '@/app/hooks';
import {unlock} from '@/features/appLock/services/appLockKeychain';
import {monotonicNow} from '@/features/appLock/services/privacyScreen';

jest.mock('@/hooks', () => ({useTheme: jest.fn()}));
jest.mock('@/features/auth/context/AuthContext', () => ({useAuth: jest.fn()}));
jest.mock('@/app/hooks', () => ({
  useAppDispatch: jest.fn(),
  useAppSelector: jest.fn(),
}));
jest.mock('@/features/appLock/services/appLockKeychain', () => ({
  unlock: jest.fn(),
}));
jest.mock('@/features/appLock/services/privacyScreen', () => ({
  setPrivacy: jest.fn(() => Promise.resolve(true)),
  monotonicNow: jest.fn(() => Promise.resolve(1000)),
  coverRendered: jest.fn(() => Promise.resolve(true)),
}));
jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

const state = {
  appLock: {enabled: true, timeoutMs: 60000, ownerId: 'owner'},
  appLockStatus: {locked: true, covered: true, authenticating: false},
};
const dispatch = jest.fn();
const logout = jest.fn(() => Promise.resolve());

describe('AppLockGate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    state.appLock.enabled = true;
    state.appLockStatus.locked = true;
    (useTheme as jest.Mock).mockReturnValue({
      theme: {
        colors: {
          screen: '#fff',
          ink: '#111',
          inkMuted: '#666',
          blue: '#00f',
          white: '#fff',
        },
      },
    });
    (useAuth as jest.Mock).mockReturnValue({
      isLoggedIn: true,
      logout,
      user: {id: 'owner'},
    });
    (useAppDispatch as jest.Mock).mockReturnValue(dispatch);
    (useAppSelector as jest.Mock).mockImplementation(
      (selector: (value: typeof state) => unknown) => selector(state),
    );
    (unlock as jest.Mock).mockResolvedValue({ok: true});
    jest
      .spyOn(AppState, 'addEventListener')
      .mockImplementation(
        () =>
          ({remove: jest.fn()}) as ReturnType<typeof AppState.addEventListener>,
      );
  });

  it('unlocks after a successful device check', async () => {
    const {getByRole} = render(
      <AppLockGate>
        <></>
      </AppLockGate>,
    );
    await act(async () => {
      fireEvent.press(getByRole('button', {name: 'appLock.unlock'}));
    });
    expect(unlock).toHaveBeenCalled();
    expect(dispatch).toHaveBeenCalled();
  });

  it('renders children when the lock is disabled', () => {
    (useAppSelector as jest.Mock)
      .mockReturnValueOnce({enabled: false, timeoutMs: 60000, ownerId: null})
      .mockReturnValueOnce(state.appLockStatus);
    const {getByText} = render(
      <AppLockGate>
        <Text>content</Text>
      </AppLockGate>,
    );
    expect(getByText('content')).toBeTruthy();
  });

  it('renders children for a logged-out user', () => {
    (useAuth as jest.Mock).mockReturnValue({isLoggedIn: false, logout});
    const {getByText} = render(
      <AppLockGate>
        <Text>content</Text>
      </AppLockGate>,
    );
    expect(getByText('content')).toBeTruthy();
  });

  it('renders children after the gate is unlocked', () => {
    (useAppSelector as jest.Mock)
      .mockReturnValueOnce(state.appLock)
      .mockReturnValueOnce({
        locked: false,
        covered: false,
        authenticating: false,
      });
    const {getByText} = render(
      <AppLockGate>
        <Text>content</Text>
      </AppLockGate>,
    );
    expect(getByText('content')).toBeTruthy();
  });

  it('keeps the lock visible after a failed check and allows sign out', async () => {
    (unlock as jest.Mock).mockResolvedValue({ok: false, reason: 'cancelled'});
    const {getByRole} = render(
      <AppLockGate>
        <></>
      </AppLockGate>,
    );
    await act(async () => {
      fireEvent.press(getByRole('button', {name: 'appLock.unlock'}));
    });
    expect(getByText('appLock.failure.cancelled')).toBeTruthy();
    fireEvent.press(getByRole('button', {name: 'appLock.signOut'}));
    expect(logout).toHaveBeenCalled();
  });

  it('does not re-lock or remount content when only the timeout changes', () => {
    state.appLockStatus.locked = false;
    const {getByText, rerender} = render(
      <AppLockGate>
        <Text>content</Text>
      </AppLockGate>,
    );
    const wrapper = getByText('content').parent;
    const lockDispatches = dispatch.mock.calls.filter(
      ([action]) => action?.type === 'appLockStatus/appLocked',
    ).length;
    state.appLock.timeoutMs = 300000;
    rerender(
      <AppLockGate>
        <Text>content</Text>
      </AppLockGate>,
    );
    expect(getByText('content').parent).toBe(wrapper);
    expect(
      dispatch.mock.calls.filter(
        ([action]) => action?.type === 'appLockStatus/appLocked',
      ),
    ).toHaveLength(lockDispatches);
  });

  it('does not offer an unlock path to another signed-in account', () => {
    (useAuth as jest.Mock).mockReturnValue({
      isLoggedIn: true,
      logout,
      user: {id: 'different-account'},
    });
    const {getByRole} = render(
      <AppLockGate>
        <Text>content</Text>
      </AppLockGate>,
    );
    expect(
      getByRole('button', {name: 'appLock.unlock'}).props.accessibilityState
        .disabled,
    ).toBe(true);
  });

  it('locks again when the measured background interval expires', async () => {
    const {getByRole} = render(
      <AppLockGate>
        <Text>content</Text>
      </AppLockGate>,
    );
    const onChange = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
    await act(async () => {
      await onChange('unknown' as any);
      await onChange('background');
      await onChange('active');
    });
    expect(getByRole('button', {name: 'appLock.unlock'})).toBeTruthy();
  });

  it('fails closed when the monotonic clock is unavailable', async () => {
    (monotonicNow as jest.Mock).mockResolvedValue(null);
    const {unmount} = render(
      <AppLockGate>
        <Text>content</Text>
      </AppLockGate>,
    );
    const onChange = (AppState.addEventListener as jest.Mock).mock.calls[0][1];
    await act(async () => {
      await onChange('background');
      await onChange('active');
    });
    expect(dispatch).toHaveBeenCalled();
    unmount();
  });
});
