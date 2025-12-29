import React, {forwardRef, useImperativeHandle, useMemo, useRef, useState, useEffect} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {ObservationalTool} from '@/features/tasks/types';
import {resolveObservationalToolLabel} from '@/features/tasks/utils/taskLabels';
import {observationToolApi, type ObservationToolDefinitionRemote} from '@/features/observationalTools/services/observationToolService';

export interface ObservationalToolBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface ObservationalToolBottomSheetProps {
  selectedTool?: ObservationalTool | null;
  onSelect: (tool: ObservationalTool) => void;
  companionType: 'cat' | 'dog' | 'horse';
  onSheetChange?: (index: number) => void;
}

export const ObservationalToolBottomSheet = forwardRef<
  ObservationalToolBottomSheetRef,
  ObservationalToolBottomSheetProps
>(({selectedTool, onSelect, companionType, onSheetChange}, ref) => {
  const bottomSheetRef = useRef<any>(null);
  const [tools, setTools] = useState<ObservationToolDefinitionRemote[]>([]);
  const [loading, setLoading] = useState(false);

  useImperativeHandle(ref, () => ({
    open: () => bottomSheetRef.current?.open(),
    close: () => bottomSheetRef.current?.close(),
  }));

  useEffect(() => {
    let isMounted = true;
    const fetchTools = async () => {
      try {
        setLoading(true);
        const list = await observationToolApi.list({onlyActive: true});
        if (isMounted) {
          setTools(list);
        }
      } catch (error) {
        console.warn('[ObservationalToolBottomSheet] Failed to fetch tools', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchTools();
    return () => {
      isMounted = false;
    };
  }, []);

  const inferSpeciesFromName = (name?: string | null) => {
    const normalized = (name ?? '').toLowerCase();
    if (normalized.includes('feline') || normalized.includes('cat')) return 'cat';
    if (normalized.includes('canine') || normalized.includes('dog')) return 'dog';
    if (normalized.includes('equine') || normalized.includes('horse')) return 'horse';
    return null;
  };

  const availableTools = useMemo(() => {
    return tools.filter(tool => {
      const species = inferSpeciesFromName(tool.name);
      return !species || species === companionType;
    });
  }, [companionType, tools]);

  const toolItems: SelectItem[] = useMemo(() =>
    availableTools.map(tool => ({
      id: tool.id,
      label: tool.name ?? resolveObservationalToolLabel(tool.id as ObservationalTool),
    })), [availableTools]
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
      snapPoints={['35%', '40%']}
      emptyMessage={emptyMessage}
      onSheetChange={onSheetChange}
    />
  );
});

export default ObservationalToolBottomSheet;
