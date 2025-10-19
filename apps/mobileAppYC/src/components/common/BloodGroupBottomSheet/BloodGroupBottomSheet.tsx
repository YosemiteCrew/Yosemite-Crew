// src/components/common/BloodGroupBottomSheet/BloodGroupBottomSheet.tsx
import React, { forwardRef, useImperativeHandle, useRef, useMemo } from 'react';
import { GenericSelectBottomSheet, type SelectItem } from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type { CompanionCategory } from '@/features/companion/types';

export interface BloodGroupBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface BloodGroupBottomSheetProps {
  selectedBloodGroup: string | null;
  category: CompanionCategory | null;
  onSave: (bloodGroup: string | null) => void;
}

// Blood group options by category
const BLOOD_GROUPS: Record<CompanionCategory, string[]> = {
  cat: ['A', 'B', 'AB', 'Unknown'],
  dog: [
    'DEA 1.1 Positive',
    'DEA 1.1 Negative',
    'DEA 1.2 Positive',
    'DEA 1.2 Negative',
    'DEA 3 Positive',
    'DEA 3 Negative',
    'DEA 4 Positive',
    'DEA 4 Negative',
    'DEA 5 Positive',
    'DEA 5 Negative',
    'DEA 7 Positive',
    'DEA 7 Negative',
    'Universal Donor',
    'Unknown',
  ],
  horse: [
    'Aa',
    'Ca',
    'Da',
    'Ka',
    'Pa',
    'Qa',
    'Ua',
    'Universal Donor',
    'Unknown',
  ],
};

export const BloodGroupBottomSheet = forwardRef<
  BloodGroupBottomSheetRef,
  BloodGroupBottomSheetProps
>(({ selectedBloodGroup, category, onSave }, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const bloodGroupItems: SelectItem[] = useMemo(() => {
    if (!category) {
      return [];
    }
    return BLOOD_GROUPS[category].map(group => ({
      id: group,
      label: group,
    }));
  }, [category]);

  const selectedItem = selectedBloodGroup ? {
    id: selectedBloodGroup,
    label: selectedBloodGroup,
  } : null;

  useImperativeHandle(ref, () => ({
    open: () => {
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = (item: SelectItem | null) => {
    onSave(item?.id || null);
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Select blood group"
      items={bloodGroupItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      emptyMessage="Please select a companion category first"
      mode="select"
      snapPoints={['45%', '45%']}
      maxListHeight={300}
    />
  );
});

BloodGroupBottomSheet.displayName = 'BloodGroupBottomSheet';
