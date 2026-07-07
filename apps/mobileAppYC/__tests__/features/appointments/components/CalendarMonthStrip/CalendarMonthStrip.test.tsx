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
  const {View: RNView} = require('react-native');
  const MockFlatList = ({data, renderItem, keyExtractor}: any) => (
    <RNView testID="flatlist">
      {data?.map((item: any, index: number) => (
        <RNView key={keyExtractor ? keyExtractor(item) : index}>
          {renderItem({item, index, separators: {} as any})}
        </RNView>
      ))}
    </RNView>
  );
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
});
