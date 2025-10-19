import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {InsuredStatus} from '@/features/companion/types';

export interface InsuredStatusBottomSheetRef {
  open: () => void;
  close: () => void;
}

export const InsuredStatusBottomSheet = forwardRef<InsuredStatusBottomSheetRef, {
  selected: InsuredStatus | null;
  onSave: (v: InsuredStatus) => void;
}>(({selected, onSave}, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const insuredItems: SelectItem[] = [
    {id: 'insured', label: 'Insured'},
    {id: 'not-insured', label: 'Not insured'},
  ];

  const selectedItem = selected
    ? insuredItems.find(item => item.id === selected) || null
    : null;

  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = (item: SelectItem | null) => {
    if (item) {
      onSave(item.id as InsuredStatus);
    }
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Insurance Status"
      items={insuredItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      emptyMessage="No options available"
      mode="select"
      snapPoints={['30%', '35%']}
      maxListHeight={300}
    />
  );
});

InsuredStatusBottomSheet.displayName = 'InsuredStatusBottomSheet';

export default InsuredStatusBottomSheet;