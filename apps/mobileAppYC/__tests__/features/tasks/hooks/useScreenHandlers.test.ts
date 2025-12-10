import {renderHook} from '@testing-library/react-native';
// Path: 4 levels up to project root
import {useScreenHandlers} from '../../../../src/features/tasks/hooks/useScreenHandlers';
import * as UseTaskFormHandlers from '../../../../src/features/tasks/hooks/useTaskFormHandlers';
import * as UseTaskFormValidation from '../../../../src/features/tasks/hooks/useTaskFormValidation';

// --- Mocks ---

// Mock internal hooks
jest.mock('../../../../src/features/tasks/hooks/useTaskFormHandlers', () => ({
  useTaskFormHandlers: jest.fn(),
}));

jest.mock('../../../../src/features/tasks/hooks/useTaskFormValidation', () => ({
  useTaskFormValidation: jest.fn(),
}));

describe('useScreenHandlers', () => {
  // Mock data
  const mockNavigation = { navigate: jest.fn() };
  const mockSetErrors = jest.fn();
  const mockValidateTaskForm = jest.fn();

  // Mock formSetup object containing all the refs and setters required
  const mockFormSetup = {
    discardSheetRef: 'mock-discard-ref',
    medicationTypeSheetRef: 'mock-med-type-ref',
    dosageSheetRef: 'mock-dosage-ref',
    medicationFrequencySheetRef: 'mock-med-freq-ref',
    observationalToolSheetRef: 'mock-obs-tool-ref',
    taskFrequencySheetRef: 'mock-task-freq-ref',
    assignTaskSheetRef: 'mock-assign-ref',
    calendarSyncSheetRef: 'mock-calendar-ref',
    setShowDatePicker: 'mock-set-date',
    setShowTimePicker: 'mock-set-time',
    setShowStartDatePicker: 'mock-set-start-date',
    setShowEndDatePicker: 'mock-set-end-date',
    openTaskSheet: 'mock-open-sheet',
    closeTaskSheet: 'mock-close-sheet',
  };

  // Mock return values from sub-hooks
  const mockValidationResult = {
    validateForm: jest.fn(),
    showErrorAlert: jest.fn(),
  };

  const mockHandlersResult = {
    handleBack: jest.fn(),
    sheetHandlers: { someHandler: jest.fn() },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (UseTaskFormValidation.useTaskFormValidation as jest.Mock).mockReturnValue(mockValidationResult);
    (UseTaskFormHandlers.useTaskFormHandlers as jest.Mock).mockReturnValue(mockHandlersResult);
  });

  it('correctly composes validation and handler hooks', () => {
    const params = {
      hasUnsavedChanges: true,
      navigation: mockNavigation,
      formSetup: mockFormSetup,
      validateTaskForm: mockValidateTaskForm,
      setErrors: mockSetErrors,
    };

    const { result } = renderHook(() => useScreenHandlers(params));

    // 1. Verify useTaskFormValidation is called with correct params
    expect(UseTaskFormValidation.useTaskFormValidation).toHaveBeenCalledWith({
      setErrors: mockSetErrors,
      validateTaskForm: mockValidateTaskForm,
    });

    // 2. Verify useTaskFormHandlers is called with correct params, mapping from formSetup
    expect(UseTaskFormHandlers.useTaskFormHandlers).toHaveBeenCalledWith({
      hasUnsavedChanges: true,
      navigation: mockNavigation,
      discardSheetRef: mockFormSetup.discardSheetRef,
      medicationTypeSheetRef: mockFormSetup.medicationTypeSheetRef,
      dosageSheetRef: mockFormSetup.dosageSheetRef,
      medicationFrequencySheetRef: mockFormSetup.medicationFrequencySheetRef,
      observationalToolSheetRef: mockFormSetup.observationalToolSheetRef,
      taskFrequencySheetRef: mockFormSetup.taskFrequencySheetRef,
      assignTaskSheetRef: mockFormSetup.assignTaskSheetRef,
      calendarSyncSheetRef: mockFormSetup.calendarSyncSheetRef,
      setShowDatePicker: mockFormSetup.setShowDatePicker,
      setShowTimePicker: mockFormSetup.setShowTimePicker,
      setShowStartDatePicker: mockFormSetup.setShowStartDatePicker,
      setShowEndDatePicker: mockFormSetup.setShowEndDatePicker,
      openTaskSheet: mockFormSetup.openTaskSheet,
      closeTaskSheet: mockFormSetup.closeTaskSheet,
    });

    // 3. Verify the return object contains all exposed methods
    expect(result.current.validateForm).toBe(mockValidationResult.validateForm);
    expect(result.current.showErrorAlert).toBe(mockValidationResult.showErrorAlert);
    expect(result.current.handleBack).toBe(mockHandlersResult.handleBack);
    expect(result.current.sheetHandlers).toBe(mockHandlersResult.sheetHandlers);
  });
});