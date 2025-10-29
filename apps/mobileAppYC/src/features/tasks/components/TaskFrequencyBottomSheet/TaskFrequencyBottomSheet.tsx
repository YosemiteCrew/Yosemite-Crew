import React, {forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {TaskFrequency} from '@/features/tasks/types';
import {resolveTaskFrequencyLabel} from '@/features/tasks/utils/taskLabels';

export interface TaskFrequencyBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface TaskFrequencyBottomSheetProps {
  selectedFrequency?: TaskFrequency | null;
  onSelect: (frequency: TaskFrequency) => void;
}

const frequencies: TaskFrequency[] = ['once', 'daily', 'every-day', 'weekly', 'monthly'];

export const TaskFrequencyBottomSheet = forwardRef<
  TaskFrequencyBottomSheetRef,
  TaskFrequencyBottomSheetProps
>(({selectedFrequency, onSelect}, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const frequencyItems: SelectItem[] = useMemo(() =>
    frequencies.map(frequency => ({
      id: frequency,
      label: resolveTaskFrequencyLabel(frequency),
    })), []
  );

  const selectedItem = selectedFrequency ? {
    id: selectedFrequency,
    label: resolveTaskFrequencyLabel(selectedFrequency),
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
      onSelect(item.id as TaskFrequency);
    }
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Task frequency"
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

TaskFrequencyBottomSheet.displayName = 'TaskFrequencyBottomSheet';

export default TaskFrequencyBottomSheet;
