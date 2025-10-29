import React, {forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {MedicationFrequency} from '@/features/tasks/types';
import {resolveMedicationFrequencyLabel} from '@/features/tasks/utils/taskLabels';

export interface MedicationFrequencyBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface MedicationFrequencyBottomSheetProps {
  selectedFrequency?: MedicationFrequency | null;
  onSelect: (frequency: MedicationFrequency) => void;
}

const frequencies: MedicationFrequency[] = ['once', 'daily', 'weekly', 'monthly'];

export const MedicationFrequencyBottomSheet = forwardRef<
  MedicationFrequencyBottomSheetRef,
  MedicationFrequencyBottomSheetProps
>(({selectedFrequency, onSelect}, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const frequencyItems: SelectItem[] = useMemo(() =>
    frequencies.map(frequency => ({
      id: frequency,
      label: resolveMedicationFrequencyLabel(frequency),
    })), []
  );

  const selectedItem = selectedFrequency ? {
    id: selectedFrequency,
    label: resolveMedicationFrequencyLabel(selectedFrequency),
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
    if (item) {
      onSelect(item.id as MedicationFrequency);
    }
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Medication frequency"
      items={frequencyItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      mode="select"
      snapPoints={['50%', '65%']}
      emptyMessage="No frequencies available"
    />
  );
});

MedicationFrequencyBottomSheet.displayName = 'MedicationFrequencyBottomSheet';

export default MedicationFrequencyBottomSheet;
