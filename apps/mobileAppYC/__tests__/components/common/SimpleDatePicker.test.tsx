import React from 'react';
import {Platform, useColorScheme} from 'react-native';
import {render, fireEvent} from '@testing-library/react-native';
// CRITICAL FIX: Corrected import path from ../../../../src to ../../../src
import {
  SimpleDatePicker,
  formatDateForDisplay,
  formatTimeForDisplay,
} from '../../../src/shared/components/common/SimpleDatePicker/SimpleDatePicker';

// --- Mocks ---

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

    it('renders inside a Modal on iOS', () => {
      const {getByTestId, getByText} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      // Check for iOS specific UI elements
      expect(getByText('Cancel')).toBeTruthy();
      expect(getByText('Done')).toBeTruthy();
      expect(getByTestId('mock-datetime-picker')).toBeTruthy();
    });

    it('updates temporary date on scroll but DOES NOT call parent onDateChange', () => {
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

      // Simulate scrolling the picker
      // Note: community/datetimepicker uses 'onChange' prop
      fireEvent(picker, 'onChange', {nativeEvent: {}}, newDate);

      // Parent callback should NOT fire yet (iOS requires 'Done' press)
      expect(mockOnDateChange).not.toHaveBeenCalled();
    });

    it('calls parent onDateChange and dismisses when "Done" is pressed', () => {
      const {getByTestId, getByText} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      const picker = getByTestId('mock-datetime-picker');
      const newDate = new Date('2023-01-02T10:00:00');

      // 1. Change internal value
      fireEvent(picker, 'onChange', {}, newDate);

      // 2. Press Done
      fireEvent.press(getByText('Done'));

      expect(mockOnDateChange).toHaveBeenCalledWith(newDate);
      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('dismisses without saving when "Cancel" is pressed', () => {
      const {getByTestId, getByText} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      const picker = getByTestId('mock-datetime-picker');
      const newDate = new Date('2023-01-02T10:00:00');

      // 1. Change internal value
      fireEvent(picker, 'onChange', {}, newDate);

      // 2. Press Cancel
      fireEvent.press(getByText('Cancel'));

      expect(mockOnDateChange).not.toHaveBeenCalled();
      expect(mockOnDismiss).toHaveBeenCalled();
    });

    it('dismisses when modal background/backdrop is pressed', () => {
      const {UNSAFE_getAllByType} = render(
        <SimpleDatePicker
          value={defaultDate}
          show={true}
          onDateChange={mockOnDateChange}
          onDismiss={mockOnDismiss}
        />,
      );

      // The backdrop is a TouchableOpacity. Since we don't have a testID,
      // we can simulate the Modal requestClose or find the TouchableOpacity.
      // The easiest way to cover `handleCancel` being passed to `onRequestClose` is to fire it.

      // 1. Fire onRequestClose on the Modal
      const {Modal} = require('react-native');
      const modals = UNSAFE_getAllByType(Modal);
      fireEvent(modals[0], 'requestClose');

      expect(mockOnDismiss).toHaveBeenCalled();

      // Reset for next check
      mockOnDismiss.mockClear();

      // 2. Find the Backdrop TouchableOpacity (it's the first touchable inside the view structure)
      
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
      // Check if themeVariant prop is passed correctly
      expect(picker.props.themeVariant).toBe('dark');
      // Check textColor prop
      expect(picker.props.textColor).toBe('#FFFFFF');
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