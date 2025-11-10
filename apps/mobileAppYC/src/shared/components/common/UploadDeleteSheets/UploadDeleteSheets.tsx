import React from 'react';
import {
  UploadDocumentBottomSheet,
  type UploadDocumentBottomSheetRef,
} from '@/shared/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import {
  DeleteDocumentBottomSheet,
  type DeleteDocumentBottomSheetRef,
} from '@/shared/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';

type FileLike = { id: string; name: string };

export interface UploadDeleteSheetsProps<T extends FileLike = FileLike> {
  uploadSheetRef: React.RefObject<UploadDocumentBottomSheetRef | null>;
  deleteSheetRef: React.RefObject<DeleteDocumentBottomSheetRef | null>;
  files: T[];
  fileToDelete?: string | null;
  onTakePhoto: () => void;
  onChooseGallery: () => void;
  onUploadDrive: () => void;
  onConfirmDelete: () => void;
  closeSheet: () => void;
}

export const UploadDeleteSheets = <T extends FileLike = FileLike>({
  uploadSheetRef,
  deleteSheetRef,
  files,
  fileToDelete,
  onTakePhoto,
  onChooseGallery,
  onUploadDrive,
  onConfirmDelete,
  closeSheet,
}: UploadDeleteSheetsProps<T>) => {
  const title = fileToDelete
    ? files.find(f => f.id === fileToDelete)?.name ?? 'this file'
    : 'this file';

  return (
    <>
      <UploadDocumentBottomSheet
        ref={uploadSheetRef}
        onTakePhoto={() => {
          onTakePhoto();
          closeSheet();
        }}
        onChooseGallery={() => {
          onChooseGallery();
          closeSheet();
        }}
        onUploadDrive={() => {
          onUploadDrive();
          closeSheet();
        }}
      />

      <DeleteDocumentBottomSheet
        ref={deleteSheetRef}
        documentTitle={title}
        onDelete={onConfirmDelete}
      />
    </>
  );
};

export default UploadDeleteSheets;
