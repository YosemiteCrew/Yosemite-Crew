import React, {useImperativeHandle, useRef} from 'react';
import {
  GenericSelectBottomSheet,
  type SelectItem,
} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {CompanionGender} from '@/features/companion/types';

export interface GenderBottomSheetRef {
  open: () => void;
  close: () => void;
}

const GENDER_ITEMS: SelectItem[] = [
  {id: 'male', label: 'Male'},
  {id: 'female', label: 'Female'},
];

export const GenderBottomSheet = ({
  selected,
  selectedGender,
  onSave,
  ref,
}: {
  selected?: CompanionGender | null;
  selectedGender?: CompanionGender | null;
  onSave: (g: CompanionGender) => void;
} & {ref?: React.Ref<GenderBottomSheetRef>}) => {
  const bottomSheetRef = useRef<any>(null);

  const effectiveSelection = selected ?? selectedGender ?? null;
  const selectedItem = effectiveSelection
    ? GENDER_ITEMS.find(item => item.id === effectiveSelection) || null
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
      items={GENDER_ITEMS}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      emptyMessage="No gender options available"
      mode="select"
      snapPoints={['30%', '35%']}
      maxListHeight={300}
    />
  );
};

GenderBottomSheet.displayName = 'GenderBottomSheet';

export default GenderBottomSheet;
