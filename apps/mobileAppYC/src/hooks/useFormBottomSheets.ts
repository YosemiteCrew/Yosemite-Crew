import {useRef, useEffect} from 'react';
import type {CategoryBottomSheetRef} from '@/components/common/CategoryBottomSheet/CategoryBottomSheet';
import type {SubcategoryBottomSheetRef} from '@/components/common/SubcategoryBottomSheet/SubcategoryBottomSheet';
import type {VisitTypeBottomSheetRef} from '@/components/common/VisitTypeBottomSheet/VisitTypeBottomSheet';
import type {UploadDocumentBottomSheetRef} from '@/components/common/UploadDocumentBottomSheet/UploadDocumentBottomSheet';
import type {DeleteDocumentBottomSheetRef} from '@/components/common/DeleteDocumentBottomSheet/DeleteDocumentBottomSheet';
import {useBottomSheetBackHandler} from './useBottomSheetBackHandler';

export interface FormBottomSheetRefs {
  categorySheetRef: React.RefObject<CategoryBottomSheetRef>;
  subcategorySheetRef: React.RefObject<SubcategoryBottomSheetRef>;
  visitTypeSheetRef: React.RefObject<VisitTypeBottomSheetRef>;
  uploadSheetRef: React.RefObject<UploadDocumentBottomSheetRef>;
  deleteSheetRef: React.RefObject<DeleteDocumentBottomSheetRef>;
}

export const useFormBottomSheets = () => {
  const categorySheetRef = useRef<CategoryBottomSheetRef>(null);
  const subcategorySheetRef = useRef<SubcategoryBottomSheetRef>(null);
  const visitTypeSheetRef = useRef<VisitTypeBottomSheetRef>(null);
  const uploadSheetRef = useRef<UploadDocumentBottomSheetRef>(null);
  const deleteSheetRef = useRef<DeleteDocumentBottomSheetRef>(null);

  const {registerSheet, openSheet, closeSheet} = useBottomSheetBackHandler();

  useEffect(() => {
    registerSheet('category', categorySheetRef);
    registerSheet('subcategory', subcategorySheetRef);
    registerSheet('visitType', visitTypeSheetRef);
    registerSheet('upload', uploadSheetRef);
    registerSheet('delete', deleteSheetRef);
  }, [registerSheet]);

  return {
    refs: {
      categorySheetRef,
      subcategorySheetRef,
      visitTypeSheetRef,
      uploadSheetRef,
      deleteSheetRef,
    },
    openSheet,
    closeSheet,
  };
};
