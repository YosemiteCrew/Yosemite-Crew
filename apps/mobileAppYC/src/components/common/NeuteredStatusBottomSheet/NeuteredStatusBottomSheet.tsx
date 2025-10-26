import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {NeuteredStatus} from '@/features/companion/types';

export interface NeuteredStatusBottomSheetRef {
  open: () => void;
  close: () => void;
}

export const NeuteredStatusBottomSheet = forwardRef<NeuteredStatusBottomSheetRef, {
  selected: NeuteredStatus | null;
  onSave: (v: NeuteredStatus) => void;
}>(({selected, onSave}, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const neuteredItems: SelectItem[] = [
    {id: 'neutered', label: 'Neutered'},
    {id: 'not-neutered', label: 'Not neutered'},
  ];

  const selectedItem = selected
    ? neuteredItems.find(item => item.id === selected) || null
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
      onSave(item.id as NeuteredStatus);
    }
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Neutered Status"
      items={neuteredItems}
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

NeuteredStatusBottomSheet.displayName = 'NeuteredStatusBottomSheet';

export default NeuteredStatusBottomSheet;