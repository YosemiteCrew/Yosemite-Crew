import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react-native';
import {
  View as MockView,
  Text as MockText,
  TouchableOpacity as MockTouchableOpacity,
} from 'react-native';
// FIX 1: Update component import path
import {SimpleTaskFormSection} from '@/features/tasks/components/SimpleTaskFormSection/SimpleTaskFormSection';
// FIX 2: Update helper import path
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/SimpleDatePicker';
// FIX 3: Update helper import path
import {formatTimeForDisplay} from '@/shared/utils/timeHelpers';
import {Images} from '@/assets/images';
import type {
  TaskFormData,
  TaskFormErrors,
  TaskFrequency,
  TaskTypeSelection,
} from '@/features/tasks/types';

// --- Mocks ---

// FIX 4: Update mocked component path
jest.mock('@/shared/components/common', () => {
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
      const testIdBase = label
        ? label.replaceAll(' ', '-')
        : placeholder?.replaceAll(' ', '-');
      const inputTestId = `mock-input-${testIdBase}`;

      return (
        <MockView {...props} testID={inputTestId}>
          {' '}
          {label && <MockText>Label: {label}</MockText>}
          {placeholder && <MockText>Placeholder: {placeholder}</MockText>}
          <MockText>Value: {value}</MockText>
          {error && <MockText>Error: {error}</MockText>}
          <MockText>Editable: {String(editable)}</MockText>
          <MockTouchableOpacity
            testID={`${inputTestId}-touchable`}
            onPress={() => onChangeText && onChangeText('mock change')}
          />
        </MockView>
      );
    },
  );

  const TouchableInputMock = jest.fn(
    ({label, placeholder, value, onPress, rightComponent, error, ...props}) => {
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
          {label && <MockText>Label: {label}</MockText>}
          {placeholder && <MockText>Placeholder: {placeholder}</MockText>}
          <MockText>Value: {value || ''}</MockText>
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
// FIX 5: Update mocked component path
jest.mock(
  '@/shared/components/common/SimpleDatePicker/SimpleDatePicker',
  () => ({
    formatDateForDisplay: jest.fn(),
  }),
);
const mockFormatDateForDisplay = formatDateForDisplay as jest.Mock;

// FIX 6: Update mocked util path
jest.mock('@/shared/utils/timeHelpers', () => ({
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

// FIX 7: Update mocked util path
jest.mock('@/shared/utils/iconStyles', () => ({
  createIconStyles: jest.fn(() => ({
    dropdownIcon: {width: 16, height: 16},
  })),
}));

// FIX 8: Update mocked style path
jest.mock('@/features/tasks/components/shared/taskFormStyles', () => ({
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

const baseFormData: TaskFormData = {
  title: '',
  description: '',
  date: null,
  time: null,
  frequency: null,
  category: 'custom', // Added category
  subcategory: null, // Added subcategory
  healthTaskType: null, // Added
  hygieneTaskType: null, // Added
  dietaryTaskType: null, // Added
  assignedTo: null, // Added
  reminderEnabled: false, // Added
  syncWithCalendar: false, // Added
  attachments: [], // Added
  additionalNote: '', // Added
  medicineName: '', // Added
  medicineType: null, // Added
  dosages: [], // Added
  medicationFrequency: null, // Added
  startDate: null, // Added
  endDate: null, // Added
  observationalTool: null, // Added
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
  mockFormatDateForDisplay.mockImplementation((date: Date | null) => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `Formatted: ${year}-${month}-${day}`;
  });
  mockFormatTimeForDisplay.mockImplementation(
    (
      time: Date | null, // Changed type to Date
    ) => (time ? `Formatted: ${time.getHours()}:${time.getMinutes()}` : ''),
  );

  const mockUpdateField = jest.fn();
  const mockOnOpenDatePicker = jest.fn();
  const mockOnOpenTimePicker = jest.fn();
  const mockOnOpenTaskFrequencySheet = jest.fn();

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
      const date = new Date(2025, 9, 29);
      const time = new Date(2025, 9, 29, 10, 30);
      const frequencyValue: TaskFrequency = 'daily';
      renderComponent({
        formData: {
          title: 'Test Task',
          description: 'Test Desc',
          date: date,
          time: time, // Use Date object
          frequency: frequencyValue,
        },
      });

      expect(screen.getByText('Value: Test Task')).toBeTruthy();
      expect(screen.getByText('Value: Test Desc')).toBeTruthy();
      expect(screen.getByText('Value: Formatted: 2025-10-29')).toBeTruthy();
      expect(screen.getByText('Value: Formatted: 10:30')).toBeTruthy(); // Updated assertion
      expect(screen.getByText(`Value: ${frequencyValue}`)).toBeTruthy();
    });

    it('renders placeholders when values are empty or null', () => {
      renderComponent();

      expect(screen.getByText('Placeholder: Enter task name')).toBeTruthy();
      expect(screen.getByText('Placeholder: Date')).toBeTruthy();
      expect(screen.getByText('Placeholder: Time')).toBeTruthy();
      expect(screen.getByText('Placeholder: Task frequency')).toBeTruthy();

      const emptyValueTexts = screen.getAllByText('Value: ');
      expect(emptyValueTexts.length).toBeGreaterThanOrEqual(5);
    });

    it('calls date and time formatters', () => {
      const date = new Date();
      const time = new Date();
      renderComponent({formData: {date: date, time: time}});
      expect(mockFormatDateForDisplay).toHaveBeenCalledWith(date);
      expect(mockFormatTimeForDisplay).toHaveBeenCalledWith(time);
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
