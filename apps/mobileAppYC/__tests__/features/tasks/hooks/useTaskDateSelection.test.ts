import {renderHook, act} from '@testing-library/react-native';
import {useTaskDateSelection} from '@/features/tasks/hooks/useTaskDateSelection';

describe('useTaskDateSelection', () => {
  it('seeds selectedDate and currentMonth from the provided initialDate', () => {
    const initialDate = new Date(2024, 5, 15);
    const {result} = renderHook(() => useTaskDateSelection(initialDate));

    expect(result.current.selectedDate).toBe(initialDate);
    expect(result.current.currentMonth).toBe(initialDate);
  });

  it('seeds selectedDate and currentMonth to today when no initialDate is provided', () => {
    const before = Date.now();
    const {result} = renderHook(() => useTaskDateSelection());
    const after = Date.now();

    expect(result.current.selectedDate.getTime()).toBeGreaterThanOrEqual(
      before,
    );
    expect(result.current.selectedDate.getTime()).toBeLessThanOrEqual(after);
    expect(result.current.currentMonth).toBe(result.current.selectedDate);
  });

  it('handleMonthChange updates currentMonth and resets selectedDate to the first of that month', () => {
    const {result} = renderHook(() =>
      useTaskDateSelection(new Date(2024, 5, 15)),
    );

    act(() => {
      result.current.handleMonthChange(new Date(2024, 7, 20));
    });

    expect(result.current.currentMonth).toEqual(new Date(2024, 7, 20));
    expect(result.current.selectedDate).toEqual(new Date(2024, 7, 1));
  });

  it('handleDateSelect updates only selectedDate', () => {
    const {result} = renderHook(() =>
      useTaskDateSelection(new Date(2024, 5, 15)),
    );

    act(() => {
      result.current.handleDateSelect(new Date(2024, 5, 20));
    });

    expect(result.current.selectedDate).toEqual(new Date(2024, 5, 20));
    expect(result.current.currentMonth).toEqual(new Date(2024, 5, 15));
  });

  it('exposes raw setSelectedDate and setCurrentMonth setters', () => {
    const {result} = renderHook(() =>
      useTaskDateSelection(new Date(2024, 5, 15)),
    );

    act(() => {
      result.current.setSelectedDate(new Date(2024, 8, 1));
      result.current.setCurrentMonth(new Date(2024, 8, 1));
    });

    expect(result.current.selectedDate).toEqual(new Date(2024, 8, 1));
    expect(result.current.currentMonth).toEqual(new Date(2024, 8, 1));
  });
});
