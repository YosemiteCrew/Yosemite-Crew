import React, {forwardRef, useState, useImperativeHandle, useRef} from 'react';
import {GenericSelectBottomSheet} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {GenericSelectBottomSheetRef, SelectItem} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';

export interface VisitTypeBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface VisitTypeBottomSheetProps {
  selectedVisitType: string | null;
  onSave: (visitType: string | null) => void;
}

const VISIT_TYPES: SelectItem[] = [
  {id: 'hospital', label: 'Hospital'},
  {id: 'groomer', label: 'Groomer'},
  {id: 'boarder', label: 'Boarder'},
  {id: 'breeder', label: 'Breeder'},
  {id: 'shop', label: 'Shop'},
  {id: 'other', label: 'Other'},
];

export const VisitTypeBottomSheet = forwardRef<
  VisitTypeBottomSheetRef,
  VisitTypeBottomSheetProps
>(({selectedVisitType, onSave}, ref) => {
  const bottomSheetRef = useRef<GenericSelectBottomSheetRef>(null);
  const [tempVisitType, setTempVisitType] = useState<SelectItem | null>(
    selectedVisitType
      ? VISIT_TYPES.find(v => v.id === selectedVisitType) || null
      : null,
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempVisitType(
        selectedVisitType
          ? VISIT_TYPES.find(v => v.id === selectedVisitType) || null
          : null,
      );
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = (item: SelectItem | null) => {
    setTempVisitType(item);
    onSave(item?.id || null);
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Select Visit Type"
      items={VISIT_TYPES}
      selectedItem={tempVisitType}
      onSave={handleSave}
      hasSearch={false}
      emptyMessage="No visit types available"
    />
  );
});

VisitTypeBottomSheet.displayName = 'VisitTypeBottomSheet';
