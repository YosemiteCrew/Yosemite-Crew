import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react-native';
// FIX 1: Update component import path
import {MedicationFormSection} from '@/features/tasks/components/MedicationFormSection/MedicationFormSection';
// FIX 2: Update helper import path
import {formatDateForDisplay} from '@/shared/components/common/SimpleDatePicker/dateTimeFormat';

import type {
  TaskFormData,
  TaskFormErrors,
  DosageSchedule,
} from '@/features/tasks/types';
import {mockTheme} from '../../setup/mockTheme';

// FIX 3: Update mocked component path
jest.mock('@/shared/components/common', () => {
  const MockView = require('react-native').View;
  const MockTouchableOpacity = require('react-native').TouchableOpacity;
  const MockText = require('react-native').Text;

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
          {label && <MockText>Label: {label}</MockText>}
          {placeholder && <MockText>Placeholder: {placeholder}</MockText>}
          <MockText>Value: {value}</MockText>
          {error && <MockText>Error: {error}</MockText>}
          <MockText>Editable: {String(editable)}</MockText>
          {onChangeText && (
            <MockTouchableOpacity
              testID={`${inputTestId}-touchable`}
              onPress={() => onChangeText('mock change')}
            />
          )}
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

  return {Input: InputMock, TouchableInput: TouchableInputMock};
});

// FIX 4: Update mocked component path
jest.mock('@/shared/components/common/SimpleDatePicker/dateTimeFormat', () => ({
  formatDateForDisplay: jest.fn((date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `Formatted: ${year}-${month}-${day}`;
  }),
}));

// Mock hooks to prevent Redux context errors
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: require('../../setup/mockTheme').mockTheme,
    isDark: false,
  }),
  useAppDispatch: () => jest.fn(),
  useAppSelector: jest.fn(),
}));

// FIX 5: Update mocked util path
jest.mock('@/shared/utils/iconStyles', () => ({
  createIconStyles: jest.fn(() => ({
    dropdownIcon: {width: 16, height: 16},
  })),
}));

// FIX 6: Update mocked style path
jest.mock('@/features/tasks/components/shared/taskFormStyles', () => ({
  createTaskFormSectionStyles: jest.fn(() => ({
    fieldGroup: {},
    textArea: {},
    dateTimeRow: {},
    dateTimeField: {},
    calendarIcon: {},
    dosageDisplayContainer: {},
    dosageDisplayRow: {},
    dosageDisplayField: {},
  })),
}));

jest.mock('react-native/Libraries/Image/Image', () => {
  const MockView = require('react-native').View;
  const MockText = require('react-native').Text;
  const MockImage = (props: any) => (
    <MockView testID="mock-image">
      <MockText>Source: {props.source}</MockText>
    </MockView>
  );
  MockImage.displayName = 'Image';
  return MockImage;
});

const baseFormData: TaskFormData = {
  title: 'Give Medication',
  date: null,
  time: null,
  frequency: null,
  medicineName: '',
  medicineType: null,
  dosages: [],
  medicationFrequency: null,
  startDate: null,
  endDate: null,
  category: 'health',
  subcategory: null,
  parasitePreventionType: null,
  chronicConditionType: null,
  healthTaskType: 'give-medication',
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
  observationalTool: null,
  description: '',
};

const baseErrors: TaskFormErrors = {};

const mockDate1 = new Date();
mockDate1.setHours(8, 0, 0, 0);
const mockDate2 = new Date();
mockDate2.setHours(20, 0, 0, 0);

const mockDosages: DosageSchedule[] = [
  {id: '1', label: '1 Tablet', time: mockDate1.toISOString()},
  {id: '2', label: '0.5 Tablet', time: mockDate2.toISOString()},
];

interface TestProps {
  formData?: Partial<TaskFormData>;
  errors?: Partial<TaskFormErrors>;
  showDosageDisplay?: boolean;
}

const renderComponent = ({
  formData = {},
  errors = {},
  showDosageDisplay = true,
}: TestProps = {}) => {
  const mockUpdateField = jest.fn();
  const mockOnOpenMedicationTypeSheet = jest.fn();
  const mockOnOpenDosageSheet = jest.fn();
  const mockOnOpenMedicationFrequencySheet = jest.fn();
  const mockOnOpenStartDatePicker = jest.fn();
  const mockOnOpenEndDatePicker = jest.fn();

  const fullFormData = {
    ...baseFormData,
    ...formData,
  } as TaskFormData;

  const props = {
    formData: fullFormData,
    errors: {...baseErrors, ...errors} as TaskFormErrors,
    updateField: mockUpdateField,
    onOpenMedicationTypeSheet: mockOnOpenMedicationTypeSheet,
    onOpenDosageSheet: mockOnOpenDosageSheet,
    onOpenMedicationFrequencySheet: mockOnOpenMedicationFrequencySheet,
    onOpenStartDatePicker: mockOnOpenStartDatePicker,
    onOpenEndDatePicker: mockOnOpenEndDatePicker,
    theme: mockTheme,
    showDosageDisplay: showDosageDisplay,
  };

  render(<MedicationFormSection {...props} />);

  return {
    mockUpdateField,
    mockOnOpenMedicationTypeSheet,
    mockOnOpenDosageSheet,
    mockOnOpenMedicationFrequencySheet,
    mockOnOpenStartDatePicker,
    mockOnOpenEndDatePicker,
  };
};

describe('MedicationFormSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (formatDateForDisplay as jest.Mock).mockImplementation(
      (date: Date | null): string => {
        if (!date) return '';
        const year = date.getFullYear();
        const month = (date.getMonth() + 1).toString().padStart(2, '0');
        const day = date.getDate().toString().padStart(2, '0');
        return `Formatted: ${year}-${month}-${day}`;
      },
    );
  });

  describe('Rendering', () => {
    it('renders all fields with initial data', () => {
      const startDate = new Date(2025, 9, 29);
      const endDate = new Date(2025, 10, 5);

      renderComponent({
        formData: {
          title: 'Test Med Task',
          medicineName: 'Apoquel',
          medicineType: 'tablets-pills',
          medicationFrequency: 'daily',
          startDate: startDate,
          endDate: endDate,
        },
      });

      expect(screen.getByText('Value: Test Med Task')).toBeTruthy();
      expect(screen.getByText('Value: Apoquel')).toBeTruthy();
      expect(screen.getByText('Value: tablets-pills')).toBeTruthy();
      expect(screen.getByText('Value: daily')).toBeTruthy();
      // Date assertions removed - CalendarMonthStrip renders differently
    });

    it('renders Task name as non-editable', () => {
      renderComponent();
      const titleInput = screen.getByTestId('mock-input-Task-name');
      expect(within(titleInput).getByText('Editable: false')).toBeTruthy();
    });

    it('renders placeholders for empty fields', () => {
      renderComponent();
      expect(screen.getByText('Placeholder: Medication type')).toBeTruthy();
      expect(screen.getByText('Placeholder: Dosage')).toBeTruthy();
      expect(
        screen.getByText('Placeholder: Medication frequency'),
      ).toBeTruthy();
      // Start/End Date placeholders removed - CalendarMonthStrip doesn't use placeholders
    });
  });

  describe('Dosage Text Formatting', () => {
    it('shows placeholder when dosages are empty', () => {
      renderComponent({formData: {dosages: []}});
      const dosageInput = screen.getByTestId('mock-touchable-Dosage');
      expect(within(dosageInput).getByText('Value: ')).toBeTruthy();
      expect(within(dosageInput).getByText('Placeholder: Dosage')).toBeTruthy();
    });

    it('shows "1 dosage" for one dosage', () => {
      renderComponent({formData: {dosages: [mockDosages[0]]}});
      expect(screen.getByText('Value: 1 dosage')).toBeTruthy();
    });

    it('shows "2 dosages" for two dosages', () => {
      renderComponent({formData: {dosages: mockDosages}});
      expect(screen.getByText('Value: 2 dosages')).toBeTruthy();
    });
  });

  describe('Dosage Display Section', () => {
    it('defaults showDosageDisplay to true when the prop is omitted entirely', () => {
      render(
        <MedicationFormSection
          formData={{...baseFormData, dosages: [mockDosages[0]]}}
          errors={baseErrors}
          updateField={jest.fn()}
          onOpenMedicationTypeSheet={jest.fn()}
          onOpenDosageSheet={jest.fn()}
          onOpenMedicationFrequencySheet={jest.fn()}
          onOpenStartDatePicker={jest.fn()}
          onOpenEndDatePicker={jest.fn()}
          theme={mockTheme}
        />,
      );
      expect(screen.getByText('1 Tablet')).toBeTruthy();
    });

    it('renders the "Doses" label and "Add dose" row when dosages exist', () => {
      renderComponent({
        formData: {dosages: mockDosages},
        showDosageDisplay: true,
      });
      expect(screen.getByText('Doses')).toBeTruthy();
      expect(screen.getByText('Add dose')).toBeTruthy();
    });

    it('does not render dosage display if showDosageDisplay is false', () => {
      renderComponent({
        formData: {dosages: mockDosages},
        showDosageDisplay: false,
      });
      expect(screen.queryByText('1 Tablet')).toBeNull();
      expect(screen.queryByText('Doses')).toBeNull();
      expect(screen.queryByText('Add dose')).toBeNull();
    });

    it('does not render dosage display if dosages array is empty', () => {
      renderComponent({formData: {dosages: []}, showDosageDisplay: true});
      expect(screen.queryByText('1 Tablet')).toBeNull();
      expect(screen.queryByText('Doses')).toBeNull();
      expect(screen.queryByText('Add dose')).toBeNull();
    });

    it('renders dosage display rows when showDosageDisplay is true and dosages exist', () => {
      renderComponent({
        formData: {dosages: mockDosages},
        showDosageDisplay: true,
      });

      expect(screen.getByText('1 Tablet')).toBeTruthy();
      const expectedTime1 = new Date(mockDosages[0].time).toLocaleTimeString(
        'en-US',
        {hour: 'numeric', minute: '2-digit', hour12: true},
      );
      expect(screen.getByText(expectedTime1)).toBeTruthy();

      expect(screen.getByText('0.5 Tablet')).toBeTruthy();
      const expectedTime2 = new Date(mockDosages[1].time).toLocaleTimeString(
        'en-US',
        {hour: 'numeric', minute: '2-digit', hour12: true},
      );
      expect(screen.getByText(expectedTime2)).toBeTruthy();
    });

    it('calls onOpenDosageSheet when a rendered dosage row is pressed', () => {
      const {mockOnOpenDosageSheet} = renderComponent({
        formData: {dosages: [mockDosages[0]]},
        showDosageDisplay: true,
      });
      fireEvent.press(screen.getByText('1 Tablet'));
      expect(mockOnOpenDosageSheet).toHaveBeenCalledTimes(1);
    });

    it('exposes button role and a combined label/time accessibility label on dose rows', () => {
      renderComponent({
        formData: {dosages: [mockDosages[0]]},
        showDosageDisplay: true,
      });
      const expectedTime1 = new Date(mockDosages[0].time).toLocaleTimeString(
        'en-US',
        {hour: 'numeric', minute: '2-digit', hour12: true},
      );
      const row = screen.getByLabelText(`1 Tablet, ${expectedTime1}`);
      expect(row.props.accessibilityRole).toBe('button');
    });

    it('exposes button role and label on the "Add dose" row', () => {
      renderComponent({
        formData: {dosages: [mockDosages[0]]},
        showDosageDisplay: true,
      });
      const addRow = screen.getByLabelText('Add dose');
      expect(addRow.props.accessibilityRole).toBe('button');
    });

    it('calls onOpenDosageSheet when the "Add dose" row is pressed', () => {
      const {mockOnOpenDosageSheet} = renderComponent({
        formData: {dosages: [mockDosages[0]]},
        showDosageDisplay: true,
      });
      fireEvent.press(screen.getByText('Add dose'));
      expect(mockOnOpenDosageSheet).toHaveBeenCalledTimes(1);
    });

    it('formats a time-only "HH:mm" string using today\'s date', () => {
      renderComponent({
        formData: {
          dosages: [{id: '1', label: '1 Tablet', time: '14:30'}],
        },
        showDosageDisplay: true,
      });

      const expected = new Date();
      expected.setHours(14, 30, 0, 0);
      const expectedText = expected.toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
      expect(screen.getByText(expectedText)).toBeTruthy();
    });

    it('shows "Invalid time" for a time-only string with non-numeric hours/minutes', () => {
      renderComponent({
        formData: {
          dosages: [{id: '1', label: '1 Tablet', time: 'aa:bb'}],
        },
        showDosageDisplay: true,
      });
      expect(screen.getByText('Invalid time')).toBeTruthy();
    });

    it('shows "Invalid time" for a string with neither "T" nor ":"', () => {
      renderComponent({
        formData: {
          dosages: [{id: '1', label: '1 Tablet', time: 'notatime'}],
        },
        showDosageDisplay: true,
      });
      expect(screen.getByText('Invalid time')).toBeTruthy();
    });

    it('shows "Invalid time" for an unparseable ISO-like string', () => {
      renderComponent({
        formData: {
          dosages: [{id: '1', label: '1 Tablet', time: 'not-a-date-Tzz'}],
        },
        showDosageDisplay: true,
      });
      expect(screen.getByText('Invalid time')).toBeTruthy();
    });

    it('shows "Invalid time" when formatting throws (e.g. a non-string time value)', () => {
      renderComponent({
        formData: {
          dosages: [{id: '1', label: '1 Tablet', time: null as any}],
        },
        showDosageDisplay: true,
      });
      expect(screen.getByText('Invalid time')).toBeTruthy();
    });
  });

  describe('Interactions', () => {
    it('calls updateField on "Task name" change', () => {
      const {mockUpdateField} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-input-Task-name-touchable'));
      expect(mockUpdateField).toHaveBeenCalledWith('title', 'mock change');
    });

    it('calls updateField on "Task description" change', () => {
      const {mockUpdateField} = renderComponent();
      fireEvent.press(
        screen.getByTestId('mock-input-Task-description-(optional)-touchable'),
      );
      expect(mockUpdateField).toHaveBeenCalledWith(
        'description',
        'mock change',
      );
    });

    it('calls updateField on "Medicine name" change', () => {
      const {mockUpdateField} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-input-Medicine-name-touchable'));
      expect(mockUpdateField).toHaveBeenCalledWith(
        'medicineName',
        'mock change',
      );
    });

    it('calls onOpenMedicationTypeSheet on "Medication type" press', () => {
      const {mockOnOpenMedicationTypeSheet} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-Medication-type'));
      expect(mockOnOpenMedicationTypeSheet).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenDosageSheet on "Dosage" press', () => {
      const {mockOnOpenDosageSheet} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-Dosage'));
      expect(mockOnOpenDosageSheet).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenMedicationFrequencySheet on "Medication frequency" press', () => {
      const {mockOnOpenMedicationFrequencySheet} = renderComponent();
      fireEvent.press(
        screen.getByTestId('mock-touchable-Medication-frequency'),
      );
      expect(mockOnOpenMedicationFrequencySheet).toHaveBeenCalledTimes(1);
    });

    // Date picker tests removed - component now uses CalendarMonthStrip instead of TouchableInput
    // TODO: Add tests for CalendarMonthStrip interaction if needed
  });

  describe('Error Display', () => {
    it('passes error props to main fields', () => {
      renderComponent({
        errors: {
          title: 'Title error',
          medicineName: 'Medicine name error',
          medicineType: 'Type error',
          dosages: 'Dosage error',
          medicationFrequency: 'Frequency error',
        },
      });

      expect(screen.getByText('Error: Title error')).toBeTruthy();
      expect(screen.getByText('Error: Medicine name error')).toBeTruthy();
      expect(screen.getByText('Error: Type error')).toBeTruthy();
      expect(screen.getByText('Error: Dosage error')).toBeTruthy();
      expect(screen.getByText('Error: Frequency error')).toBeTruthy();
      // Start/End date errors removed - CalendarMonthStrip doesn't show errors the same way
    });
  });
});
