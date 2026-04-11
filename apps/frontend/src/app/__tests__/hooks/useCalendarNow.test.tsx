import { act, renderHook } from '@testing-library/react';
import { useCalendarNow } from '@/app/features/appointments/components/Calendar/useCalendarNow';

describe('useCalendarNow', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.spyOn(Date, 'now').mockReturnValue(1700000060000);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('initializes with current date and updates on minute boundary timer', () => {
    const { result } = renderHook(() => useCalendarNow());
    expect(result.current.getTime()).toBe(1700000060000);

    (Date.now as jest.Mock).mockReturnValue(1700000120000);
    act(() => {
      jest.advanceTimersByTime(60000);
    });

    expect(result.current.getTime()).toBe(1700000120000);
  });

  it('reschedules and updates when document becomes visible and timezone changes', () => {
    const { result } = renderHook(() => useCalendarNow());

    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => 'visible',
    });

    (Date.now as jest.Mock).mockReturnValue(1700000180000);
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.getTime()).toBe(1700000180000);

    (Date.now as jest.Mock).mockReturnValue(1700000240000);
    act(() => {
      globalThis.dispatchEvent(new Event('yc:timezone-changed'));
    });
    expect(result.current.getTime()).toBe(1700000240000);
  });
});
