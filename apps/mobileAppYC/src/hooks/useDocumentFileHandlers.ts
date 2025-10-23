/* istanbul ignore file -- mock handlers for document upload UI */
import {useCallback} from 'react';
import type {DocumentFile} from '@/types/document.types';

interface UseDocumentFileHandlersParams<T extends {id: string}> {
  files: T[];
  setFiles: (files: T[]) => void;
  clearError?: () => void;
}

export const useDocumentFileHandlers = <T extends DocumentFile>({
  files,
  setFiles,
  clearError,
}: UseDocumentFileHandlersParams<T>) => {
  const handleTakePhoto = useCallback(() => {
    // Mock implementation - In real app, use react-native-image-picker
    const mockFile = {
      id: `file_${Date.now()}`,
      uri: 'file://mock-photo.jpg',
      name: 'photo.jpg',
      type: 'image/jpeg',
      size: 1024000,
    } as T;
    setFiles([...files, mockFile]);
    clearError?.();
  }, [files, setFiles, clearError]);

  const handleChooseFromGallery = useCallback(() => {
    // Mock implementation
    const mockFile = {
      id: `file_${Date.now()}`,
      uri: 'file://mock-gallery.jpg',
      name: 'gallery-image.jpg',
      type: 'image/jpeg',
      size: 2048000,
    } as T;
    setFiles([...files, mockFile]);
    clearError?.();
  }, [files, setFiles, clearError]);

  const handleUploadFromDrive = useCallback(() => {
    // Mock implementation
    const mockFile = {
      id: `file_${Date.now()}`,
      uri: 'file://mock-drive-doc.pdf',
      name: 'document.pdf',
      type: 'application/pdf',
      size: 3072000,
    } as T;
    setFiles([...files, mockFile]);
    clearError?.();
  }, [files, setFiles, clearError]);

  return {
    handleTakePhoto,
    handleChooseFromGallery,
    handleUploadFromDrive,
  };
};
