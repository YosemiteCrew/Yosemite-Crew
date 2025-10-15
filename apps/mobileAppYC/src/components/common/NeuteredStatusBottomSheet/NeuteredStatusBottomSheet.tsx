import React, {forwardRef} from 'react';
import {
  SelectOptionBottomSheet,
  type SelectOptionBottomSheetRef,
  type Option,
} from '@/components/common/SelectOptionBottomSheet/SelectOptionBottomSheet';
import type {NeuteredStatus} from '@/features/companion/types';

export interface NeuteredStatusBottomSheetRef extends SelectOptionBottomSheetRef {}

export const NeuteredStatusBottomSheet = forwardRef<NeuteredStatusBottomSheetRef, {
  selected: NeuteredStatus | null;
  onSave: (v: NeuteredStatus) => void;
}>(({selected, onSave}, ref) => {
  const options: Option[] = [
    {label: 'Neutered', value: 'neutered'},
    {label: 'Not neutered', value: 'not-neutered'},
  ];
  return (
    <SelectOptionBottomSheet
      ref={ref}
      title="Neutered Status"
      options={options}
      selectedValue={selected ?? null}
      onSelect={(v) => onSave(v as NeuteredStatus)}
    />
  );
});

NeuteredStatusBottomSheet.displayName = 'NeuteredStatusBottomSheet';

export default NeuteredStatusBottomSheet;