import React from 'react';
import {UploadDocumentBottomSheet} from '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {DeleteDocumentBottomSheet} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import type {DocumentFile} from '@/features/documents/types';

interface DocumentUploadSheetsProps {
  uploadSheetRef: React.RefObject<any>;
  deleteSheetRef: React.RefObject<any>;
  fileToDelete: string | null;
  files: DocumentFile[];
  onTakePhoto: () => void;
  onChooseGallery: () => void;
  onUploadDrive: () => void;
  confirmDeleteFile: () => void;
  closeSheet: (sheetName: string) => void;
}

/**
 * Consolidated component for document upload and deletion sheets
 * Combines UploadDocumentBottomSheet and DeleteDocumentBottomSheet
 */
export const DocumentUploadSheets: React.FC<DocumentUploadSheetsProps> = ({
  uploadSheetRef,
  deleteSheetRef,
  fileToDelete,
  files,
  onTakePhoto,
  onChooseGallery,
  onUploadDrive,
  confirmDeleteFile,
  closeSheet,
}) => (
  <>
    <UploadDocumentBottomSheet
      ref={uploadSheetRef}
      onTakePhoto={() => {
        onTakePhoto();
        closeSheet('upload');
      }}
      onChooseGallery={() => {
        onChooseGallery();
        closeSheet('upload');
      }}
      onUploadDrive={() => {
        onUploadDrive();
        closeSheet('upload');
      }}
    />

    <DeleteDocumentBottomSheet
      ref={deleteSheetRef}
      documentTitle={
        fileToDelete ? files.find(f => f.id === fileToDelete)?.name : 'this file'
      }
      onDelete={confirmDeleteFile}
    />
  </>
);
