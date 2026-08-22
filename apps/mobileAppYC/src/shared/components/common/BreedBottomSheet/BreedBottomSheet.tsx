// src/components/common/BreedBottomSheet/BreedBottomSheet.tsx
import React, {useImperativeHandle, useRef, useMemo} from 'react';
import {
  GenericSelectBottomSheet,
  type SelectItem,
} from '../GenericSelectBottomSheet/GenericSelectBottomSheet';
import {useTranslation} from 'react-i18next';

import type {Breed} from '@/features/companion/types';

export interface BreedBottomSheetRef {
  open: () => void;
  close: () => void;
}

interface BreedBottomSheetProps {
  breeds: Breed[];
  selectedBreed: Breed | null;
  onSave: (breed: Breed | null) => void;
  /** The lookup failed rather than returning an empty list. */
  loadFailed?: boolean;
}

export const BreedBottomSheet = ({
  breeds,
  selectedBreed,
  onSave,
  loadFailed = false,
  ref,
}: BreedBottomSheetProps & {ref?: React.Ref<BreedBottomSheetRef>}) => {
  const {t} = useTranslation();
  const bottomSheetRef = useRef<any>(null);

  const breedItems: SelectItem[] = useMemo(
    () =>
      breeds.map(breed => ({
        id: breed.breedId.toString(),
        label: breed.breedName,
        ...breed,
      })),
    [breeds],
  );

  const selectedItem = selectedBreed
    ? {
        id: selectedBreed.breedId.toString(),
        label: selectedBreed.breedName,
        ...selectedBreed,
      }
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
    const breed = item
      ? breeds.find(b => b.breedId.toString() === item.id) || null
      : null;
    onSave(breed);
  };

  return (
    <GenericSelectBottomSheet
      ref={bottomSheetRef}
      title="Select breed"
      items={breedItems}
      selectedItem={selectedItem}
      onSave={handleSave}
      searchPlaceholder="Search from 200+ breeds"
      emptyMessage={
        loadFailed
          ? t('companion.breedLoadFailed')
          : t('companion.breedNoneAvailable')
      }
      mode="select"
      maxListHeight={600}
      snapPoints={['90%', '95%']}
    />
  );
};

BreedBottomSheet.displayName = 'BreedBottomSheet';
