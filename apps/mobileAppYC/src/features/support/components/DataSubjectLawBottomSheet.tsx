import React, {forwardRef, useImperativeHandle, useMemo, useRef} from 'react';
import {
  GenericSelectBottomSheet,
  type SelectItem,
} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';
import {DSAR_LAW_OPTIONS} from '../data/contactData';

export interface DataSubjectLawBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface DataSubjectLawBottomSheetProps {
  selectedLawId: string | null;
  onSelect: (option: SelectItem | null) => void;
}

export const DataSubjectLawBottomSheet = forwardRef<
  DataSubjectLawBottomSheetRef,
  DataSubjectLawBottomSheetProps
>(({selectedLawId, onSelect}, ref) => {
  const sheetRef = useRef<any>(null);

  const items: SelectItem[] = useMemo(
    () =>
      DSAR_LAW_OPTIONS.map(option => ({
        id: option.id,
        label: option.label,
      })),
    [],
  );

  const selectedItem = useMemo(() => {
    if (!selectedLawId) {
      return null;
    }
    return items.find(item => item.id === selectedLawId) ?? null;
  }, [items, selectedLawId]);

  useImperativeHandle(ref, () => ({
    open: () => {
      sheetRef.current?.open();
    },
    close: () => {
      sheetRef.current?.close();
    },
  }));

  return (
    <GenericSelectBottomSheet
      ref={sheetRef}
      title="Select regulation"
      items={items}
      selectedItem={selectedItem}
  onSave={onSelect}
  hasSearch={false}
  mode="select"
  snapPoints={['55%', '65%']}
    />
  );
});

DataSubjectLawBottomSheet.displayName = 'DataSubjectLawBottomSheet';

export default DataSubjectLawBottomSheet;
