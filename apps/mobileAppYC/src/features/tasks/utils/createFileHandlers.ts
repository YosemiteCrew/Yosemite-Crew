/**
 * Creates standardized file handlers object for TaskFormContent
 * Eliminates duplication between AddTaskScreen and EditTaskScreen
 */
export const createFileHandlers = (
  openSheet: (sheet: string) => void,
  uploadSheetRef: React.RefObject<any>,
  handleRemoveFile: (fileId: string) => void,
) => ({
  onAddPress: () => {
    openSheet('upload');
    uploadSheetRef.current?.open();
  },
  onRequestRemove: (fileId: string) => handleRemoveFile(fileId),
});
