import React from 'react';
// Import 'within' for more specific queries
import {render, screen, fireEvent, within} from '@testing-library/react-native';
// Import with aliases for clarity in mocks
import {
  View as MockView,
  Text as MockText,
  TouchableOpacity as MockTouchableOpacity,
} from 'react-native';
import {SimpleTaskFormSection} from '@/components/tasks/SimpleTaskFormSection/SimpleTaskFormSection';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';
import {formatTimeForDisplay} from '@/utils/timeHelpers';
import {Images} from '@/assets/images';
// Removed unused imports
import type {
  TaskFormData,
  TaskFormErrors,
  TaskFrequency,
  TaskTypeSelection,
} from '@/features/tasks/types';

// --- Mocks ---

// Mock child components from @/components/common
jest.mock('@/components/common', () => {
  // Use aliases defined above
  // Mock Input - Render props like label, placeholder, value, error
  const InputMock = jest.fn(
    ({
      label,
      placeholder,
      value,
      onChangeText,
      error,
      editable = true,
      ...props
    }) => {
      // Use replaceAll
      const testIdBase = label
        ? label.replaceAll(' ', '-')
        : placeholder?.replaceAll(' ', '-');
      const inputTestId = `mock-input-${testIdBase}`;

      return (
        <MockView {...props} testID={inputTestId}>
          {' '}
          {/* Use testID here */}
          {label && <MockText>Label: {label}</MockText>}
          {placeholder && <MockText>Placeholder: {placeholder}</MockText>}
          <MockText>Value: {value}</MockText>
          {error && <MockText>Error: {error}</MockText>}
          <MockText>Editable: {String(editable)}</MockText>
          {/* Add a touchable area to simulate text change for testing */}
          <MockTouchableOpacity
            testID={`${inputTestId}-touchable`}
            onPress={() => onChangeText && onChangeText('mock change')}
          />
        </MockView>
      );
    },
  );

  // Mock TouchableInput - Render props like label, placeholder, value, error, and rightComponent
  const TouchableInputMock = jest.fn(
    ({label, placeholder, value, onPress, rightComponent, error, ...props}) => {
      // Use replaceAll
      const testIdBase = label
        ? label.replaceAll(' ', '-')
        : placeholder?.replaceAll(' ', '-');
      const touchableTestId = `mock-touchable-${testIdBase}`;

      return (
        <MockTouchableOpacity
          {...props}
          testID={touchableTestId}
          onPress={onPress}>
          {' '}
          {/* Use testID here */}
          {label && <MockText>Label: {label}</MockText>}
          {placeholder && <MockText>Placeholder: {placeholder}</MockText>}
          <MockText>Value: {value || ''}</MockText>
          {/* Use optional chaining */}
          {rightComponent?.props?.source && (
            <MockText>Icon: {rightComponent.props.source}</MockText>
          )}
          {error && <MockText>Error: {error}</MockText>}
        </MockTouchableOpacity>
      );
    },
  );

  return {
    Input: InputMock,
    TouchableInput: TouchableInputMock,
  };
});

// Mock utilities
jest.mock('@/components/common/SimpleDatePicker/SimpleDatePicker', () => ({
  formatDateForDisplay: jest.fn(),
}));
const mockFormatDateForDisplay = formatDateForDisplay as jest.Mock;

jest.mock('@/utils/timeHelpers', () => ({
  formatTimeForDisplay: jest.fn(),
}));
const mockFormatTimeForDisplay = formatTimeForDisplay as jest.Mock;

jest.mock('@/assets/images', () => ({
  Images: {
    calendarIcon: 'calendar.png',
    clockIcon: 'clock.png',
    dropdownIcon: 'dropdown.png',
  },
}));

// Mock createIconStyles - keep it simple
jest.mock('@/utils/iconStyles', () => ({
  createIconStyles: jest.fn(() => ({
    dropdownIcon: {width: 16, height: 16},
  })),
}));

// Mock createTaskFormSectionStyles - keep it simple
jest.mock('@/components/tasks/shared/taskFormStyles', () => ({
  createTaskFormSectionStyles: jest.fn(() => ({
    fieldGroup: {},
    textArea: {},
    dateTimeRow: {},
    dateTimeField: {},
    calendarIcon: {},
  })),
}));

// Mock RN Image
jest.mock('react-native/Libraries/Image/Image', () => {
  // Use aliased imports
  // Render the source prop to allow checking which icon is used
  const MockImage = (props: any) => (
    <MockView testID="mock-image">
      <MockText>Source: {props.source}</MockText>
    </MockView>
  );
  MockImage.displayName = 'Image';
  return MockImage;
});

// --- Mock Data ---

const mockTheme = {
  spacing: {1: 4, 3: 8, 4: 12},
  typography: {},
  colors: {},
};

// Define baseFormData ensuring it matches TaskFormData structure used by component
const baseFormData: TaskFormData = {
  title: '',
  description: '',
  date: null,
  time: null,
  frequency: null,
  type: 'simple', // Assuming type is required, provide default
  companionId: 'comp-1',
  // Add other necessary TaskFormData fields with default values if any
};

const baseErrors: TaskFormErrors = {};

// --- Helper ---

interface TestProps {
  formData?: Partial<TaskFormData>;
  errors?: Partial<TaskFormErrors>;
  taskTypeSelection?: TaskTypeSelection;
}

const renderComponent = ({
  formData = {},
  errors = {},
  taskTypeSelection,
}: TestProps = {}) => {
  // Corrected date formatting mock
  mockFormatDateForDisplay.mockImplementation((date: Date | null) => {
    if (!date) return '';
    // Manually format to YYYY-MM-DD, respecting the date's components
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0'); // getMonth is 0-indexed
    const day = date.getDate().toString().padStart(2, '0');
    return `Formatted: ${year}-${month}-${day}`;
  });
  mockFormatTimeForDisplay.mockImplementation((time: string | null) =>
    time ? `Formatted: ${time}` : '',
  );

  const mockUpdateField = jest.fn();
  const mockOnOpenDatePicker = jest.fn();
  const mockOnOpenTimePicker = jest.fn();
  const mockOnOpenTaskFrequencySheet = jest.fn();

  // Combine base and provided formData
  const fullFormData = {
    ...baseFormData,
    ...formData,
  } as TaskFormData;

  const props = {
    formData: fullFormData,
    errors: {...baseErrors, ...errors} as TaskFormErrors,
    taskTypeSelection,
    updateField: mockUpdateField,
    onOpenDatePicker: mockOnOpenDatePicker,
    onOpenTimePicker: mockOnOpenTimePicker,
    onOpenTaskFrequencySheet: mockOnOpenTaskFrequencySheet,
    theme: mockTheme,
  };

  render(<SimpleTaskFormSection {...props} />);

  return {
    mockUpdateField,
    mockOnOpenDatePicker,
    mockOnOpenTimePicker,
    mockOnOpenTaskFrequencySheet,
  };
};

// --- Tests ---

describe('SimpleTaskFormSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders inputs with initial values from formData', () => {
      const date = new Date(2025, 9, 29); // Oct 29, 2025
      const frequencyValue: TaskFrequency = 'daily';
      renderComponent({
        formData: {
          title: 'Test Task',
          description: 'Test Desc',
          date: date,
          time: '10:30:00',
          frequency: frequencyValue,
        },
      });

      expect(screen.getByText('Value: Test Task')).toBeTruthy();
      expect(screen.getByText('Value: Test Desc')).toBeTruthy();
      // Check against the manually formatted string from the mock
      expect(screen.getByText('Value: Formatted: 2025-10-29')).toBeTruthy();
      expect(screen.getByText('Value: Formatted: 10:30:00')).toBeTruthy();
      expect(screen.getByText(`Value: ${frequencyValue}`)).toBeTruthy();
    });

    it('renders placeholders when values are empty or null', () => {
      renderComponent();

      expect(screen.getByText('Placeholder: Enter task name')).toBeTruthy();
      expect(screen.getByText('Placeholder: Date')).toBeTruthy();
      expect(screen.getByText('Placeholder: Time')).toBeTruthy();
      expect(screen.getByText('Placeholder: Task frequency')).toBeTruthy();

      const emptyValueTexts = screen.getAllByText('Value: ');
      // Expecting empty values for title, desc, date, time, frequency
      expect(emptyValueTexts.length).toBeGreaterThanOrEqual(5);
    });

    it('calls date and time formatters', () => {
      const date = new Date();
      renderComponent({formData: {date: date, time: '12:00:00'}});
      expect(mockFormatDateForDisplay).toHaveBeenCalledWith(date);
      expect(mockFormatTimeForDisplay).toHaveBeenCalledWith('12:00:00');
    });

    it('renders correct icons for date, time, and frequency', () => {
      renderComponent();
      expect(screen.getByText(`Icon: ${Images.calendarIcon}`)).toBeTruthy();
      expect(screen.getByText(`Icon: ${Images.clockIcon}`)).toBeTruthy();
      expect(screen.getByText(`Icon: ${Images.dropdownIcon}`)).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('calls updateField on title change', () => {
      const {mockUpdateField} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-input-Task-name-touchable'));
      expect(mockUpdateField).toHaveBeenCalledWith('title', 'mock change');
    });

    it('calls updateField on description change', () => {
      const {mockUpdateField} = renderComponent();
      fireEvent.press(
        screen.getByTestId('mock-input-Task-description-(optional)-touchable'),
      );
      expect(mockUpdateField).toHaveBeenCalledWith(
        'description',
        'mock change',
      );
    });

    it('calls onOpenDatePicker on date input press', () => {
      const {mockOnOpenDatePicker} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-Date'));
      expect(mockOnOpenDatePicker).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenTimePicker on time input press', () => {
      const {mockOnOpenTimePicker} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-Time'));
      expect(mockOnOpenTimePicker).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenTaskFrequencySheet on frequency input press', () => {
      const {mockOnOpenTaskFrequencySheet} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-Task-frequency'));
      expect(mockOnOpenTaskFrequencySheet).toHaveBeenCalledTimes(1);
    });
  });

  describe('Editability based on taskTypeSelection', () => {
    it('makes title editable if taskTypeSelection is undefined', () => {
      renderComponent({taskTypeSelection: undefined});
      const titleInputContainer = screen.getByTestId('mock-input-Task-name');
      expect(
        within(titleInputContainer).getByText('Editable: true'),
      ).toBeTruthy();
      expect(screen.getByText('Placeholder: Enter task name')).toBeTruthy();
    });

    it('makes title editable if taskTypeSelection category is "custom"', () => {
      // Add label property to satisfy TaskTypeSelection type
      renderComponent({
        taskTypeSelection: {category: 'custom', label: 'Custom Task'},
      });
      const titleInputContainer = screen.getByTestId('mock-input-Task-name');
      expect(
        within(titleInputContainer).getByText('Editable: true'),
      ).toBeTruthy();
      expect(screen.getByText('Placeholder: Enter task name')).toBeTruthy();
    });

    it('makes title non-editable if taskTypeSelection category is not "custom"', () => {
      // Add label property to satisfy TaskTypeSelection type
      renderComponent({
        taskTypeSelection: {
          category: 'health',
          taskType: 'give-medication',
          label: 'Give Medication',
        },
      });
      const titleInputContainer = screen.getByTestId('mock-input-Task-name');
      expect(
        within(titleInputContainer).getByText('Editable: false'),
      ).toBeTruthy();
      expect(screen.queryByText('Placeholder: Enter task name')).toBeNull();
    });
  });

  describe('Error Display', () => {
    it('passes error props to child inputs', () => {
      renderComponent({
        errors: {
          title: 'Title error',
          date: 'Date error',
          time: 'Time error',
          frequency: 'Frequency error',
        },
      });

      expect(screen.getByText('Error: Title error')).toBeTruthy();
      expect(screen.getByText('Error: Date error')).toBeTruthy();
      expect(screen.getByText('Error: Time error')).toBeTruthy();
      expect(screen.getByText('Error: Frequency error')).toBeTruthy();
    });
  });
});
