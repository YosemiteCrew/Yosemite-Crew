import React, {forwardRef, useImperativeHandle, useRef} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {CompanionGender} from '@/features/companion/types';

export interface GenderBottomSheetRef {
  open: () => void;
  close: () => void;
}

export const GenderBottomSheet = forwardRef<
  GenderBottomSheetRef,
  {
    selected?: CompanionGender | null;
    selectedGender?: CompanionGender | null;
    onSave: (g: CompanionGender) => void;
  }
>(({selected, selectedGender, onSave}, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const genderItems: SelectItem[] = [
    {id: 'male', label: 'Male'},
    {id: 'female', label: 'Female'},
  ];

  const effectiveSelection = selected ?? selectedGender ?? null;
  const selectedItem = effectiveSelection
    ? genderItems.find(item => item.id === effectiveSelection) || null
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
      onSave(item.id as CompanionGender);
    }
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Select Gender"
      items={genderItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      emptyMessage="No gender options available"
      mode="select"
      snapPoints={['30%', '35%']}
      maxListHeight={300}
    />
  );
});

GenderBottomSheet.displayName = 'GenderBottomSheet';

export default GenderBottomSheet;
