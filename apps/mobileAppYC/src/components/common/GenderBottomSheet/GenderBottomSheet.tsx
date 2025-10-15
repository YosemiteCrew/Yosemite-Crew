import React, {forwardRef} from 'react';
import {
  SelectOptionBottomSheet,
  type SelectOptionBottomSheetRef,
  type Option,
} from '@/components/common/SelectOptionBottomSheet/SelectOptionBottomSheet';
import type {CompanionGender} from '@/features/companion/types';

export interface GenderBottomSheetRef extends SelectOptionBottomSheetRef {}

export const GenderBottomSheet = forwardRef<
  GenderBottomSheetRef,
  {
    selected: CompanionGender | null;
    onSave: (g: CompanionGender) => void;
  }
>(({selected, onSave}, ref) => {
  const options: Option[] = [
    {label: 'Male', value: 'male'},
    {label: 'Female', value: 'female'},
  ];
  return (
    <SelectOptionBottomSheet
      ref={ref}
      title="Select Gender"
      options={options}
      selectedValue={selected ?? null}
      onSelect={v => onSave(v as CompanionGender)}
    />
  );
});

GenderBottomSheet.displayName = 'GenderBottomSheet';

export default GenderBottomSheet;
