import React from 'react';
import {Platform, useColorScheme} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
import {
  SimpleDatePicker,
  formatDateForDisplay,
  formatTimeForDisplay,
} from '../../../src/shared/components/common/SimpleDatePicker/SimpleDatePicker';

// --- Mocks ---

jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        'common.cancel': 'Cancel',
        'common.done': 'Done',
      };
      return translations[key] ?? key;
    },
  }),
}));

// 1. Mock DateTimePicker
// We use a mock component that passes props through so we can inspect them in tests
jest.mock('@react-native-community/datetimepicker', () => {
  const {View} = require('react-native');
  return (props: any) => {
    return <View testID="mock-datetime-picker" {...props} />;
  };
});

// 2. Mock useColorScheme
jest.mock('react-native/Libraries/Utilities/useColorScheme', () => ({
  default: jest.fn(),
}));

describe('SimpleDatePicker Component', () => {
  const mockOnDateChange = jest.fn();
  const mockOnDismiss = jest.fn();
  const defaultDate = new Date('2023-01-01T10:00:00');

  beforeEach(() => {
    jest.clearAllMocks();
    (useColorScheme as jest.Mock).mockReturnValue('light'); // Default
  });

  // ===========================================================================
  // 1. General Rendering & State Logic
  // ===========================================================================

  it('renders null when show is false', () => {
    const {toJSON} = render(
      <SimpleDatePicker
        value={defaultDate}
        show={false}
        onDateChange={mockOnDateChange}
        onDismiss={mockOnDismiss}
      />,
    );
    expect(toJSON()).toBeNull();
  });

  it('initializes with new Date() if value is null', () => {
    // Set to Android to avoid Modal wrapper for easier checking
    Platform.OS = 'android';
    const {getByTestId} = render(
      <SimpleDatePicker
        value={null}
        show={true}
        onDateChange={mockOnDateChange}
        onDismiss={mockOnDismiss}
      />,
    );

    const picker = getByTestId('mock-datetime-picker');
    // Ensure a Date object is created (fallback)
    expect(picker.props.value).toBeInstanceOf(Date);
  });

  it('updates internal state when show prop changes', () => {
    // We start hidden
    const {rerender, queryByTestId} = render(
      <SimpleDatePicker
        value={defaultDate}
        show={false}
        onDateChange={mockOnDateChange}
        onDismiss={mockOnDismiss}
      />,
    );
    expect(queryByTestId('mock-datetime-picker')).toBeNull();

    // Re-render visible
    rerender(
      <SimpleDatePicker
        value={defaultDate}
        show={true}
        onDateChange={mockOnDateChange}
        onDismiss={mockOnDismiss}
      />,
    );
    expect(queryByTestId('mock-datetime-picker')).toBeTruthy();
  });

  // ===========================================================================
  // 2. Platform: iOS Specific Logic
  // ===========================================================================

  describe('iOS Behavior', () => {
    beforeEach(() => {
      Platform.OS = 'ios';
    });

    it('renders native picker in iOS modal with cancel/done actions', () => {
      const {getByTestId, getByText} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      expect(getByTestId('mock-datetime-picker')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
      expect(getByText('Done')).toBeTruthy();
    });

    it('does not dismiss on iOS value change until Done is pressed', () => {
      const {getByTestId} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      const picker = getByTestId('mock-datetime-picker');
      const newDate = new Date('2023-01-02T10:00:00');

      fireEvent(picker, 'onChange', {type: 'set'}, newDate);
      expect(mockOnDateChange).not.toHaveBeenCalled();
      expect(mockOnDismiss).not.toHaveBeenCalled();

      fireEvent.press(getByTestId('ios-datetime-picker-done'));
      expect(mockOnDateChange).toHaveBeenCalledWith(newDate);
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismisses without saving when iOS cancel action is pressed', () => {
      const {getByTestId} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      fireEvent.press(getByTestId('ios-datetime-picker-cancel'));

      expect(mockOnDateChange).not.toHaveBeenCalled();
      expect(mockOnDismiss).toHaveBeenCalledTimes(1);
    });

    it('dismisses without saving on iOS dismiss event', () => {
      const {getByTestId} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      const picker = getByTestId('mock-datetime-picker');
      fireEvent(picker, 'onChange', {type: 'dismissed'}, undefined);

      expect(mockOnDateChange).not.toHaveBeenCalled();
      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('adapts styles for Dark Mode', () => {
      (useColorScheme as jest.Mock).mockReturnValue('dark');

      const {getByTestId} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      const picker = getByTestId('mock-datetime-picker');
      expect(picker.props.display).toBe('spinner');
      expect(picker.props.themeVariant).toBeUndefined();
      expect(picker.props.textColor).toBeUndefined();
    });

    it('uses 12-hour locale for iOS time mode', () => {
      const {getByTestId} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          mode="time"
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      const picker = getByTestId('mock-datetime-picker');
      expect(picker.props.locale).toBe('en-US');
    });
  });

  // ===========================================================================
  // 3. Platform: Android Specific Logic
  // ===========================================================================

  describe('Android Behavior', () => {
    beforeEach(() => {
      Platform.OS = 'android';
    });

    it('renders DateTimePicker directly (no Modal)', () => {
      const {getByTestId, queryByText} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      expect(getByTestId('mock-datetime-picker')).toBeTruthy();
      // Android doesn't show custom Done/Cancel buttons
      expect(queryByText('Done')).toBeNull();
    });

    it('calls onDateChange and dismisses immediately on selection (event type "set")', () => {
      const {getByTestId} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      const picker = getByTestId('mock-datetime-picker');
      const newDate = new Date('2023-05-05');

      // Trigger change
      fireEvent(picker, 'onChange', {type: 'set'}, newDate);

      expect(mockOnDateChange).toHaveBeenCalledWith(newDate);
      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('dismisses without saving on cancel (event type "dismissed")', () => {
      const {getByTestId} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      const picker = getByTestId('mock-datetime-picker');

      // Trigger dismiss (no date passed)
      fireEvent(picker, 'onChange', {type: 'dismissed'}, undefined);

      expect(mockOnDateChange).not.toHaveBeenCalled();
      expect(mockOnDismiss).toHaveBeenCalled();
    });
  });
});

// ===========================================================================
// 4. Utility Functions (Unit Tests)
// ===========================================================================

describe('SimpleDatePicker Utils', () => {
  beforeEach(() => {
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    (console.error as jest.Mock).mockRestore();
  });

  describe('formatDateForDisplay', () => {
    it('formats a valid date string correctly', () => {
      // 2023-01-15 (Month is 0-indexed in JS Date)
      const date = new Date(2023, 0, 15);
      expect(formatDateForDisplay(date)).toBe('15-JAN-2023');
    });

    it('handles null input', () => {
      expect(formatDateForDisplay(null)).toBe('');
    });

    it('handles invalid date input', () => {
      const invalidDate = new Date('invalid-date-string');
      expect(formatDateForDisplay(invalidDate)).toBe('');
    });

    it('handles exception gracefully (simulate by passing bad type)', () => {
      // Passing a symbol forces a crash inside the Date constructor or validation logic
      expect(formatDateForDisplay(Symbol('fail') as any)).toBe('');
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('formatTimeForDisplay', () => {
    it('formats AM time correctly', () => {
      // 9:05 AM
      const date = new Date(2023, 0, 1, 9, 5);
      expect(formatTimeForDisplay(date)).toBe('09:05 AM');
    });

    it('formats PM time correctly', () => {
      // 2:30 PM (14:30)
      const date = new Date(2023, 0, 1, 14, 30);
      expect(formatTimeForDisplay(date)).toBe('02:30 PM');
    });

    it('formats 12 AM (midnight) correctly', () => {
      const date = new Date(2023, 0, 1, 0, 15);
      expect(formatTimeForDisplay(date)).toBe('12:15 AM');
    });

    it('formats 12 PM (noon) correctly', () => {
      const date = new Date(2023, 0, 1, 12, 45);
      expect(formatTimeForDisplay(date)).toBe('12:45 PM');
    });

    it('handles null input', () => {
      expect(formatTimeForDisplay(null)).toBe('');
    });

    it('handles invalid date input', () => {
      expect(formatTimeForDisplay(new Date('invalid'))).toBe('');
    });

    it('handles exception gracefully', () => {
      expect(formatTimeForDisplay(Symbol('fail') as any)).toBe('');
      expect(console.error).toHaveBeenCalled();
    });
  });
});
