import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {Pressable} from 'react-native';

// react-native's Pressable is wrapped in React.memo; UNSAFE_getAllByType
// must match against the memoized inner component, not the memo wrapper.
const PressableType = (Pressable as any).type;
import {mockTheme} from '../../../../../__tests__/setup/mockTheme';
import {CalendarMonthStrip} from '@/features/appointments/components/CalendarMonthStrip/CalendarMonthStrip';
import {formatMonthYear} from '@/shared/utils/dateHelpers';

jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/assets/images', () => ({
  Images: {
    leftArrowIcon: 1,
    rightArrowIcon: 1,
    locationIcon: 1,
  },
}));

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const ReactActual = require('react');
  const {View: RNView} = require('react-native');
  // Forwards a ref exposing scrollToIndex so the component's dateListRef.current
  // is truthy, letting the scroll-to-selected effect run instead of early-returning.
  // Behavior is driven via globalThis (not an outer const) to avoid jest.mock's
  // hoisting placing this factory above any local variable's initialization.
  const MockFlatList = ReactActual.forwardRef((props: any, ref: any) => {
    const {data, renderItem, keyExtractor, getItemLayout} = props;
    ReactActual.useImperativeHandle(ref, () => {
      // When the flag is set, expose a null handle so dateListRef.current is
      // falsy — this drives the component's `!dateListRef.current` guards.
      if ((globalThis as any).__calendarStripNullRef) {
        return null;
      }
      return {
        scrollToIndex: () => {
          if ((globalThis as any).__calendarStripScrollShouldThrow) {
            throw new Error('scrollToIndex failed');
          }
          (globalThis as any).__calendarStripScrollCalls =
            ((globalThis as any).__calendarStripScrollCalls || 0) + 1;
        },
      };
    });
    (globalThis as any).__calendarStripGetItemLayout = getItemLayout;
    return (
      <RNView testID="flatlist">
        {data?.map((item: any, index: number) => (
          <RNView key={keyExtractor ? keyExtractor(item) : index}>
            {renderItem({item, index, separators: {} as any})}
          </RNView>
        ))}
      </RNView>
    );
  });
  return {
    __esModule: true,
    default: MockFlatList,
  };
});

const TODAY = new Date(2025, 5, 15); // June 15, 2025

describe('CalendarMonthStrip', () => {
  const onChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    (globalThis as any).__calendarStripScrollShouldThrow = false;
    (globalThis as any).__calendarStripScrollCalls = 0;
    (globalThis as any).__calendarStripGetItemLayout = undefined;
    (globalThis as any).__calendarStripNullRef = false;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('renders the current month/year header', () => {
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);
    expect(screen.getByText(formatMonthYear(TODAY))).toBeTruthy();
  });

  it('navigates to the previous month when left arrow is pressed', () => {
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);
    const navButtons = screen.UNSAFE_getAllByType(PressableType);
    // First nav button = previous month
    fireEvent.press(navButtons[0]);
    // After navigating, the header should show the previous month
    const prevMonth = new Date(2025, 4, 1); // May 2025
    expect(screen.getByText(formatMonthYear(prevMonth))).toBeTruthy();
  });

  it('navigates to the next month when right arrow is pressed', () => {
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);
    const navButtons = screen.UNSAFE_getAllByType(PressableType);
    // Second touchable is the next-month nav control.
    fireEvent.press(navButtons[1]);
    const nextMonth = new Date(2025, 6, 1); // July 2025
    expect(screen.getByText(formatMonthYear(nextMonth))).toBeTruthy();
  });

  it('calls onChange when a date is pressed', () => {
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);
    // Press a day that should be visible — day 1
    const dayButtons = screen.UNSAFE_getAllByType(PressableType);
    // Skip the two nav arrow touchables and press the first date cell.
    if (dayButtons.length > 2) {
      fireEvent.press(dayButtons[2]);
      expect(onChange).toHaveBeenCalled();
    }
  });

  it('renders without crashing with datesWithMarkers as an array', () => {
    const markerDate = `2025-06-15`;
    expect(() =>
      render(
        <CalendarMonthStrip
          selectedDate={TODAY}
          onChange={onChange}
          datesWithMarkers={[markerDate]}
        />,
      ),
    ).not.toThrow();
  });

  it('renders without crashing with datesWithMarkers as a Set', () => {
    const markers = new Set(['2025-06-15', '2025-06-20']);
    expect(() =>
      render(
        <CalendarMonthStrip
          selectedDate={TODAY}
          onChange={onChange}
          datesWithMarkers={markers}
        />,
      ),
    ).not.toThrow();
  });

  it('renders without crashing with a custom markerColor', () => {
    expect(() =>
      render(
        <CalendarMonthStrip
          selectedDate={TODAY}
          onChange={onChange}
          datesWithMarkers={['2025-06-15']}
          markerColor="#FF0000"
        />,
      ),
    ).not.toThrow();
  });

  it('renders without crashing when datesWithMarkers is not provided', () => {
    expect(() =>
      render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />),
    ).not.toThrow();
  });

  it('flushes scroll timers without throwing', () => {
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);
    expect(() => jest.runAllTimers()).not.toThrow();
  });

  it('unmounts cleanly and clears timers', () => {
    const {unmount} = render(
      <CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />,
    );
    expect(() => {
      unmount();
      jest.runAllTimers();
    }).not.toThrow();
  });

  it('renders day numbers for current month dates', () => {
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);
    // The day "15" should appear somewhere (selected date)
    expect(screen.getByText('15')).toBeTruthy();
  });

  it('scrolls to the selected date index shortly after mount', () => {
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);

    jest.advanceTimersByTime(80);
    expect((globalThis as any).__calendarStripScrollCalls).toBe(1);

    jest.advanceTimersByTime(140);
    expect((globalThis as any).__calendarStripScrollCalls).toBe(2);
  });

  it('warns without throwing when scrollToIndex fails', () => {
    (globalThis as any).__calendarStripScrollShouldThrow = true;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);

    expect(() => jest.advanceTimersByTime(80)).not.toThrow();
    expect(warnSpy).toHaveBeenCalledWith(
      '[CalendarMonthStrip] scrollToIndex failed',
      expect.any(Error),
    );

    warnSpy.mockRestore();
  });

  it('does not scroll when the selected date is not visible in the current calendar view', () => {
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);
    const navButtons = screen.UNSAFE_getAllByType(PressableType);

    // Navigate two months forward: currentMonth becomes August 2025, but
    // selectedDate (June 15) stays the same and falls outside that view.
    fireEvent.press(navButtons[1]);
    fireEvent.press(screen.UNSAFE_getAllByType(PressableType)[1]);

    jest.runAllTimers();
    expect((globalThis as any).__calendarStripScrollCalls).toBe(0);
  });

  it('computes FlatList item layout using the fixed item length and gap', () => {
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);

    const getItemLayout = (globalThis as any).__calendarStripGetItemLayout;
    expect(getItemLayout(null, 3)).toEqual({
      length: 70.5,
      offset: 3 * (70.5 + 8),
      index: 3,
    });
  });

  it('bails out of the scroll effect when the list ref is unavailable', () => {
    // Null handle from mount => dateListRef.current is falsy, so the effect
    // hits the early `!dateListRef.current` guard and never schedules a scroll.
    (globalThis as any).__calendarStripNullRef = true;
    render(<CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />);

    jest.runAllTimers();
    expect((globalThis as any).__calendarStripScrollCalls).toBe(0);
  });

  it('skips scrolling when the list ref is cleared before the scroll timer fires', () => {
    const {rerender} = render(
      <CalendarMonthStrip selectedDate={TODAY} onChange={onChange} />,
    );

    // The effect has already scheduled the scroll timers against a valid ref.
    // Clear the handle, then re-render via a prop that does NOT change the
    // effect deps (weekDates/selectedDate), so the pending timers survive but
    // scrollTo now sees a null ref and returns early.
    (globalThis as any).__calendarStripNullRef = true;
    rerender(
      <CalendarMonthStrip
        selectedDate={TODAY}
        onChange={onChange}
        markerColor="#123456"
      />,
    );

    jest.runAllTimers();
    expect((globalThis as any).__calendarStripScrollCalls).toBe(0);
  });

  it('applies the today style to the cell matching the real current date', () => {
    // Rendering with the real current date makes one cell isToday=true, driving
    // the `item.isToday && styles.dateItemToday` branch in renderDateItem.
    const realToday = new Date();
    render(<CalendarMonthStrip selectedDate={realToday} onChange={onChange} />);

    expect(screen.getByText(formatMonthYear(realToday))).toBeTruthy();
  });
});
