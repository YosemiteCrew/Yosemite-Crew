import { act } from '@testing-library/react';
import { usePhoneShellStore } from '@/app/ui/layout/PhoneShell/phoneShellStore';

describe('usePhoneShellStore', () => {
  afterEach(() => {
    act(() => usePhoneShellStore.getState().setChatUnread(0));
  });

  it('defaults the chat unread count to zero', () => {
    expect(usePhoneShellStore.getState().chatUnread).toBe(0);
  });

  it('stores a positive unread count', () => {
    act(() => usePhoneShellStore.getState().setChatUnread(5));
    expect(usePhoneShellStore.getState().chatUnread).toBe(5);
  });

  it('clamps negative counts to zero and truncates fractionals', () => {
    act(() => usePhoneShellStore.getState().setChatUnread(-3));
    expect(usePhoneShellStore.getState().chatUnread).toBe(0);

    act(() => usePhoneShellStore.getState().setChatUnread(4.9));
    expect(usePhoneShellStore.getState().chatUnread).toBe(4);
  });
});
