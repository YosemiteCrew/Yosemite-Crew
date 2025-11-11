import React, {forwardRef, useImperativeHandle, useRef, useMemo} from 'react';
import {GenericSelectBottomSheet, type SelectItem} from '@/shared/components/common/GenericSelectBottomSheet/GenericSelectBottomSheet';

export type AdministrationMethod =
  | 'none'
  | 'by mouth'
  | 'on the skin'
  | 'subcutaneous injection'
  | 'intramuscular injection'
  | 'into the ear'
  | 'into the eye'
  | 'other';

export interface AdministrationMethodBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface AdministrationMethodBottomSheetProps {
  selectedMethod: AdministrationMethod | null;
  onSave: (method: AdministrationMethod | null) => void;
}

export const AdministrationMethodBottomSheet = forwardRef<
  AdministrationMethodBottomSheetRef,
  AdministrationMethodBottomSheetProps
>(({selectedMethod, onSave}, ref) => {
  const bottomSheetRef = useRef<any>(null);

  const items: SelectItem[] = useMemo(
    () => [
      {id: 'none', label: '- None -'},
      {id: 'by mouth', label: 'by mouth'},
      {id: 'on the skin', label: 'on the skin'},
      {id: 'subcutaneous injection', label: 'subcutaneous injection'},
      {id: 'intramuscular injection', label: 'intramuscular injection'},
      {id: 'into the ear', label: 'into the ear'},
      {id: 'into the eye', label: 'into the eye'},
      {id: 'other', label: 'other'},
    ],
    [],
  );

  const selectedItem = selectedMethod
    ? items.find(i => i.id === selectedMethod) ?? null
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
    onSave(item ? (item.id as AdministrationMethod) : null);
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="How was the product administered?"
      items={items}
      selectedItem={selectedItem}
      onSave={handleSave}
      hasSearch={false}
      mode="select"
      snapPoints={["55%","65%"]}
      maxListHeight={320}
    />
  );
});

AdministrationMethodBottomSheet.displayName = 'AdministrationMethodBottomSheet';

export default AdministrationMethodBottomSheet;

