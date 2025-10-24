import React, {forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '@/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {ObservationalTool} from '@/features/tasks/types';
import {resolveObservationalToolLabel} from '@/utils/taskLabels';

export interface ObservationalToolBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface ObservationalToolBottomSheetProps {
  selectedTool?: ObservationalTool | null;
  onSelect: (tool: ObservationalTool) => void;
  companionType: 'cat' | 'dog' | 'horse';
}

export const ObservationalToolBottomSheet = forwardRef<
  ObservationalToolBottomSheetRef,
  ObservationalToolBottomSheetProps
>(({selectedTool, onSelect, companionType}, ref) => {
  const bottomSheetRef = useRef<any>(null);

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  // Filter tools based on companion type
  const getAvailableTools = (): ObservationalTool[] => {
    const toolMap: Record<'cat' | 'dog' | 'horse', ObservationalTool[]> = {
      cat: ['feline-grimace-scale'],
      dog: ['canine-acute-pain-scale'],
      horse: ['equine-grimace-scale'],
    };

    return toolMap[companionType] || [];
  };

  const availableTools = getAvailableTools();

  const toolItems: SelectItem[] = useMemo(() =>
    availableTools.map(tool => ({
      id: tool,
      label: resolveObservationalToolLabel(tool),
    })), [availableTools]
  );

  const selectedItem = selectedTool ? {
    id: selectedTool,
    label: resolveObservationalToolLabel(selectedTool),
  } : null;

  const handleSave = (item: SelectItem | null) => {
    if (item) {
      onSelect(item.id as ObservationalTool);
    }
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Select observational tool"
      items={toolItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      mode="select"
      snapPoints={['50%', '65%']}
      emptyMessage="No observational tools available for this companion"
    />
  );
});

export default ObservationalToolBottomSheet;
