import React, {forwardRef} from 'react';
import {
  SelectOptionBottomSheet,
  type SelectOptionBottomSheetRef,
  type Option,
} from '@/components/common/SelectOptionBottomSheet/SelectOptionBottomSheet';
import type {InsuredStatus} from '@/features/companion/types';

export interface InsuredStatusBottomSheetRef extends SelectOptionBottomSheetRef {}

export const InsuredStatusBottomSheet = forwardRef<InsuredStatusBottomSheetRef, {
  selected: InsuredStatus | null;
  onSave: (v: InsuredStatus) => void;
}>(({selected, onSave}, ref) => {
  const options: Option[] = [
    {label: 'Insured', value: 'insured'},
    {label: 'Not insured', value: 'not-insured'},
  ];
  return (
    <SelectOptionBottomSheet
      ref={ref}
      title="Insurance Status"
      options={options}
      selectedValue={selected ?? null}
      onSelect={(v) => onSave(v as InsuredStatus)}
    />
  );
});

InsuredStatusBottomSheet.displayName = 'InsuredStatusBottomSheet';

export default InsuredStatusBottomSheet;