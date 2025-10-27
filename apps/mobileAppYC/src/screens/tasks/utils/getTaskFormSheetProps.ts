/**
 * Extracts all sheet-related props from hook data to avoid duplication
 * in AddTaskScreen and EditTaskScreen
 */
export const getTaskFormSheetProps = (hookData: any) => ({
  showDatePicker: hookData.showDatePicker,
  setShowDatePicker: hookData.setShowDatePicker,
  showTimePicker: hookData.showTimePicker,
  setShowTimePicker: hookData.setShowTimePicker,
  showStartDatePicker: hookData.showStartDatePicker,
  setShowStartDatePicker: hookData.setShowStartDatePicker,
  showEndDatePicker: hookData.showEndDatePicker,
  setShowEndDatePicker: hookData.setShowEndDatePicker,
  fileToDelete: hookData.fileToDelete,
  handleTakePhoto: hookData.handleTakePhoto,
  handleChooseFromGallery: hookData.handleChooseFromGallery,
  handleUploadFromDrive: hookData.handleUploadFromDrive,
  confirmDeleteFile: hookData.confirmDeleteFile,
  closeSheet: hookData.closeSheet,
  medicationTypeSheetRef: hookData.medicationTypeSheetRef,
  dosageSheetRef: hookData.dosageSheetRef,
  medicationFrequencySheetRef: hookData.medicationFrequencySheetRef,
  taskFrequencySheetRef: hookData.taskFrequencySheetRef,
  assignTaskSheetRef: hookData.assignTaskSheetRef,
  calendarSyncSheetRef: hookData.calendarSyncSheetRef,
  observationalToolSheetRef: hookData.observationalToolSheetRef,
  deleteSheetRef: hookData.deleteSheetRef,
  discardSheetRef: hookData.discardSheetRef,
});
