import React, {
  forwardRef,
  useState,
  useImperativeHandle,
  useRef,
  useMemo,
} from 'react';
import {GenericSelectBottomSheet} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import type {
  GenericSelectBottomSheetRef,
  SelectItem,
} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';

export interface SubcategoryBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface SubcategoryBottomSheetProps {
  category: string | null;
  selectedSubcategory: string | null;
  onSave: (subcategory: string | null) => void;
}

const SUBCATEGORIES: Record<string, SelectItem[]> = {
  admin: [
    {id: 'passport', label: 'Passport'},
    {
      id: 'certificates',
      label: 'Certificates (incl. pedigree, microchip, awards, breeder papers)',
    },
    {id: 'insurance', label: 'Insurance'},
  ],
  health: [
    {id: 'surgery-procedure', label: 'Surgery/ Procedure'},
    {id: 'prescription', label: 'Prescription'},
    {id: 'vaccination', label: 'Vaccination'},
    {id: 'discharge-summary', label: 'Discharge summary'},
    {id: 'lab-test', label: 'Lab test'},
    {id: 'imaging-diagnostic', label: 'Imaging/ Diagnostic'},
    {id: 'parasite-prevention', label: 'Parasite prevention'},
    {id: 'medical-condition', label: 'Medical condition'},
    {id: 'other', label: 'Other'},
  ],
  'hygiene-maintenance': [
    {id: 'bathing', label: 'Bathing'},
    {id: 'nail-trim', label: 'Nail trim'},
    {id: 'grooming', label: 'Grooming'},
    {id: 'ear-cleaning', label: 'Ear cleaning'},
    {id: 'dental-cleaning', label: 'Dental cleaning'},
    {id: 'skin-care', label: 'Skin care'},
    {id: 'anal-gland-expression', label: 'Anal gland expression'},
    {id: 'other', label: 'Other'},
  ],
  'dietary-plans': [{id: 'nutrition-plans', label: 'Nutrition plans'}],
  others: [
    {
      id: 'weight-logs',
      label: 'Weight logs, behaviour notes, photos of wounds, etc.',
    },
  ],
};

export const SubcategoryBottomSheet = forwardRef<
  SubcategoryBottomSheetRef,
  SubcategoryBottomSheetProps
>(({category, selectedSubcategory, onSave}, ref) => {
  const bottomSheetRef = useRef<GenericSelectBottomSheetRef>(null);

  const subcategories = useMemo(() => {
    if (!category) return [];
    return SUBCATEGORIES[category] || [];
  }, [category]);

  const [tempSubcategory, setTempSubcategory] = useState<SelectItem | null>(
    selectedSubcategory
      ? subcategories.find(s => s.id === selectedSubcategory) || null
      : null,
  );

  useImperativeHandle(ref, () => ({
    open: () => {
      setTempSubcategory(
        selectedSubcategory
          ? subcategories.find(s => s.id === selectedSubcategory) || null
          : null,
      );
      bottomSheetRef.current?.open();
    },
    close: () => {
      bottomSheetRef.current?.close();
    },
  }));

  const handleSave = (item: SelectItem | null) => {
    setTempSubcategory(item);
    onSave(item?.id || null);
  };

  // Format category name and title to handle long text better
  const formatCategoryName = (cat: string | null) => {
    if (!cat) return '';
    return cat.charAt(0).toUpperCase() + cat.slice(1).replace('-', ' ');
  };

  const title = category
    ? `${formatCategoryName(category)}\nsub category`
    : 'Sub category';

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title={title}
      items={subcategories}
      selectedItem={tempSubcategory}
      onSave={handleSave}
      hasSearch={false}
      emptyMessage="No subcategories available"
      mode="select"
      snapPoints={['45%', '45%']}
      maxListHeight={300}
    />
  );
});

SubcategoryBottomSheet.displayName = 'SubcategoryBottomSheet';
