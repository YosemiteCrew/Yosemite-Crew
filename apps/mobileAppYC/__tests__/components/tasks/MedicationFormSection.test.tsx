import React from 'react';
import {render, screen, fireEvent, within} from '@testing-library/react-native';
import {MedicationFormSection} from '@/components/tasks/MedicationFormSection/MedicationFormSection';
import {formatDateForDisplay} from '@/components/common/SimpleDatePicker/SimpleDatePicker';

import type {
  TaskFormData,
  TaskFormErrors,
  DosageSchedule,
} from '@/features/tasks/types';

jest.mock('@/components/common', () => {
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

jest.mock('@/components/common/SimpleDatePicker/SimpleDatePicker', () => ({
  formatDateForDisplay: jest.fn((date: Date | null): string => {
    if (!date) return '';
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `Formatted: ${year}-${month}-${day}`;
  }),
}));

jest.mock('@/utils/iconStyles', () => ({
  createIconStyles: jest.fn(() => ({
    dropdownIcon: {width: 16, height: 16},
  })),
}));

jest.mock('@/components/tasks/shared/taskFormStyles', () => ({
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

const mockTheme = {
  spacing: {1: 4, 2: 8, 3: 12, 4: 16},
  typography: {},
  colors: {},
};

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
      expect(screen.getByText('Value: Formatted: 2025-10-29')).toBeTruthy();
      expect(screen.getByText('Value: Formatted: 2025-11-05')).toBeTruthy();
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
      expect(screen.getByText('Placeholder: Start Date')).toBeTruthy();
      expect(screen.getByText('Placeholder: End Date')).toBeTruthy();
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
    it('does not render dosage display if showDosageDisplay is false', () => {
      renderComponent({
        formData: {dosages: mockDosages},
        showDosageDisplay: false,
      });
      expect(screen.queryByText('Value: 1 Tablet')).toBeNull();
    });

    it('does not render dosage display if dosages array is empty', () => {
      renderComponent({formData: {dosages: []}, showDosageDisplay: true});
      expect(screen.queryByText('Value: 1 Tablet')).toBeNull();
    });

    it('renders dosage display rows when showDosageDisplay is true and dosages exist', () => {
      renderComponent({
        formData: {dosages: mockDosages},
        showDosageDisplay: true,
      });

      expect(screen.getByText('Value: 1 Tablet')).toBeTruthy();
      const expectedTime1 = new Date(mockDosages[0].time).toLocaleTimeString(
        'en-US',
        {hour: 'numeric', minute: '2-digit', hour12: true},
      );
      expect(screen.getByText(`Value: ${expectedTime1}`)).toBeTruthy();

      expect(screen.getByText('Value: 0.5 Tablet')).toBeTruthy();
      const expectedTime2 = new Date(mockDosages[1].time).toLocaleTimeString(
        'en-US',
        {hour: 'numeric', minute: '2-digit', hour12: true},
      );
      expect(screen.getByText(`Value: ${expectedTime2}`)).toBeTruthy();
    });

    it('calls onOpenDosageSheet when a rendered dosage row is pressed', () => {
      const {mockOnOpenDosageSheet} = renderComponent({
        formData: {dosages: [mockDosages[0]]},
        showDosageDisplay: true,
      });
      fireEvent.press(screen.getByText('Value: 1 Tablet'));
      expect(mockOnOpenDosageSheet).toHaveBeenCalledTimes(1);
    });
  });

  describe('Interactions', () => {
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

    it('calls onOpenStartDatePicker on "Start Date" press', () => {
      const {mockOnOpenStartDatePicker} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-Start-Date'));
      expect(mockOnOpenStartDatePicker).toHaveBeenCalledTimes(1);
    });

    it('calls onOpenEndDatePicker on "End Date" press', () => {
      const {mockOnOpenEndDatePicker} = renderComponent();
      fireEvent.press(screen.getByTestId('mock-touchable-End-Date'));
      expect(mockOnOpenEndDatePicker).toHaveBeenCalledTimes(1);
    });
  });

  describe('Error Display', () => {
    it('passes error props to all fields', () => {
      renderComponent({
        errors: {
          title: 'Title error',
          medicineName: 'Medicine name error',
          medicineType: 'Type error',
          dosages: 'Dosage error',
          medicationFrequency: 'Frequency error',
          startDate: 'Start date error',
          endDate: 'End date error',
        },
      });

      expect(screen.getByText('Error: Title error')).toBeTruthy();
      expect(screen.getByText('Error: Medicine name error')).toBeTruthy();
      expect(screen.getByText('Error: Type error')).toBeTruthy();
      expect(screen.getByText('Error: Dosage error')).toBeTruthy();
      expect(screen.getByText('Error: Frequency error')).toBeTruthy();
      expect(screen.getByText('Error: Start date error')).toBeTruthy();
      expect(screen.getByText('Error: End date error')).toBeTruthy();
    });
  });
});
