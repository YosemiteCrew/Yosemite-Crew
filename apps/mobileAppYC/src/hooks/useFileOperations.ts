import {useState} from 'react';
import {useDocumentFileHandlers} from './useDocumentFileHandlers';
import type {DocumentFile} from '@/types/document.types';

interface FileOperationsConfig<T extends DocumentFile> {
  files: T[];
  setFiles: (files: T[]) => void;
  clearError: () => void;
  openSheet: (sheetName: string) => void;
  closeSheet: () => void;
  deleteSheetRef: React.RefObject<any>;
}

export const useFileOperations = <T extends DocumentFile>({
  files,
  setFiles,
  clearError,
  openSheet,
  closeSheet,
  deleteSheetRef,
}: FileOperationsConfig<T>) => {
  const [fileToDelete, setFileToDelete] = useState<string | null>(null);

  const {handleTakePhoto, handleChooseFromGallery, handleUploadFromDrive} =
    useDocumentFileHandlers({
      files,
      setFiles,
      clearError,
    });

  const handleRemoveFile = (fileId: string) => {
    setFileToDelete(fileId);
    openSheet('delete');
    deleteSheetRef.current?.open();
  };

  const confirmDeleteFile = () => {
    if (fileToDelete) {
      setFiles(files.filter(file => file.id !== fileToDelete));
      setFileToDelete(null);
    }
    closeSheet();
  };

  return {
    fileToDelete,
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
    handleRemoveFile,
    confirmDeleteFile,
  };
};
