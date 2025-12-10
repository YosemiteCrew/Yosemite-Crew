import {getTaskFormSheetProps} from '@/features/tasks/utils/getTaskFormSheetProps';

describe('getTaskFormSheetProps', () => {
  it('correctly extracts and maps all sheet-related properties from hook data', () => {
    // Create a mock object with unique values to verify mapping
    const mockHookData = {
      showDatePicker: 'mock_showDatePicker',
      setShowDatePicker: 'mock_setShowDatePicker',
      showTimePicker: 'mock_showTimePicker',
      setShowTimePicker: 'mock_setShowTimePicker',
      showStartDatePicker: 'mock_showStartDatePicker',
      setShowStartDatePicker: 'mock_setShowStartDatePicker',
      showEndDatePicker: 'mock_showEndDatePicker',
      setShowEndDatePicker: 'mock_setShowEndDatePicker',
      fileToDelete: 'mock_fileToDelete',
      handleTakePhoto: 'mock_handleTakePhoto',
      handleChooseFromGallery: 'mock_handleChooseFromGallery',
      handleUploadFromDrive: 'mock_handleUploadFromDrive',
      confirmDeleteFile: 'mock_confirmDeleteFile',
      closeSheet: 'mock_closeSheet',
      closeTaskSheet: 'mock_closeTaskSheet',
      medicationTypeSheetRef: 'mock_medicationTypeSheetRef',
      dosageSheetRef: 'mock_dosageSheetRef',
      medicationFrequencySheetRef: 'mock_medicationFrequencySheetRef',
      taskFrequencySheetRef: 'mock_taskFrequencySheetRef',
      assignTaskSheetRef: 'mock_assignTaskSheetRef',
      calendarSyncSheetRef: 'mock_calendarSyncSheetRef',
      observationalToolSheetRef: 'mock_observationalToolSheetRef',
      deleteSheetRef: 'mock_deleteSheetRef',
      discardSheetRef: 'mock_discardSheetRef',
      // Add an unrelated property to ensure it is NOT copied over
      unrelatedProperty: 'should_not_be_in_result',
    };

    const result = getTaskFormSheetProps(mockHookData);

    // Verify that the result object exactly matches the expected structure
    // and contains the correct values from the source object.
    expect(result).toEqual({
      showDatePicker: 'mock_showDatePicker',
      setShowDatePicker: 'mock_setShowDatePicker',
      showTimePicker: 'mock_showTimePicker',
      setShowTimePicker: 'mock_setShowTimePicker',
      showStartDatePicker: 'mock_showStartDatePicker',
      setShowStartDatePicker: 'mock_setShowStartDatePicker',
      showEndDatePicker: 'mock_showEndDatePicker',
      setShowEndDatePicker: 'mock_setShowEndDatePicker',
      fileToDelete: 'mock_fileToDelete',
      handleTakePhoto: 'mock_handleTakePhoto',
      handleChooseFromGallery: 'mock_handleChooseFromGallery',
      handleUploadFromDrive: 'mock_handleUploadFromDrive',
      confirmDeleteFile: 'mock_confirmDeleteFile',
      closeSheet: 'mock_closeSheet',
      closeTaskSheet: 'mock_closeTaskSheet',
      medicationTypeSheetRef: 'mock_medicationTypeSheetRef',
      dosageSheetRef: 'mock_dosageSheetRef',
      medicationFrequencySheetRef: 'mock_medicationFrequencySheetRef',
      taskFrequencySheetRef: 'mock_taskFrequencySheetRef',
      assignTaskSheetRef: 'mock_assignTaskSheetRef',
      calendarSyncSheetRef: 'mock_calendarSyncSheetRef',
      observationalToolSheetRef: 'mock_observationalToolSheetRef',
      deleteSheetRef: 'mock_deleteSheetRef',
      discardSheetRef: 'mock_discardSheetRef',
    });

    // Explicitly verify that extra properties are filtered out
    expect((result as any).unrelatedProperty).toBeUndefined();
  });
});