import { renderHook } from '@testing-library/react';
import { useNotifications } from '@/app/ui/layout/Notifications/useNotifications';

describe('useNotifications', () => {
  it('reports an empty feed until a real source is wired', () => {
    const { result } = renderHook(() => useNotifications());

    expect(result.current.items).toEqual([]);
    expect(result.current.unreadCount).toBe(0);
    expect(result.current.hasFeed).toBe(false);
    expect(() => result.current.markAllRead()).not.toThrow();
  });

  it('returns a stable snapshot across renders', () => {
    const { result, rerender } = renderHook(() => useNotifications());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
