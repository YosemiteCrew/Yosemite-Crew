import React, {forwardRef} from 'react';
import {
  SelectOptionBottomSheet,
  type SelectOptionBottomSheetRef,
  type Option,
} from '@/components/common/SelectOptionBottomSheet/SelectOptionBottomSheet';
import type {CompanionOrigin} from '@/features/companion/types';

export interface OriginBottomSheetRef extends SelectOptionBottomSheetRef {}

export const OriginBottomSheet = forwardRef<
  OriginBottomSheetRef,
  {
    selected: CompanionOrigin | null;
    onSave: (v: CompanionOrigin) => void;
  }
>(({selected, onSave}, ref) => {
  const options: Option[] = [
    {label: 'Shop', value: 'shop'},
    {label: 'Breeder', value: 'breeder'},
    {label: 'Foster/ Shelter', value: 'foster-shelter'},
    {label: 'Friends or family', value: 'friends-family'},
    {label: 'Unknown', value: 'unknown'},
  ];
  return (
    <SelectOptionBottomSheet
      ref={ref}
      title="My pet comes from"
      options={options}
      selectedValue={selected ?? null}
      onSelect={v => onSave(v as CompanionOrigin)}
    />
  );
});

OriginBottomSheet.displayName = 'OriginBottomSheet';

export default OriginBottomSheet;
