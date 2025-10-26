import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {CompanionOrigin} from '@/features/companion/types';

export interface OriginBottomSheetRef {
  open: () => void;
  close: () => void;
}

export const OriginBottomSheet = forwardRef<
  OriginBottomSheetRef,
  {
    selected: CompanionOrigin | null;
    onSave: (v: CompanionOrigin) => void;
  }
>(({selected, onSave}, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const originItems: SelectItem[] = [
    {id: 'shop', label: 'Shop'},
    {id: 'breeder', label: 'Breeder'},
    {id: 'foster-shelter', label: 'Foster/ Shelter'},
    {id: 'friends-family', label: 'Friends or family'},
    {id: 'unknown', label: 'Unknown'},
  ];

  const selectedItem = selected
    ? originItems.find(item => item.id === selected) || null
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
      onSave(item.id as CompanionOrigin);
    }
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="My pet comes from"
      items={originItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      emptyMessage="No options available"
      mode="select"
      snapPoints={['45%', '45%']}
      maxListHeight={300}
    />
  );
});

OriginBottomSheet.displayName = 'OriginBottomSheet';

export default OriginBottomSheet;
