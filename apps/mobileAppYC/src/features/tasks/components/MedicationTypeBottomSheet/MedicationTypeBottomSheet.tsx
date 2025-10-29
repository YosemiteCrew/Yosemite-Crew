import React, {forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {MedicationType} from '@/features/tasks/types';
import {resolveMedicationTypeLabel} from '@/features/tasks/utils/taskLabels';

export interface MedicationTypeBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface MedicationTypeBottomSheetProps {
  selectedType?: MedicationType | null;
  onSelect: (type: MedicationType) => void;
}

const medicationTypes: MedicationType[] = [
  'tablets-pills',
  'capsule',
  'liquids',
  'topical-medicine',
  'injection',
  'inhales',
  'patches',
  'suppositories',
  'sprinkle-capsules',
];

export const MedicationTypeBottomSheet = forwardRef<
  MedicationTypeBottomSheetRef,
  MedicationTypeBottomSheetProps
>(({selectedType, onSelect}, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const medicationItems: SelectItem[] = useMemo(() =>
    medicationTypes.map(type => ({
      id: type,
      label: resolveMedicationTypeLabel(type),
    })), []
  );

  const selectedItem = selectedType ? {
    id: selectedType,
    label: resolveMedicationTypeLabel(selectedType),
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
      onSelect(item.id as MedicationType);
    }
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Medication type"
      items={medicationItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={true}
      mode="select"
      snapPoints={['65%', '75%']}
      emptyMessage="No medication types available"
    />
  );
});

MedicationTypeBottomSheet.displayName = 'MedicationTypeBottomSheet';

export default MedicationTypeBottomSheet;
