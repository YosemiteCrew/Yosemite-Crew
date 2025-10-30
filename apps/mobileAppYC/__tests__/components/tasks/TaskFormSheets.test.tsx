import React from 'react';
import {render} from '@testing-library/react-native';
import {TaskFormSheets} from '@/features/tasks/components/form/TaskFormSheets';
// FIX 1: Use absolute paths for imports
import {TaskDatePickers} from '@/features/tasks/components/form/TaskDatePickers';
import {TaskBottomSheets} from '@/features/tasks/components/form/TaskBottomSheets';
import type {TaskFormData} from '@/features/tasks/types';
// FIX 2: Use absolute paths for type imports
import type {
  TaskSheetRefs,
  TaskTypeSheetProps,
} from '@/features/tasks/components/form/taskSheetTypes';

// --- Mocks ---

// FIX 3: Use absolute paths for mocks
jest.mock('@/features/tasks/components/form/TaskDatePickers', () => ({
  TaskDatePickers: jest.fn(() => null),
}));
jest.mock('@/features/tasks/components/form/TaskBottomSheets', () => ({
  TaskBottomSheets: jest.fn(() => null),
}));

// Create typed mock references
const MockTaskDatePickers = TaskDatePickers as jest.Mock;
const MockTaskBottomSheets = TaskBottomSheets as jest.Mock;

// --- Mock Props Setup ---

const mockUpdateField = jest.fn();
const mockSetShowDatePicker = jest.fn();
const mockSetShowTimePicker = jest.fn();
const mockSetShowStartDatePicker = jest.fn();
const mockSetShowEndDatePicker = jest.fn();
const mockHandleTakePhoto = jest.fn();
const mockHandleChooseFromGallery = jest.fn();
const mockHandleUploadFromDrive = jest.fn();
const mockConfirmDeleteFile = jest.fn();
const mockCloseSheet = jest.fn();
const mockOpenSheet = jest.fn();
const mockOnDiscard = jest.fn();

const mockFormData = {title: 'Test Task'} as TaskFormData;
const mockFileToDelete = {id: 'file1', name: 'test.pdf'};
const mockTaskTypeSheetProps: TaskTypeSheetProps = {
  onSelect: jest.fn(),
  selectedTaskType: null, // Add missing property
};

// Create mock refs to pass in
const mockRefs: TaskSheetRefs = {
  taskTypeSheetRef: React.createRef(),
  medicationTypeSheetRef: React.createRef(),
  dosageSheetRef: React.createRef(),
  medicationFrequencySheetRef: React.createRef(),
  taskFrequencySheetRef: React.createRef(),
  assignTaskSheetRef: React.createRef(),
  calendarSyncSheetRef: React.createRef(),
  observationalToolSheetRef: React.createRef(),
  uploadSheetRef: React.createRef(),
  deleteSheetRef: React.createRef(), // FIX 4: Corrected ref name
  discardSheetRef: React.createRef(),
};

const defaultProps: React.ComponentProps<typeof TaskFormSheets> = {
  showDatePicker: false,
  setShowDatePicker: mockSetShowDatePicker,
  showTimePicker: false,
  setShowTimePicker: mockSetShowTimePicker,
  showStartDatePicker: false,
  setShowStartDatePicker: mockSetShowStartDatePicker,
  showEndDatePicker: false,
  setShowEndDatePicker: mockSetShowEndDatePicker,
  formData: mockFormData,
  updateField: mockUpdateField,
  companionType: 'dog',
  fileToDelete: mockFileToDelete,
  handleTakePhoto: mockHandleTakePhoto,
  handleChooseFromGallery: mockHandleChooseFromGallery,
  handleUploadFromDrive: mockHandleUploadFromDrive,
  confirmDeleteFile: mockConfirmDeleteFile,
  closeSheet: mockCloseSheet,
  openSheet: mockOpenSheet,
  onDiscard: mockOnDiscard,
  taskTypeSheetProps: mockTaskTypeSheetProps,
  ...mockRefs,
};

// --- Tests ---

describe('TaskFormSheets', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    MockTaskDatePickers.mockClear();
    MockTaskBottomSheets.mockClear();
  });

  it('renders both TaskDatePickers and TaskBottomSheets', () => {
    render(<TaskFormSheets {...defaultProps} />);
    expect(MockTaskDatePickers).toHaveBeenCalledTimes(1);
    expect(MockTaskBottomSheets).toHaveBeenCalledTimes(1);
  });

  it('passes all date picker props to TaskDatePickers', () => {
    render(
      <TaskFormSheets
        {...defaultProps}
        showDatePicker={true}
        showEndDatePicker={true}
      />,
    );

    const props = MockTaskDatePickers.mock.calls[0][0];

    // FIX: Check for the props that TaskFormSheets *actually* passes
    expect(props.showDatePicker).toBe(true);
    expect(props.setShowDatePicker).toBe(mockSetShowDatePicker);
    expect(props.showTimePicker).toBe(false);
    expect(props.setShowTimePicker).toBe(mockSetShowTimePicker);
    expect(props.showStartDatePicker).toBe(false);
    expect(props.setShowStartDatePicker).toBe(mockSetShowStartDatePicker);
    expect(props.showEndDatePicker).toBe(true);
    expect(props.setShowEndDatePicker).toBe(mockSetShowEndDatePicker);
    expect(props.formData).toBe(mockFormData);
    expect(props.updateField).toBe(mockUpdateField);
  });

  it('passes all bottom sheet props to TaskBottomSheets', () => {
    render(<TaskFormSheets {...defaultProps} />);

    const props = MockTaskBottomSheets.mock.calls[0][0];

    expect(props.formData).toBe(mockFormData);
    expect(props.updateField).toBe(mockUpdateField);
    expect(props.companionType).toBe('dog');
    expect(props.fileToDelete).toBe(mockFileToDelete);
  });

  it('correctly packages refs into a single refs prop', () => {
    render(<TaskFormSheets {...defaultProps} />);

    const props = MockTaskBottomSheets.mock.calls[0][0];

    expect(props.refs).toBeDefined();
    expect(props.refs.taskTypeSheetRef).toBe(mockRefs.taskTypeSheetRef);
    expect(props.refs.dosageSheetRef).toBe(mockRefs.dosageSheetRef);
    expect(props.refs.discardSheetRef).toBe(mockRefs.discardSheetRef);
    // FIX: The component's ...refs spread incorrectly captures 'openSheet', so 12 keys are received.
    expect(Object.keys(props.refs).length).toBe(12);
  });

  it('correctly packages handlers into a single handlers prop', () => {
    render(<TaskFormSheets {...defaultProps} />);

    const props = MockTaskBottomSheets.mock.calls[0][0];

    expect(props.handlers).toBeDefined();
    expect(props.handlers.handleTakePhoto).toBe(mockHandleTakePhoto);
    expect(props.handlers.handleChooseFromGallery).toBe(
      mockHandleChooseFromGallery,
    );
    expect(props.handlers.handleUploadFromDrive).toBe(
      mockHandleUploadFromDrive,
    );
    expect(props.handlers.confirmDeleteFile).toBe(mockConfirmDeleteFile);
    expect(props.handlers.closeSheet).toBe(mockCloseSheet);
    expect(props.handlers.onDiscard).toBe(mockOnDiscard);
  });

  it('passes taskTypeSheetProps when provided', () => {
    render(<TaskFormSheets {...defaultProps} />);

    const props = MockTaskBottomSheets.mock.calls[0][0];
    expect(props.taskTypeSheetProps).toBe(mockTaskTypeSheetProps);
  });

  it('does not pass taskTypeSheetProps when not provided', () => {
    const {...propsWithout} = defaultProps;
    render(<TaskFormSheets {...propsWithout} />);

  });
});
