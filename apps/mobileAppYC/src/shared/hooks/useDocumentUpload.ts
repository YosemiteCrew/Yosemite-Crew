import {useFormBottomSheets, useFileOperations} from '@/hooks';
import type {DocumentFile} from '@/features/documents/types';

/**
 * Hook that manages document upload and file operations
 * Consolidates useFormBottomSheets and useFileOperations into a single interface
 */
export const useDocumentUpload = ({
  files,
  setFiles,
}: {
  files: DocumentFile[];
  setFiles: (files: DocumentFile[]) => void;
}) => {
  const {refs, openSheet, closeSheet} = useFormBottomSheets();
  const {uploadSheetRef, deleteSheetRef} = refs;

  const {
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  } = useFileOperations({
    files,
    setFiles,
    clearError: () => {},
    openSheet,
    closeSheet,
    deleteSheetRef,
  });

  return {
    // Refs
    refs: {
      uploadSheetRef,
      deleteSheetRef,
    },
    // State
    fileToDelete,
    files,
    // Sheet control
    openSheet,
    closeSheet,
    // File operations
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  };
};
