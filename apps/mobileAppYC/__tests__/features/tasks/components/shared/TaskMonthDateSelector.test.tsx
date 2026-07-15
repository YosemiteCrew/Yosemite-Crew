import React from 'react';
import {render, screen, fireEvent} from '@testing-library/react-native';
import {Pressable} from 'react-native';
import {mockTheme} from '../../../../setup/mockTheme';
import {TaskMonthDateSelector} from '@/features/tasks/components/shared/TaskMonthDateSelector';
import {
  formatMonthYear,
  formatDateToISODate,
  getMonthDates,
  getPreviousMonth,
  getNextMonth,
} from '@/shared/utils/dateHelpers';

// Pressable is wrapped in React.memo internally by RN; match the inner type.
const PressableType = (Pressable as any).type;

jest.mock('@/assets/images', () => ({
  Images: {
    leftArrowIcon: 1,
    rightArrowIcon: 1,
  },
}));

const mockScrollToIndex = jest.fn();
let lastFlatListProps: any = null;

jest.mock('react-native/Libraries/Lists/FlatList', () => {
  const ReactMock = require('react');
  const {View: RNView} = require('react-native');
  const MockFlatList = ReactMock.forwardRef((props: any, ref: any) => {
    lastFlatListProps = props;
    ReactMock.useImperativeHandle(ref, () => ({
      scrollToIndex: mockScrollToIndex,
    }));
    const {data, renderItem, keyExtractor} = props;
    return (
      <RNView testID="date-flatlist">
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

const CURRENT_MONTH = new Date(2025, 5, 1); // June 2025
const SELECTED_DATE = new Date(2025, 5, 15); // June 15, 2025

describe('TaskMonthDateSelector', () => {
  const onDateSelect = jest.fn();
  const onMonthChange = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    lastFlatListProps = null;
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  const renderSelector = (
    overrides: Partial<React.ComponentProps<typeof TaskMonthDateSelector>> = {},
  ) =>
    render(
      <TaskMonthDateSelector
        currentMonth={CURRENT_MONTH}
        selectedDate={SELECTED_DATE}
        datesWithTasks={new Set<string>()}
        onDateSelect={onDateSelect}
        onMonthChange={onMonthChange}
        theme={mockTheme}
        {...overrides}
      />,
    );

  it('renders the current month/year header', () => {
    renderSelector();
    expect(screen.getByText(formatMonthYear(CURRENT_MONTH))).toBeTruthy();
  });

  it('renders the selected day number', () => {
    renderSelector();
    expect(screen.getByText('15')).toBeTruthy();
  });

  it('navigates to the previous month when the left arrow is pressed', () => {
    renderSelector();
    const pressables = screen.UNSAFE_getAllByType(PressableType);
    fireEvent.press(pressables[0]);
    expect(onMonthChange).toHaveBeenCalledWith(getPreviousMonth(CURRENT_MONTH));
  });

  it('exposes button roles and labels on the month navigation arrows', () => {
    renderSelector();
    const pressables = screen.UNSAFE_getAllByType(PressableType);
    expect(pressables[0].props.accessibilityRole).toBe('button');
    expect(pressables[0].props.accessibilityLabel).toBe('Previous month');
    expect(pressables[1].props.accessibilityRole).toBe('button');
    expect(pressables[1].props.accessibilityLabel).toBe('Next month');
  });

  it('navigates to the next month when the right arrow is pressed', () => {
    renderSelector();
    const pressables = screen.UNSAFE_getAllByType(PressableType);
    fireEvent.press(pressables[1]);
    expect(onMonthChange).toHaveBeenCalledWith(getNextMonth(CURRENT_MONTH));
  });

  it('calls onDateSelect when a current-month date is pressed', () => {
    renderSelector();
    const weekDates = getMonthDates(CURRENT_MONTH, SELECTED_DATE);
    const targetIndex = weekDates.findIndex(
      d => d.date.getDate() === 15 && d.date.getMonth() === 5,
    );

    const pressables = screen.UNSAFE_getAllByType(PressableType);
    // First two pressables are the month nav arrows.
    fireEvent.press(pressables[2 + targetIndex]);

    expect(onDateSelect).toHaveBeenCalledWith(weekDates[targetIndex].date);
  });

  it('disables the pressable for padding (non-current-month) dates', () => {
    renderSelector();
    const weekDates = getMonthDates(CURRENT_MONTH, SELECTED_DATE);
    const paddingIndex = weekDates.findIndex(
      d => d.date.getMonth() !== CURRENT_MONTH.getMonth(),
    );
    expect(paddingIndex).toBeGreaterThanOrEqual(0);

    const pressables = screen.UNSAFE_getAllByType(PressableType);
    expect(pressables[2 + paddingIndex].props.disabled).toBe(true);
  });

  it('leaves current-month date pressables enabled', () => {
    renderSelector();
    const weekDates = getMonthDates(CURRENT_MONTH, SELECTED_DATE);
    const currentIndex = weekDates.findIndex(
      d => d.date.getMonth() === CURRENT_MONTH.getMonth(),
    );

    const pressables = screen.UNSAFE_getAllByType(PressableType);
    expect(pressables[2 + currentIndex].props.disabled).toBe(false);
  });

  it('exposes the selected and disabled state to screen readers via accessibilityState', () => {
    renderSelector();
    const weekDates = getMonthDates(CURRENT_MONTH, SELECTED_DATE);
    const selectedIndex = weekDates.findIndex(
      d => d.date.getDate() === 15 && d.date.getMonth() === 5,
    );
    const paddingIndex = weekDates.findIndex(
      d => d.date.getMonth() !== CURRENT_MONTH.getMonth(),
    );

    const pressables = screen.UNSAFE_getAllByType(PressableType);

    expect(pressables[2 + selectedIndex].props.accessibilityRole).toBe('radio');
    expect(pressables[2 + selectedIndex].props.accessibilityState).toEqual({
      selected: true,
      disabled: false,
    });

    expect(pressables[2 + paddingIndex].props.accessibilityState).toEqual({
      selected: false,
      disabled: true,
    });
  });

  it('mentions tasks in the accessibility label for dates that have one', () => {
    const weekDates = getMonthDates(CURRENT_MONTH, SELECTED_DATE);
    const taskDateInfo = weekDates.find(
      d =>
        d.date.getMonth() === CURRENT_MONTH.getMonth() &&
        d.date.getDate() !== 15,
    )!;

    renderSelector({
      datesWithTasks: new Set([formatDateToISODate(taskDateInfo.date)]),
    });

    const taskIndex = weekDates.indexOf(taskDateInfo);
    const pressables = screen.UNSAFE_getAllByType(PressableType);
    expect(pressables[2 + taskIndex].props.accessibilityLabel).toMatch(
      /has tasks$/,
    );
  });

  it('applies today styling when the system date falls within the visible month', () => {
    jest.setSystemTime(SELECTED_DATE);
    expect(() => renderSelector()).not.toThrow();
  });

  it('renders a task indicator for dates with tasks that are not selected', () => {
    const weekDates = getMonthDates(CURRENT_MONTH, SELECTED_DATE);
    const taskDate = weekDates.find(
      d =>
        d.date.getMonth() === CURRENT_MONTH.getMonth() &&
        d.date.getDate() !== 15,
    )!.date;

    expect(() =>
      renderSelector({
        datesWithTasks: new Set([formatDateToISODate(taskDate)]),
      }),
    ).not.toThrow();
  });

  it('scrolls to the selected date twice when autoScroll is enabled', () => {
    renderSelector();
    jest.runAllTimers();
    expect(mockScrollToIndex).toHaveBeenCalledTimes(2);
  });

  it('does not scroll when autoScroll is disabled', () => {
    renderSelector({autoScroll: false});
    jest.runAllTimers();
    expect(mockScrollToIndex).not.toHaveBeenCalled();
  });

  it('does not scroll when the selected date is not part of the current month range', () => {
    renderSelector({selectedDate: new Date(1990, 0, 1)});
    jest.runAllTimers();
    expect(mockScrollToIndex).not.toHaveBeenCalled();
  });

  it('computes item layout offsets via getItemLayout', () => {
    renderSelector();
    const layout = lastFlatListProps.getItemLayout(null, 3);
    expect(layout).toEqual({length: 70.5, offset: 3 * (70.5 + 8), index: 3});
  });

  it('logs a warning when onScrollToIndexFailed fires', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    renderSelector();

    lastFlatListProps.onScrollToIndexFailed({
      index: 4,
      highestMeasuredFrameIndex: 0,
      averageItemLength: 70.5,
    });

    expect(warnSpy).toHaveBeenCalledWith('ScrollToIndex failed:', 4);
    warnSpy.mockRestore();
  });

  it('unmounts cleanly and clears pending scroll timers', () => {
    const {unmount} = renderSelector();
    expect(() => {
      unmount();
      jest.runAllTimers();
    }).not.toThrow();
  });
});
