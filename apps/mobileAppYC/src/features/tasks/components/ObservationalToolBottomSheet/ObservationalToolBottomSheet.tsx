import React, {
  useImperativeHandle,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import {
  GenericSelectBottomSheet,
  type SelectItem,
} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';
import {
  subscribeTools,
  getToolsSnapshot,
  getToolsLoadingSnapshot,
} from './observationalToolsStore';

export interface ObservationalToolBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface ObservationalToolBottomSheetProps {
  selectedTool?: string | null;
  onSelect: (tool: string) => void;
  companionType: 'cat' | 'dog' | 'horse';
  onSheetChange?: (index: number) => void;
}

const inferSpeciesFromName = (name?: string | null) => {
  const normalized = (name ?? '').toLowerCase();
  if (normalized.includes('feline') || normalized.includes('cat')) return 'cat';
  if (normalized.includes('canine') || normalized.includes('dog')) return 'dog';
  if (normalized.includes('equine') || normalized.includes('horse'))
    return 'horse';
  return null;
};

export const ObservationalToolBottomSheet = ({
  selectedTool,
  onSelect,
  companionType,
  onSheetChange,
  ref,
}: ObservationalToolBottomSheetProps & {
  ref?: React.Ref<ObservationalToolBottomSheetRef>;
}) => {
  const bottomSheetRef = useRef<any>(null);
  const tools = useSyncExternalStore(
    subscribeTools,
    getToolsSnapshot,
    getToolsSnapshot,
  );
  const loading = useSyncExternalStore(
    subscribeTools,
    getToolsLoadingSnapshot,
    getToolsLoadingSnapshot,
  );

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  const availableTools = useMemo(() => {
    return tools.filter(tool => {
      const species = inferSpeciesFromName(tool.name);
      return !species || species === companionType;
    });
  }, [companionType, tools]);

  const toolItems: SelectItem[] = useMemo(
    () =>
      availableTools.map(tool => ({
        id: tool.id,
        label: tool.name ?? resolveObservationalToolLabel(tool.id),
      })),
    [availableTools],
  );

  const selectedItem = selectedTool
    ? {
        id: selectedTool,
        label:
          tools.find(tool => tool.id === selectedTool)?.name ??
          resolveObservationalToolLabel(selectedTool),
      }
    : null;

  const emptyMessage = loading
    ? 'Loading observational tools...'
    : 'No observational tools available for this companion';

  const handleSave = (item: SelectItem | null) => {
    if (item) {
      onSelect(item.id);
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
      snapPoints={['35%', '40%']}
      emptyMessage={emptyMessage}
      onSheetChange={onSheetChange}
    />
  );
};

export default ObservationalToolBottomSheet;
