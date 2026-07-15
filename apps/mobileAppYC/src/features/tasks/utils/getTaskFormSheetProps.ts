/**
 * Extracts all sheet-related props from hook data to avoid duplication
 * in AddTaskScreen and EditTaskScreen
 */
export const getTaskFormSheetProps = (hookData: any) => ({
  pickerControls: {
    date: {
      visible: hookData.showDatePicker,
      setVisible: hookData.setShowDatePicker,
    },
    time: {
      visible: hookData.showTimePicker,
      setVisible: hookData.setShowTimePicker,
    },
    startDate: {
      visible: hookData.showStartDatePicker,
      setVisible: hookData.setShowStartDatePicker,
    },
    endDate: {
      visible: hookData.showEndDatePicker,
      setVisible: hookData.setShowEndDatePicker,
    },
  },
  fileToDelete: hookData.fileToDelete,
  handleTakePhoto: hookData.handleTakePhoto,
  handleChooseFromGallery: hookData.handleChooseFromGallery,
  handleUploadFromDrive: hookData.handleUploadFromDrive,
  confirmDeleteFile: hookData.confirmDeleteFile,
  closeSheet: hookData.closeSheet,
  closeTaskSheet: hookData.closeTaskSheet,
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
