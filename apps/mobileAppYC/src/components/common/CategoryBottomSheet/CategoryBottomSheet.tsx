import React, {forwardRef, useState, useImperativeHandle, useRef} from 'react';
import {GenericSelectBottomSheet} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {GenericSelectBottomSheetRef, SelectItem} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';

export interface CategoryBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface CategoryBottomSheetProps {
  selectedCategory: string | null;
  onSave: (category: string | null) => void;
}

const CATEGORIES: SelectItem[] = [
  {id: 'admin', label: 'Admin'},
  {id: 'health', label: 'Health'},
  {id: 'hygiene-maintenance', label: 'Hygiene maintenance'},
  {id: 'dietary-plans', label: 'Dietary plans'},
  {id: 'others', label: 'Others'},
];

export const CategoryBottomSheet = forwardRef<
  CategoryBottomSheetRef,
  CategoryBottomSheetProps
>(({selectedCategory, onSave}, ref) => {
  const bottomSheetRef = useRef<GenericSelectBottomSheetRef>(null);
  const [tempCategory, setTempCategory] = useState<SelectItem | null>(
    selectedCategory
      ? CATEGORIES.find(c => c.id === selectedCategory) || null
      : null,
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempCategory(
        selectedCategory
          ? CATEGORIES.find(c => c.id === selectedCategory) || null
          : null,
      );
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = (item: SelectItem | null) => {
    setTempCategory(item);
    onSave(item?.id || null);
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Select Category"
      items={CATEGORIES}
      selectedItem={tempCategory}
      onSave={handleSave}
      hasSearch={false}
      emptyMessage="No categories available"
    />
  );
});

CategoryBottomSheet.displayName = 'CategoryBottomSheet';
