import React from 'react';
import {render} from '@testing-library/react-native';
import {TaskBottomSheets} from '@/features/tasks/components/form/TaskBottomSheets';
import type {
  TaskFormData,
  TaskFrequency,
  MedicationFrequency,
  ObservationalTool,
  MedicationType,
  DosageSchedule,
  TaskTypeSelection, // Added this import
} from '@/features/tasks/types';
import type {
  TaskBottomSheetHandlers,
  TaskSheetRefs,
  TaskTypeSheetProps,
} from '@/features/tasks/components/form/taskSheetTypes';

// Define the inline CalendarProvider type
type CalendarProviderType = 'google' | 'icloud' | null;

// --- Mocks ---
// FIX: Revert to the simple mocking strategy to fix the hoisting crash.
// The linter warnings about unused imports are incorrect because we use
// these imports for type-casting the 'require' mocks below.
jest.mock('@/features/tasks/components', () => ({
  TaskTypeBottomSheet: jest.fn(() => null),
  MedicationTypeBottomSheet: jest.fn(() => null),
  DosageBottomSheet: jest.fn(() => null),
  MedicationFrequencyBottomSheet: jest.fn(() => null),
  TaskFrequencyBottomSheet: jest.fn(() => null),
  AssignTaskBottomSheet: jest.fn(() => null),
  CalendarSyncBottomSheet: jest.fn(() => null),
  ObservationalToolBottomSheet: jest.fn(() => null),
}));
jest.mock(
  '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet',
  () => ({UploadDocumentBottomSheet: jest.fn(() => null)}),
);
jest.mock(
  '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet',
  () => ({DeleteDocumentBottomSheet: jest.fn(() => null)}),
);
jest.mock(
  '@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet',
  () => ({DiscardChangesBottomSheet: jest.fn(() => null)}),
);

// Get typed references AFTER mocks are defined
const MockTaskTypeBottomSheet = require('@/features/tasks/components')
  .TaskTypeBottomSheet as jest.Mock;
const MockMedicationTypeBottomSheet = require('@/features/tasks/components')
  .MedicationTypeBottomSheet as jest.Mock;
const MockDosageBottomSheet = require('@/features/tasks/components')
  .DosageBottomSheet as jest.Mock;
const MockMedicationFrequencyBottomSheet =
  require('@/features/tasks/components')
    .MedicationFrequencyBottomSheet as jest.Mock;
const MockTaskFrequencyBottomSheet = require('@/features/tasks/components')
  .TaskFrequencyBottomSheet as jest.Mock;
const MockAssignTaskBottomSheet = require('@/features/tasks/components')
  .AssignTaskBottomSheet as jest.Mock;
const MockCalendarSyncBottomSheet = require('@/features/tasks/components')
  .CalendarSyncBottomSheet as jest.Mock;
const MockObservationalToolBottomSheet = require('@/features/tasks/components')
  .ObservationalToolBottomSheet as jest.Mock;
const MockUploadDocumentBottomSheet =
  require('@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet')
    .UploadDocumentBottomSheet as jest.Mock;
const MockDeleteDocumentBottomSheet =
  require('@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet')
    .DeleteDocumentBottomSheet as jest.Mock;
const MockDiscardChangesBottomSheet =
  require('@/shared/components/common/DiscardChangesBottomSheet/DiscardChangesBottomSheet')
    .DiscardChangesBottomSheet as jest.Mock;
// --- End Mocks ---

describe('TaskBottomSheets', () => {
  const mockUpdateField = jest.fn();
  const mockHandlers: TaskBottomSheetHandlers = {
    closeSheet: jest.fn(),
    handleTakePhoto: jest.fn(),
    handleChooseFromGallery: jest.fn(),
    handleUploadFromDrive: jest.fn(),
    confirmDeleteFile: jest.fn(),
    onDiscard: jest.fn(),
  };
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
    deleteSheetRef: React.createRef(),
    discardSheetRef: React.createRef(),
  };

  const mockFormData: TaskFormData = {
    // FIX: Removed 'name', 'type', and 'companionId' from root as they aren't in TaskFormData

    // Properties from BaseTaskFormData
    category: 'custom',
    subcategory: null,
    parasitePreventionType: null,
    chronicConditionType: null,
    healthTaskType: null,
    hygieneTaskType: null,
    dietaryTaskType: null,
    title: 'Test Task Title',
    date: null,
    time: null,
    frequency: 'weekly',
    assignedTo: 'user1',
    reminderEnabled: false,
    reminderOptions: null,
    syncWithCalendar: false,
    calendarProvider: 'google',
    attachDocuments: false,
    // FIX: Matched TaskAttachment interface (uri, size, etc.)
    attachments: [
      {
        id: 'file1',
        name: 'report.pdf',
        uri: 'http://',
        type: 'application/pdf',
        size: 1024,
      },
    ],
    additionalNote: '',

    // Properties from MedicationFormData
    medicineName: '',
    medicineType: 'tablets-pills',
    dosages: [{id: 'd1', label: 'Dose 1', time: '08:00'}],
    medicationFrequency: 'daily',
    startDate: null,
    endDate: null,

    // Properties from ObservationalToolFormData
    observationalTool: 'canine-acute-pain-scale',

    // Property from TaskFormData
    description: 'Test Description',
  };

  // Helper function
  const renderComponent = (
    overrideProps: Partial<React.ComponentProps<typeof TaskBottomSheets>> = {},
  ) => {
    const defaultProps: React.ComponentProps<typeof TaskBottomSheets> = {
      formData: mockFormData,
      updateField: mockUpdateField,
      companionType: 'dog',
      fileToDelete: null,
      refs: mockRefs,
      handlers: mockHandlers,
      taskTypeSheetProps: undefined,
    };

    const finalFormData = overrideProps.formData
      ? {...mockFormData, ...(overrideProps.formData as Partial<TaskFormData>)}
      : defaultProps.formData;

    const finalProps = {
      ...defaultProps,
      ...overrideProps,
      formData: finalFormData,
    };

    return render(<TaskBottomSheets {...finalProps} />);
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  // --- Tests ---

  it('renders all standard bottom sheets', () => {
    renderComponent();
    expect(MockMedicationTypeBottomSheet).toHaveBeenCalled();
    expect(MockDosageBottomSheet).toHaveBeenCalled();
    expect(MockMedicationFrequencyBottomSheet).toHaveBeenCalled();
    expect(MockTaskFrequencyBottomSheet).toHaveBeenCalled();
    expect(MockAssignTaskBottomSheet).toHaveBeenCalled();
    expect(MockCalendarSyncBottomSheet).toHaveBeenCalled();
    expect(MockObservationalToolBottomSheet).toHaveBeenCalled();
    expect(MockUploadDocumentBottomSheet).toHaveBeenCalled();
    expect(MockDeleteDocumentBottomSheet).toHaveBeenCalled();
    expect(MockDiscardChangesBottomSheet).toHaveBeenCalled();
  });

  it('does not render TaskTypeBottomSheet if taskTypeSheetProps is not provided', () => {
    renderComponent();
    expect(MockTaskTypeBottomSheet).not.toHaveBeenCalled();
  });

  it('renders TaskTypeBottomSheet when taskTypeSheetProps are provided', () => {
    // FIX: Create a full TaskTypeSelection object as expected by the prop
    const mockTaskTypeSelection: TaskTypeSelection = {
      category: 'health',
      taskType: 'give-medication',
      label: 'Give Medication',
    };

    const taskTypeSheetProps: TaskTypeSheetProps = {
      selectedTaskType: mockTaskTypeSelection, // Pass the object
      onSelect: jest.fn(),
    };

    renderComponent({taskTypeSheetProps});

    expect(MockTaskTypeBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockTaskTypeBottomSheet.mock.calls[0][0];

    // Check against the object
    expect(actualProps).toMatchObject({
      selectedTaskType: mockTaskTypeSelection,
      onSelect: taskTypeSheetProps.onSelect,
      companionType: 'dog',
    });
  });

  it('passes correct props and handles updateField for MedicationTypeBottomSheet', () => {
    renderComponent();
    expect(MockMedicationTypeBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockMedicationTypeBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({selectedType: 'tablets-pills'});
    const newType: MedicationType = 'liquids';
    actualProps.onSelect(newType);
    expect(mockUpdateField).toHaveBeenCalledWith('medicineType', newType);
  });

  it('passes correct props and handles onSave for DosageBottomSheet', () => {
    renderComponent();
    expect(MockDosageBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockDosageBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({dosages: mockFormData.dosages});
    const newDosages: DosageSchedule[] = [
      {id: 'd2', label: 'Dose 2', time: '10:00'},
    ];
    actualProps.onSave(newDosages);
    expect(mockUpdateField).toHaveBeenCalledWith('dosages', newDosages);
  });

  it('passes correct props and handles updateField for MedicationFrequencyBottomSheet', () => {
    renderComponent();
    expect(MockMedicationFrequencyBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockMedicationFrequencyBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({selectedFrequency: 'daily'});
    const newFrequency: MedicationFrequency = 'weekly';
    actualProps.onSelect(newFrequency);
    expect(mockUpdateField).toHaveBeenCalledWith(
      'medicationFrequency',
      newFrequency,
    );
  });

  it('passes correct props and handles updateField for TaskFrequencyBottomSheet', () => {
    renderComponent();
    expect(MockTaskFrequencyBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockTaskFrequencyBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({selectedFrequency: 'weekly'});
    const newFrequency: TaskFrequency = 'monthly';
    actualProps.onSelect(newFrequency);
    expect(mockUpdateField).toHaveBeenCalledWith('frequency', newFrequency);
  });

  it('passes correct props and handles updateField for AssignTaskBottomSheet', () => {
    renderComponent();
    expect(MockAssignTaskBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockAssignTaskBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({selectedUserId: 'user1'});
    actualProps.onSelect('user2');
    expect(mockUpdateField).toHaveBeenCalledWith('assignedTo', 'user2');
  });

  it('passes correct props and handles updateField for CalendarSyncBottomSheet', () => {
    renderComponent();
    expect(MockCalendarSyncBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockCalendarSyncBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({selectedProvider: 'google'});
    const newProvider: CalendarProviderType = 'icloud';
    actualProps.onSelect(newProvider);
    expect(mockUpdateField).toHaveBeenCalledWith(
      'calendarProvider',
      newProvider,
    );
  });

  it('passes correct props and handles updateField for ObservationalToolBottomSheet', () => {
    renderComponent({companionType: 'cat'});
    expect(MockObservationalToolBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockObservationalToolBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({
      selectedTool: 'canine-acute-pain-scale',
      companionType: 'cat',
    });
    const newTool: ObservationalTool = 'feline-grimace-scale';
    actualProps.onSelect(newTool);
    expect(mockUpdateField).toHaveBeenCalledWith('observationalTool', newTool);
  });

  it('wraps UploadDocumentBottomSheet handlers with closeSheet', () => {
    renderComponent();
    expect(MockUploadDocumentBottomSheet).toHaveBeenCalledTimes(1);
    const props = MockUploadDocumentBottomSheet.mock.calls[0][0];
    props.onTakePhoto();
    expect(mockHandlers.handleTakePhoto).toHaveBeenCalledTimes(1);
    expect(mockHandlers.closeSheet).toHaveBeenCalledTimes(1);
    props.onChooseGallery();
    expect(mockHandlers.handleChooseFromGallery).toHaveBeenCalledTimes(1);
    expect(mockHandlers.closeSheet).toHaveBeenCalledTimes(2);
    props.onUploadDrive();
    expect(mockHandlers.handleUploadFromDrive).toHaveBeenCalledTimes(1);
    expect(mockHandlers.closeSheet).toHaveBeenCalledTimes(3);
  });

  it('passes correct documentTitle to DeleteDocumentBottomSheet when file is found', () => {
    renderComponent({fileToDelete: 'file1'});
    expect(MockDeleteDocumentBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockDeleteDocumentBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({
      documentTitle: 'report.pdf',
      onDelete: mockHandlers.confirmDeleteFile,
    });
  });

  it('passes undefined documentTitle to DeleteDocumentBottomSheet when file ID exists but file is not found', () => {
    const formDataWithoutFile = {...mockFormData, attachments: []};
    renderComponent({
      fileToDelete: 'file-not-found',
      formData: formDataWithoutFile,
    });
    expect(MockDeleteDocumentBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockDeleteDocumentBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({
      documentTitle: undefined,
      onDelete: mockHandlers.confirmDeleteFile,
    });
  });

  it('passes fallback documentTitle "this file" when fileToDelete is null', () => {
    renderComponent({fileToDelete: null});
    expect(MockDeleteDocumentBottomSheet).toHaveBeenCalledTimes(1);
    const actualProps = MockDeleteDocumentBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({
      documentTitle: 'this file',
      onDelete: mockHandlers.confirmDeleteFile,
    });
  });

  it('passes correct handler to DiscardChangesBottomSheet', () => {
    renderComponent();
    expect(MockDeleteDocumentBottomSheet).toHaveBeenCalledTimes(1); // This was a typo in your last file, fixed
    const actualProps = MockDiscardChangesBottomSheet.mock.calls[0][0];
    expect(actualProps).toMatchObject({onDiscard: mockHandlers.onDiscard});
    actualProps.onDiscard();
    expect(mockHandlers.onDiscard).toHaveBeenCalledTimes(1);
  });
});
