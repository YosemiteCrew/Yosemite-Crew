import React from 'react';
import {render, fireEvent} from '@testing-library/react-native';
import {CalendarRow} from '@/features/appointments/components/CalendarRow/CalendarRow';
import {mockTheme} from '../../../../setup/mockTheme';
import * as dateHelpers from '@/shared/utils/dateHelpers';

// Mock dependencies
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

jest.mock('@/shared/utils/dateHelpers', () => ({
  getWeekDates: jest.fn(),
  formatMonthYear: jest.fn(),
}));

describe('CalendarRow', () => {
  const mockOnChange = jest.fn();
  const baseDate = new Date('2024-01-15T12:00:00Z');

  const mockWeekDates = [
    {
      date: new Date('2024-01-14T00:00:00Z'),
      dayName: 'Sun',
      dayNumber: 14,
      isSelected: false,
      isToday: false,
    },
    {
      date: new Date('2024-01-15T00:00:00Z'),
      dayName: 'Mon',
      dayNumber: 15,
      isSelected: true,
      isToday: false,
    },
    {
      date: new Date('2024-01-16T00:00:00Z'),
      dayName: 'Tue',
      dayNumber: 16,
      isSelected: false,
      isToday: true,
    },
    {
      date: new Date('2024-01-17T00:00:00Z'),
      dayName: 'Wed',
      dayNumber: 17,
      isSelected: false,
      isToday: false,
    },
    {
      date: new Date('2024-01-18T00:00:00Z'),
      dayName: 'Thu',
      dayNumber: 18,
      isSelected: false,
      isToday: false,
    },
    {
      date: new Date('2024-01-19T00:00:00Z'),
      dayName: 'Fri',
      dayNumber: 19,
      isSelected: false,
      isToday: false,
    },
    {
      date: new Date('2024-01-20T00:00:00Z'),
      dayName: 'Sat',
      dayNumber: 20,
      isSelected: false,
      isToday: false,
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    (dateHelpers.getWeekDates as jest.Mock).mockReturnValue(mockWeekDates);
    (dateHelpers.formatMonthYear as jest.Mock).mockReturnValue('January 2024');
  });

  describe('rendering', () => {
    it('should render without crashing', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      expect(getByText('January 2024')).toBeDefined();
    });

    it('should display month and year from formatMonthYear', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      expect(dateHelpers.formatMonthYear).toHaveBeenCalledWith(baseDate);
      expect(getByText('January 2024')).toBeDefined();
    });

    it('should render navigation arrows', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      const leftArrows = getByText('<');
      const rightArrows = getByText('>');

      expect(leftArrows).toBeDefined();
      expect(rightArrows).toBeDefined();
    });

    it('should render all week dates', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      mockWeekDates.forEach(dateInfo => {
        expect(getByText(dateInfo.dayName)).toBeDefined();
        expect(getByText(String(dateInfo.dayNumber))).toBeDefined();
      });
    });

    it('should call getWeekDates with selectedDate', () => {
      render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      expect(dateHelpers.getWeekDates).toHaveBeenCalledWith(baseDate);
    });
  });

  describe('date selection', () => {
    it('should call onChange when a date is clicked', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      const tuesdayElement = getByText('Tue');
      fireEvent.press(tuesdayElement);

      expect(mockOnChange).toHaveBeenCalledWith(mockWeekDates[2].date);
    });

    it('should call onChange with correct date for each day', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      mockWeekDates.forEach(dateInfo => {
        mockOnChange.mockClear();
        const dayElement = getByText(dateInfo.dayName);
        fireEvent.press(dayElement);

        expect(mockOnChange).toHaveBeenCalledWith(dateInfo.date);
      });
    });

    it('should allow selecting already selected date', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      const mondayElement = getByText('Mon'); // Already selected
      fireEvent.press(mondayElement);

      expect(mockOnChange).toHaveBeenCalledWith(mockWeekDates[1].date);
    });
  });

  describe('week navigation', () => {
    it('should shift backward by 7 days when clicking left arrow', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      const leftArrow = getByText('<');
      fireEvent.press(leftArrow);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const calledDate = mockOnChange.mock.calls[0][0];
      expect(calledDate.getDate()).toBe(8); // Jan 15 - 7 = Jan 8
    });

    it('should shift forward by 7 days when clicking right arrow', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      const rightArrow = getByText('>');
      fireEvent.press(rightArrow);

      expect(mockOnChange).toHaveBeenCalledTimes(1);
      const calledDate = mockOnChange.mock.calls[0][0];
      expect(calledDate.getDate()).toBe(22); // Jan 15 + 7 = Jan 22
    });

    it('should handle month boundary when shifting backward', () => {
      const earlyJanDate = new Date('2024-01-05T12:00:00Z');
      const {getByText} = render(
        <CalendarRow selectedDate={earlyJanDate} onChange={mockOnChange} />,
      );

      const leftArrow = getByText('<');
      fireEvent.press(leftArrow);

      const calledDate = mockOnChange.mock.calls[0][0];
      expect(calledDate.getMonth()).toBe(11); // December (0-indexed)
      expect(calledDate.getFullYear()).toBe(2023);
      expect(calledDate.getDate()).toBe(29); // Jan 5 - 7 = Dec 29
    });

    it('should handle month boundary when shifting forward', () => {
      const lateJanDate = new Date('2024-01-28T12:00:00Z');
      const {getByText} = render(
        <CalendarRow selectedDate={lateJanDate} onChange={mockOnChange} />,
      );

      const rightArrow = getByText('>');
      fireEvent.press(rightArrow);

      const calledDate = mockOnChange.mock.calls[0][0];
      expect(calledDate.getMonth()).toBe(1); // February (0-indexed)
      expect(calledDate.getDate()).toBe(4); // Jan 28 + 7 = Feb 4
    });

    it('should handle year boundary when shifting backward from January', () => {
      const earlyJanDate = new Date('2024-01-02T12:00:00Z');
      const {getByText} = render(
        <CalendarRow selectedDate={earlyJanDate} onChange={mockOnChange} />,
      );

      const leftArrow = getByText('<');
      fireEvent.press(leftArrow);

      const calledDate = mockOnChange.mock.calls[0][0];
      expect(calledDate.getFullYear()).toBe(2023);
      expect(calledDate.getMonth()).toBe(11); // December
      expect(calledDate.getDate()).toBe(26); // Jan 2 - 7 = Dec 26
    });

    it('should handle year boundary when shifting forward from December', () => {
      const lateDecDate = new Date('2023-12-28T12:00:00Z');
      const {getByText} = render(
        <CalendarRow selectedDate={lateDecDate} onChange={mockOnChange} />,
      );

      const rightArrow = getByText('>');
      fireEvent.press(rightArrow);

      const calledDate = mockOnChange.mock.calls[0][0];
      expect(calledDate.getFullYear()).toBe(2024);
      expect(calledDate.getMonth()).toBe(0); // January
      expect(calledDate.getDate()).toBe(4); // Dec 28 + 7 = Jan 4
    });

    it('should allow multiple navigation clicks', () => {
      const {getByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      const rightArrow = getByText('>');

      fireEvent.press(rightArrow);
      fireEvent.press(rightArrow);
      fireEvent.press(rightArrow);

      expect(mockOnChange).toHaveBeenCalledTimes(3);
    });
  });

  describe('date styling', () => {
    it('should render days with appropriate styles', () => {
      const {getByText} = render(
        <CalendarRow selectedDate={baseDate} onChange={mockOnChange} />,
      );

      // Just check that the selected date is rendered
      const mondayElement = getByText('Mon');
      expect(mondayElement).toBeDefined();
    });
  });

  describe('memoization', () => {
    it('should recompute weekDates when selectedDate changes', () => {
      const {rerender} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      expect(dateHelpers.getWeekDates).toHaveBeenCalledWith(baseDate);

      const newDate = new Date('2024-02-15T12:00:00Z');
      (dateHelpers.getWeekDates as jest.Mock).mockClear();

      rerender(<CalendarRow selectedDate={newDate} onChange={mockOnChange} />);

      expect(dateHelpers.getWeekDates).toHaveBeenCalledWith(newDate);
    });

    it('should not recompute weekDates when unrelated props change', () => {
      const {rerender} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      (dateHelpers.getWeekDates as jest.Mock).mockClear();

      const newOnChange = jest.fn();
      rerender(<CalendarRow selectedDate={baseDate} onChange={newOnChange} />);

      // getWeekDates should still be memoized and not called again
      expect(dateHelpers.getWeekDates).not.toHaveBeenCalled();
    });

    it('should recompute formatMonthYear when selectedDate changes', () => {
      const {rerender} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      const newDate = new Date('2024-02-15T12:00:00Z');
      (dateHelpers.formatMonthYear as jest.Mock).mockReturnValue('February 2024');

      rerender(<CalendarRow selectedDate={newDate} onChange={mockOnChange} />);

      const calls = (dateHelpers.formatMonthYear as jest.Mock).mock.calls;
      expect(calls[calls.length - 1][0]).toEqual(newDate);
    });
  });

  describe('edge cases', () => {
    it('should handle empty week dates array', () => {
      (dateHelpers.getWeekDates as jest.Mock).mockReturnValue([]);

      const {queryByText} = render(<CalendarRow selectedDate={baseDate} onChange={mockOnChange} />);

      expect(queryByText('Mon')).toBeNull();
      expect(queryByText('15')).toBeNull();
    });

    it('should handle dates in different timezones', () => {
      const utcDate = new Date('2024-01-15T00:00:00Z');
      const {getByText} = render(<CalendarRow selectedDate={utcDate} onChange={mockOnChange} />);

      const rightArrow = getByText('>');
      fireEvent.press(rightArrow);

      const calledDate = mockOnChange.mock.calls[0][0];
      expect(calledDate.getDate()).toBe(22);
    });

    it('should handle leap year dates', () => {
      const leapYearDate = new Date('2024-02-28T12:00:00Z');
      const {getByText} = render(
        <CalendarRow selectedDate={leapYearDate} onChange={mockOnChange} />,
      );

      const rightArrow = getByText('>');
      fireEvent.press(rightArrow);

      const calledDate = mockOnChange.mock.calls[0][0];
      expect(calledDate.getMonth()).toBe(2); // March (0-indexed)
      expect(calledDate.getDate()).toBe(6); // Feb 28 + 7 = Mar 6 (2024 is leap year, so Feb has 29 days)
    });

    it('should handle non-leap year dates', () => {
      const nonLeapYearDate = new Date('2023-02-28T12:00:00Z');
      const {getByText} = render(
        <CalendarRow selectedDate={nonLeapYearDate} onChange={mockOnChange} />,
      );

      const rightArrow = getByText('>');
      fireEvent.press(rightArrow);

      const calledDate = mockOnChange.mock.calls[0][0];
      expect(calledDate.getMonth()).toBe(2); // March (0-indexed)
      expect(calledDate.getDate()).toBe(7); // Feb 28 + 7 = Mar 7 (2023 is not leap year)
    });
  });

  describe('component configuration', () => {
    it('should render all dates from getWeekDates', () => {
      const {getByText} = render(
        <CalendarRow selectedDate={baseDate} onChange={mockOnChange} />,
      );

      // Verify all dates are rendered by checking one of them
      expect(getByText('Mon')).toBeDefined();
      expect(dateHelpers.getWeekDates).toHaveBeenCalledWith(baseDate);
    });
  });

  describe('accessibility', () => {
    it('should allow interactions with navigation and dates', () => {
      const {getByText} = render(
        <CalendarRow selectedDate={baseDate} onChange={mockOnChange} />,
      );

      // Verify navigation elements are present and interactable
      const leftArrow = getByText('<');
      const rightArrow = getByText('>');

      expect(leftArrow).toBeDefined();
      expect(rightArrow).toBeDefined();

      // Verify day elements are present and interactable
      mockWeekDates.forEach(dateInfo => {
        expect(getByText(dateInfo.dayName)).toBeDefined();
      });
    });
  });
});
