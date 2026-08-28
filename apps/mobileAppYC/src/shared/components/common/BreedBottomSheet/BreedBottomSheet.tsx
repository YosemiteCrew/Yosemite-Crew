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
  /** A lookup is in flight, so the list is empty for a third reason again. */
  loading?: boolean;
  /**
   * Re-run the breed lookup. Without this a failed lookup is a dead end:
   * breed is a required field, so the user cannot finish creating a companion
   * and cannot make the picker try again either.
   */
  onRetry?: () => void;
}

export const BreedBottomSheet = ({
  breeds,
  selectedBreed,
  onSave,
  loadFailed = false,
  loading = false,
  onRetry,
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

  // Three reasons the list can be empty, and they are not interchangeable:
  // still loading, the lookup failed, or the species really has no breeds.
  const resolveEmptyMessage = () => {
    if (loading) {
      return t('common.loading');
    }
    return loadFailed
      ? t('companion.breedLoadFailed')
      : t('companion.breedNoneAvailable');
  };

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
      emptyMessage={resolveEmptyMessage()}
      emptyAction={
        // Only on failure. A species that genuinely has no breeds is not
        // something a retry can fix, and offering one there would be a lie.
        loadFailed && !loading && onRetry
          ? {label: t('common.try_again'), onPress: onRetry}
          : undefined
      }
      mode="select"
      maxListHeight={600}
      snapPoints={['90%', '95%']}
    />
  );
};

BreedBottomSheet.displayName = 'BreedBottomSheet';
