import React from 'react';
import {render, fireEvent, screen} from '@testing-library/react-native';
import {CalendarSyncSection} from '../../../../../../src/features/tasks/screens/AddTaskScreen/components/CalendarSyncSection';
import {mockTheme} from '../../../../../setup/mockTheme';

// --- Mocks ---

// 1. Shared Components
// Fix: Require React Native components inside the mock factory to avoid hoisting ReferenceError
jest.mock('@/shared/components/common', () => {
  const {View, Text, TouchableOpacity} = require('react-native');
  return {
    TouchableInput: (props: any) => (
      <View testID="touchable-input">
        <Text testID="input-label">{props.label || 'No Label'}</Text>
        <Text testID="input-value">{props.value || 'No Value'}</Text>
        <Text testID="input-placeholder">{props.placeholder}</Text>
        <TouchableOpacity testID="input-touchable" onPress={props.onPress}>
          <Text>Trigger</Text>
        </TouchableOpacity>
        {props.rightComponent}
      </View>
    ),
  };
});

// 2. Assets
jest.mock('@/assets/images', () => ({
  Images: {
    dropdownIcon: {uri: 'dropdown-icon'},
  },
}));

// 3. Style Utils
jest.mock('@/shared/utils/iconStyles', () => ({
  createIconStyles: jest.fn(() => ({
    dropdownIcon: {width: 20, height: 20},
  })),
}));

jest.mock('@/shared/utils/formStyles', () => ({
  createFormStyles: jest.fn(() => ({
    toggleSection: {flexDirection: 'row'},
    toggleLabel: {color: 'black'},
    fieldGroup: {marginBottom: 10},
  })),
}));

describe('CalendarSyncSection', () => {
  const mockUpdateField = jest.fn();
  const mockOnOpenSheet = jest.fn();
  

  const defaultProps = {
    formData: {
      syncWithCalendar: false,
      calendarProvider: null,
    } as any,
    updateField: mockUpdateField,
    onOpenCalendarSyncSheet: mockOnOpenSheet,
    theme: mockTheme,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders toggle switch correctly when sync is disabled', () => {
    render(<CalendarSyncSection {...defaultProps} />);

    // Check static text
    expect(screen.getByText('Sync with Calendar')).toBeTruthy();

    // Switch should be present
    const switchElement = screen.getByRole('switch');
    expect(switchElement.props.value).toBe(false);

    // TouchableInput should NOT be rendered
    expect(screen.queryByTestId('touchable-input')).toBeNull();
  });

  it('calls updateField when switch is toggled', () => {
    render(<CalendarSyncSection {...defaultProps} />);

    const switchElement = screen.getByRole('switch');
    fireEvent(switchElement, 'onValueChange', true);

    expect(mockUpdateField).toHaveBeenCalledWith('syncWithCalendar', true);
  });

  it('renders TouchableInput when sync is enabled', () => {
    const props = {
      ...defaultProps,
      formData: {
        ...defaultProps.formData,
        syncWithCalendar: true,
      },
    };

    render(<CalendarSyncSection {...props} />);

    expect(screen.getByTestId('touchable-input')).toBeTruthy();
    // Default label should be undefined (mock renders 'No Label')
    expect(screen.getByTestId('input-label').props.children).toBe('No Label');
    // Default value should be undefined (mock renders 'No Value')
    expect(screen.getByTestId('input-value').props.children).toBe('No Value');
  });

  it('calls onOpenCalendarSyncSheet when input is pressed', () => {
    const props = {
      ...defaultProps,
      formData: {
        ...defaultProps.formData,
        syncWithCalendar: true,
      },
    };

    render(<CalendarSyncSection {...props} />);

    fireEvent.press(screen.getByTestId('input-touchable'));
    expect(mockOnOpenSheet).toHaveBeenCalled();
  });

  it('formats Google Calendar provider correctly', () => {
    const props = {
      ...defaultProps,
      formData: {
        syncWithCalendar: true,
        calendarProvider: 'google',
      },
    };

    render(<CalendarSyncSection {...props} />);

    // Check value formatting logic
    expect(screen.getByTestId('input-value').props.children).toBe(
      'Google Calendar',
    );
    // Check label logic (should be 'Calendar provider' if provider is set)
    expect(screen.getByTestId('input-label').props.children).toBe(
      'Calendar provider',
    );
  });

  it('formats iCloud Calendar provider correctly', () => {
    const props = {
      ...defaultProps,
      formData: {
        syncWithCalendar: true,
        calendarProvider: 'icloud',
      },
    };

    render(<CalendarSyncSection {...props} />);

    expect(screen.getByTestId('input-value').props.children).toBe(
      'iCloud Calendar',
    );
  });

  it('returns undefined for unknown calendar provider', () => {
    const props = {
      ...defaultProps,
      formData: {
        syncWithCalendar: true,
        calendarProvider: 'unknown-provider',
      },
    };

    render(<CalendarSyncSection {...props} />);

    // The internal format function returns undefined, mock renders 'No Value'
    expect(screen.getByTestId('input-value').props.children).toBe('No Value');
  });
});
