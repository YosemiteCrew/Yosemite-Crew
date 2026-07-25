import React, {useImperativeHandle, useRef} from 'react';
import {
  GenericSelectBottomSheet,
  type SelectItem,
} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {CompanionOrigin} from '@/features/companion/types';

export interface OriginBottomSheetRef {
  open: () => void;
  close: () => void;
}

const ORIGIN_ITEMS: SelectItem[] = [
  {id: 'shop', label: 'Shop'},
  {id: 'breeder', label: 'Breeder'},
  {id: 'foster-shelter', label: 'Foster/ Shelter'},
  {id: 'friends-family', label: 'Friends or family'},
  {id: 'stray', label: 'Stray'},
  {id: 'unknown', label: 'Unknown'},
];

export const OriginBottomSheet = ({
  selected,
  onSave,
  ref,
}: {
  selected: CompanionOrigin | null;
  onSave: (v: CompanionOrigin) => void;
} & {ref?: React.Ref<OriginBottomSheetRef>}) => {
  const bottomSheetRef = useRef<any>(null);

  const selectedItem = selected
    ? ORIGIN_ITEMS.find(item => item.id === selected) || null
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
      items={ORIGIN_ITEMS}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      emptyMessage="No options available"
      mode="select"
      snapPoints={['45%', '45%']}
      maxListHeight={300}
    />
  );
};

OriginBottomSheet.displayName = 'OriginBottomSheet';

export default OriginBottomSheet;
