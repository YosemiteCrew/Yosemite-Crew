// __tests__/components/tasks/ObservationalToolFormSection.test.tsx

import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react-native';
// FIX 1: Update component import path
import {ObservationalToolFormSection} from '@/features/tasks/components/ObservationalToolFormSection/ObservationalToolFormSection';
// FIX 2: Update helper import path
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker'; // Mocked
import {formatTimeForDisplay} from '@/shared/utils/timeHelpers'; // Mocked
import {Images} from '@/assets/images'; // Mocked
import type {
  TaskFormData,
  TaskFormErrors,
  ObservationalTool,
  TaskFrequency,
} from '@/features/tasks/types';

// --- Mocks ---

// FIX 3: Update mocked component path
jest.mock('@/shared/components/common', () => {
  const RN = require('react-native');
  const {View, Text, TouchableOpacity} = RN;

  // Mock Input
  const InputMock = jest.fn(
    ({
      label,
      placeholder,
      value,
      onChangeText,
      error,
      editable = true,
      icon,
      ...props
    }) => {
      const testIdBase = (label || placeholder || 'input').replaceAll(
        /[\s()]/g,
        '-',
      );
      const inputTestId = `mock-input-${testIdBase}`;
      return (
        <View {...props} testID={inputTestId}>
          {label && <Text>Label: {label}</Text>}
          {placeholder && <Text>Placeholder: {placeholder}</Text>}
          <Text>Value: {value ?? ''}</Text>
          {error && <Text>Error: {error}</Text>}
          <Text>Editable: {String(editable)}</Text>
          {icon?.props?.source && <Text>Icon: {icon.props.source}</Text>}
          {editable && (
            <TouchableOpacity
              testID={`${inputTestId}-touchable`}
              onPress={() => onChangeText && onChangeText('mock change')}
            />
          )}
        </View>
      );
    },
  );

  // Mock TouchableInput
  const TouchableInputMock = jest.fn(
    ({label, placeholder, value, onPress, rightComponent, error, ...props}) => {
      const testIdBase = (label || placeholder || 'touchable').replaceAll(
        /[\s()]/g,
        '-',
      );
      const touchableTestId = `mock-touchable-${testIdBase}`;
      return (
        <TouchableOpacity {...props} testID={touchableTestId} onPress={onPress}>
          {label && <Text>Label: {label}</Text>}
          {placeholder && <Text>Placeholder: {placeholder}</Text>}
          <Text>Value: {value || ''}</Text>
          {rightComponent?.props?.source && (
            <Text>Icon: {rightComponent.props.source}</Text>
          )}
          {error && <Text>Error: {error}</Text>}
        </TouchableOpacity>
      );
    },
  );

  return {Input: InputMock, TouchableInput: TouchableInputMock};
});

// Mock utilities
// FIX 4: Update mocked component path
jest.mock(
  '@/shared/components/common/SimpleDatePicker/SimpleDatePicker',
  () => ({
    formatDateForDisplay: jest.fn((date: Date | null): string => {
      if (!date) return '';
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `FormattedDate: ${year}-${month}-${day}`;
    }),
  }),
);
const mockFormatDateForDisplay = formatDateForDisplay as jest.Mock;

// FIX 5: Update mocked util path
jest.mock('@/shared/utils/timeHelpers', () => ({
  formatTimeForDisplay: jest.fn((time: Date | null): string => {
    if (!time) return '';
    const hours = String(time.getHours()).padStart(2, '0');
    const minutes = String(time.getMinutes()).padStart(2, '0');
    const seconds = String(time.getSeconds()).padStart(2, '0');
    return `FormattedTime: ${hours}:${minutes}:${seconds}`;
  }),
}));
const mockFormatTimeForDisplay = formatTimeForDisplay as jest.Mock;

jest.mock('@/assets/images', () => ({
  Images: {
    calendarIcon: 'calendar.png',
    clockIcon: 'clock.png',
    dropdownIcon: 'dropdown.png',
  },
}));

// Mock style functions
// FIX 6: Update mocked util path
jest.mock('@/shared/utils/iconStyles', () => ({
  createIconStyles: jest.fn(() => ({})),
}));
// FIX 7: Update mocked style path
jest.mock('@/features/tasks/components/shared/taskFormStyles', () => ({
  createTaskFormSectionStyles: jest.fn(() => ({})),
}));

// Mock RN Image
jest.mock('react-native/Libraries/Image/Image', () => {
  const {View, Text} = require('react-native');
  const MockImage = (props: any) => (
    <View testID="mock-image">
      <Text>Source Prop: {props.source}</Text>
    </View>
  );
  MockImage.displayName = 'Image';
  return MockImage;
});

// --- Mock Data ---
const mockTheme = {spacing: {}, colors: {}, typography: {}};

const baseFormData: TaskFormData = {
  title: 'Take Observational Tool',
  description: '',
  date: null,
  time: null,
  frequency: null,
  category: 'health',
  subcategory: null,
  parasitePreventionType: null,
  chronicConditionType: null,
  healthTaskType: 'take-observational-tool',
  hygieneTaskType: null,
  dietaryTaskType: null,
  assignedTo: null,
  reminderEnabled: false,
  reminderOptions: null,
  syncWithCalendar: false,
  calendarProvider: null,
  attachDocuments: false,
  attachments: [],
  additionalNote: '',
  medicineName: '',
  medicineType: null,
  dosages: [],
  medicationFrequency: null,
  startDate: null,
  endDate: null,
  observationalTool: null,
};

const baseErrors: TaskFormErrors = {};

// --- Helper ---

const renderComponent = (
  props: {
    formData?: Partial<TaskFormData>;
    errors?: Partial<TaskFormErrors>;
  } = {},
) => {
  mockFormatDateForDisplay.mockClear();
  mockFormatTimeForDisplay.mockClear();

  const mockUpdateField = jest.fn();
  const mockOnOpenObservationalToolSheet = jest.fn();
  const mockOnOpenDatePicker = jest.fn();
  const mockOnOpenTimePicker = jest.fn();
  const mockOnOpenTaskFrequencySheet = jest.fn();

  const fullFormData = {...baseFormData, ...props.formData};
  const fullErrors = {...baseErrors, ...props.errors};

  render(
    <ObservationalToolFormSection
      formData={fullFormData}
      errors={fullErrors}
      updateField={mockUpdateField}
      onOpenObservationalToolSheet={mockOnOpenObservationalToolSheet}
      onOpenDatePicker={mockOnOpenDatePicker}
      onOpenTimePicker={mockOnOpenTimePicker}
      onOpenTaskFrequencySheet={mockOnOpenTaskFrequencySheet}
      theme={mockTheme}
    />,
  );

  return {
    mockUpdateField,
    mockOnOpenObservationalToolSheet,
    mockOnOpenDatePicker,
    mockOnOpenTimePicker,
    mockOnOpenTaskFrequencySheet,
  };
};

// --- Tests ---

describe('ObservationalToolFormSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders all fields with placeholders by default', () => {
      renderComponent();

      const titleInput = screen.getByTestId('mock-input-Task-name');
      expect(
        within(titleInput).getByText('Value: Take Observational Tool'),
      ).toBeTruthy();
      expect(within(titleInput).getByText('Editable: false')).toBeTruthy();

      expect(
        screen.getByText('Placeholder: Select observational tool'),
      ).toBeTruthy();
      expect(screen.getByText('Placeholder: Date')).toBeTruthy();
      expect(screen.getByText('Placeholder: Time')).toBeTruthy();
      expect(screen.getByText('Placeholder: Task frequency')).toBeTruthy();
    });

    it('renders all fields with values from formData', () => {
      const testDate = new Date(2025, 9, 29); // Oct 29, 2025
      const testTime = new Date(2025, 9, 29, 14, 30, 0); // 14:30:00
      const tool: ObservationalTool = 'feline-grimace-scale';
      const freq: TaskFrequency = 'daily';

      renderComponent({
        formData: {
          date: testDate,
          time: testTime,
          observationalTool: tool,
          frequency: freq,
        },
      });

      expect(mockFormatDateForDisplay).toHaveBeenCalledWith(testDate);
      expect(mockFormatTimeForDisplay).toHaveBeenCalledWith(testTime);

      expect(screen.getByText(`Value: ${tool}`)).toBeTruthy();
      expect(screen.getByText('Value: FormattedDate: 2025-10-29')).toBeTruthy();
      expect(screen.getByText('Value: FormattedTime: 14:30:00')).toBeTruthy();
      expect(screen.getByText(`Value: ${freq}`)).toBeTruthy();
    });

    it('renders error messages', () => {
      renderComponent({
        errors: {
          observationalTool: 'Tool error',
          date: 'Date error',
          time: 'Time error',
          frequency: 'Frequency error',
        },
      });

      expect(screen.getByText('Error: Tool error')).toBeTruthy();
      expect(screen.getByText('Error: Date error')).toBeTruthy();
      expect(screen.getByText('Error: Time error')).toBeTruthy();
      expect(screen.getByText('Error: Frequency error')).toBeTruthy();
    });

    it('renders all icons', () => {
      renderComponent();

      const toolInput = screen.getByTestId(
        'mock-touchable-Select-observational-tool',
      );
      expect(
        within(toolInput).getByText(`Icon: ${Images.dropdownIcon}`),
      ).toBeTruthy();

      const dateInput = screen.getByTestId('mock-touchable-Date');
      expect(
        within(dateInput).getByText(`Icon: ${Images.calendarIcon}`),
      ).toBeTruthy();

      const timeInput = screen.getByTestId('mock-touchable-Time');
      expect(
        within(timeInput).getByText(`Icon: ${Images.clockIcon}`),
      ).toBeTruthy();

      const freqInput = screen.getByTestId('mock-touchable-Task-frequency');
      expect(
        within(freqInput).getByText(`Icon: ${Images.dropdownIcon}`),
      ).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('does not call updateField when non-editable title is pressed', () => {
      const {mockUpdateField} = renderComponent();
      const touchable = screen.queryByTestId('mock-input-Task-name-touchable');
      expect(touchable).toBeNull();
      expect(mockUpdateField).not.toHaveBeenCalled();
    });

    it('calls onOpenObservationalToolSheet when pressed', () => {
      const {mockOnOpenObservationalToolSheet} = renderComponent();
      fireEvent.press(
        screen.getByTestId('mock-touchable-Select-observational-tool'),
      );
      expect(mockOnOpenObservationalToolSheet).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenDatePicker when pressed', () => {
      const {mockOnOpenDatePicker} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-Date'));
      expect(mockOnOpenDatePicker).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenTimePicker when pressed', () => {
      const {mockOnOpenTimePicker} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-Time'));
      expect(mockOnOpenTimePicker).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenTaskFrequencySheet when pressed', () => {
      const {mockOnOpenTaskFrequencySheet} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-Task-frequency'));
      expect(mockOnOpenTaskFrequencySheet).toHaveBeenCalledTimes(1);
    });
  });
});
