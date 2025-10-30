import React from 'react';
import {render, screen, fireEvent, act} from '@testing-library/react-native';
import {TaskFormContent} from '@/features/tasks/components/form/TaskFormContent';
import type {
  TaskFormData,
  TaskFormErrors,
  TaskTypeSelection,
  ReminderOption,
} from '@/features/tasks/types';
// We only need Switch for the test, not the mocks

// --- Mocks ---

jest.mock('@/shared/components/common', () => ({
  TouchableInput: jest.fn(() => {
    // FIX: Require dependencies inside the mock
    const {TouchableOpacity, View} = require('react-native');
    return (
      <TouchableOpacity testID="mock-TouchableInput">
        <View />
      </TouchableOpacity>
    );
  }),
}));

jest.mock('@/features/documents/components/DocumentAttachmentsSection', () => ({
  DocumentAttachmentsSection: jest.fn(() => {
    // FIX: Require dependencies inside the mock
    const {View} = require('react-native');
    return <View testID="mock-DocumentAttachmentsSection" />;
  }),
}));

jest.mock('@/features/tasks/screens/AddTaskScreen/components', () => {
  // FIX: Require dependencies inside the mock
  const {View} = require('react-native');
  return {
    MedicationFormSection: jest.fn(() => (
      <View testID="mock-MedicationFormSection" />
    )),
    ObservationalToolFormSection: jest.fn(() => (
      <View testID="mock-ObservationalToolFormSection" />
    )),
    SimpleTaskFormSection: jest.fn(() => (
      <View testID="mock-SimpleTaskFormSection" />
    )),
    ReminderSection: jest.fn(() => <View testID="mock-ReminderSection" />),
    CalendarSyncSection: jest.fn(() => (
      <View testID="mock-CalendarSyncSection" />
    )),
    CommonTaskFields: jest.fn(() => <View testID="mock-CommonTaskFields" />),
  };
});

jest.mock('@/assets/images', () => ({
  Images: {
    dropdownIcon: 'dropdown-icon-path',
  },
}));

jest.mock('@/shared/utils/iconStyles', () => ({
  createIconStyles: jest.fn(() => ({
    dropdownIcon: {width: 20, height: 20},
  })),
}));

// --- Mock Props Setup ---

const mockUpdateField = jest.fn();
const mockTaskTypeSelectorProps = {
  onPress: jest.fn(),
  value: 'Test Task Type',
  error: 'Test Error',
};
const mockSheetHandlers = {
  onOpenMedicationTypeSheet: jest.fn(),
  onOpenDosageSheet: jest.fn(),
  onOpenMedicationFrequencySheet: jest.fn(),
  onOpenStartDatePicker: jest.fn(),
  onOpenEndDatePicker: jest.fn(),
  onOpenObservationalToolSheet: jest.fn(),
  onOpenDatePicker: jest.fn(),
  onOpenTimePicker: jest.fn(),
  onOpenTaskFrequencySheet: jest.fn(),
  onOpenAssignTaskSheet: jest.fn(),
  onOpenCalendarSyncSheet: jest.fn(),
};
const mockFileHandlers = {
  onAddPress: jest.fn(),
  onRequestRemove: jest.fn(),
};

const mockTheme = {
  colors: {borderMuted: '#ccc', primary: '#007bff', white: '#fff'},
};
const mockStyles = {
  fieldGroup: {},
  toggleSection: {},
  toggleLabel: {},
};
const mockReminderOptions: ReminderOption[] = ['5-mins-prior', '1-hour-prior'];
const mockErrors: TaskFormErrors = {};

const mockFormData: TaskFormData = {
  category: 'custom',
  subcategory: null,
  parasitePreventionType: null,
  chronicConditionType: null,
  healthTaskType: null,
  hygieneTaskType: null,
  dietaryTaskType: null,
  title: 'Test Task',
  date: null,
  time: null,
  frequency: 'daily',
  assignedTo: null,
  reminderEnabled: false,
  reminderOptions: null,
  syncWithCalendar: false,
  calendarProvider: null,
  attachDocuments: false,
  // Matched TaskAttachment type from previous file
  attachments: [
    {
      id: 'file1',
      name: 'test.pdf',
      uri: 'file://test.pdf',
      type: 'pdf',
      size: 100,
    },
  ],
  additionalNote: '',
  medicineName: '',
  medicineType: null,
  dosages: [],
  medicationFrequency: null,
  startDate: null,
  endDate: null,
  observationalTool: null,
  description: '',
};

const mockTaskTypeSelection: TaskTypeSelection = {
  category: 'health',
  taskType: 'give-medication',
  label: 'Give Medication',
};

// --- Render Helper ---
const renderComponent = (
  props: Partial<React.ComponentProps<typeof TaskFormContent>>,
) => {
  const defaultProps: React.ComponentProps<typeof TaskFormContent> = {
    formData: mockFormData,
    errors: mockErrors,
    theme: mockTheme,
    updateField: mockUpdateField,
    isMedicationForm: false,
    isObservationalToolForm: false,
    isSimpleForm: false,
    reminderOptions: mockReminderOptions,
    styles: mockStyles,
    sheetHandlers: mockSheetHandlers,
    fileHandlers: mockFileHandlers,
  };
  return render(<TaskFormContent {...defaultProps} {...props} />);
};

// --- Tests ---

describe('TaskFormContent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Clear mock calls for component mocks
    (
      require('@/shared/components/common').TouchableInput as jest.Mock
    ).mockClear();
    (
      require('@/features/documents/components/DocumentAttachmentsSection')
        .DocumentAttachmentsSection as jest.Mock
    ).mockClear();
    (
      require('@/features/tasks/screens/AddTaskScreen/components')
        .MedicationFormSection as jest.Mock
    ).mockClear();
    (
      require('@/features/tasks/screens/AddTaskScreen/components')
        .ObservationalToolFormSection as jest.Mock
    ).mockClear();
    (
      require('@/features/tasks/screens/AddTaskScreen/components')
        .SimpleTaskFormSection as jest.Mock
    ).mockClear();
  });

  it('renders the TaskTypeSelector when showTaskTypeSelector is true and props are provided', () => {
    renderComponent({
      showTaskTypeSelector: true,
      taskTypeSelectorProps: mockTaskTypeSelectorProps,
    });

    const selector = screen.getByTestId('mock-TouchableInput');
    expect(selector).toBeTruthy();

    const props = (
      require('@/shared/components/common').TouchableInput as jest.Mock
    ).mock.calls[0][0];
    expect(props.value).toBe('Test Task Type');
    expect(props.error).toBe('Test Error');
    expect(props.label).toBeUndefined();

    expect(screen.queryByTestId('mock-CommonTaskFields')).toBeNull();
  });

  it('renders the TaskTypeSelector with label when taskTypeSelection is also provided', () => {
    renderComponent({
      showTaskTypeSelector: true,
      taskTypeSelectorProps: mockTaskTypeSelectorProps,
      taskTypeSelection: mockTaskTypeSelection,
    });

    const props = (
      require('@/shared/components/common').TouchableInput as jest.Mock
    ).mock.calls[0][0];
    expect(props.label).toBe('Task type');
    expect(screen.getByTestId('mock-CommonTaskFields')).toBeTruthy();
  });

  it('calls taskTypeSelectorProps.onPress when selector is pressed', () => {
    renderComponent({
      showTaskTypeSelector: true,
      taskTypeSelectorProps: mockTaskTypeSelectorProps,
    });

    const selector = screen.getByTestId('mock-TouchableInput');
    fireEvent.press(selector);
    expect(mockTaskTypeSelectorProps.onPress).toHaveBeenCalledTimes(1);
  });

  it('does NOT render TaskTypeSelector when showTaskTypeSelector is false', () => {
    renderComponent({
      showTaskTypeSelector: false,
      taskTypeSelectorProps: mockTaskTypeSelectorProps,
    });

    expect(screen.queryByTestId('mock-TouchableInput')).toBeNull();
    expect(screen.getByTestId('mock-CommonTaskFields')).toBeTruthy();
  });

  it('renders MedicationFormSection when isMedicationForm is true', () => {
    renderComponent({isMedicationForm: true});
    expect(screen.getByTestId('mock-MedicationFormSection')).toBeTruthy();
    expect(
      screen.queryByTestId('mock-ObservationalToolFormSection'),
    ).toBeNull();
    expect(screen.queryByTestId('mock-SimpleTaskFormSection')).toBeNull();
  });

  it('renders ObservationalToolFormSection when isObservationalToolForm is true', () => {
    renderComponent({isObservationalToolForm: true});
    expect(screen.queryByTestId('mock-MedicationFormSection')).toBeNull();
    expect(
      screen.getByTestId('mock-ObservationalToolFormSection'),
    ).toBeTruthy();
    expect(screen.queryByTestId('mock-SimpleTaskFormSection')).toBeNull();
  });

  it('renders SimpleTaskFormSection when isSimpleForm is true', () => {
    renderComponent({isSimpleForm: true});
    expect(screen.queryByTestId('mock-MedicationFormSection')).toBeNull();
    expect(
      screen.queryByTestId('mock-ObservationalToolFormSection'),
    ).toBeNull();
    expect(screen.getByTestId('mock-SimpleTaskFormSection')).toBeTruthy();
  });

  it('renders all common sections when form is visible', () => {
    renderComponent({isSimpleForm: true});
    expect(screen.getByTestId('mock-SimpleTaskFormSection')).toBeTruthy();
    expect(screen.getByTestId('mock-CommonTaskFields')).toBeTruthy();
    expect(screen.getByTestId('mock-ReminderSection')).toBeTruthy();
    expect(screen.getByTestId('mock-CalendarSyncSection')).toBeTruthy();
    expect(screen.getByRole('switch')).toBeTruthy();
  });

  it('toggles attachDocuments field when Switch is pressed', () => {
    renderComponent({formData: {...mockFormData, attachDocuments: false}});

    const attachSwitch = screen.getByRole('switch');
    expect(attachSwitch.props.value).toBe(false);

    act(() => fireEvent(attachSwitch, 'onValueChange', true));

    expect(mockUpdateField).toHaveBeenCalledWith('attachDocuments', true);
  });

  it('does NOT render DocumentAttachmentsSection when attachDocuments is false', () => {
    renderComponent({formData: {...mockFormData, attachDocuments: false}});
    expect(screen.queryByTestId('mock-DocumentAttachmentsSection')).toBeNull();
  });

  it('renders DocumentAttachmentsSection when attachDocuments is true and passes handlers', () => {
    renderComponent({
      formData: {...mockFormData, attachDocuments: true},
      fileError: 'Test file error',
    });

    const attachments = screen.getByTestId('mock-DocumentAttachmentsSection');
    expect(attachments).toBeTruthy();

    const props = (
      require('@/features/documents/components/DocumentAttachmentsSection')
        .DocumentAttachmentsSection as jest.Mock
    ).mock.calls[0][0];
    expect(props.files).toBe(mockFormData.attachments);
    expect(props.error).toBe('Test file error');

    // Test callbacks
    act(() => props.onAddPress());
    expect(mockFileHandlers.onAddPress).toHaveBeenCalledTimes(1);

    act(() => props.onRequestRemove({id: 'file1'}));
    expect(mockFileHandlers.onRequestRemove).toHaveBeenCalledWith('file1');
  });
});
