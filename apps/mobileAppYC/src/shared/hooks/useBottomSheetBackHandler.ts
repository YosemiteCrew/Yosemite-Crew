import { useEffect, useRef, useCallback, useState } from 'react';
import { BackHandler } from 'react-native';

interface BottomSheetRef {
  close: () => void;
}

/**
 * Hook to handle Android hardware back button for bottom sheets
 *
 * @returns An object with helpers to manage bottom sheet state
 *
 * @example
 * ```tsx
 * const { registerSheet, openSheet, closeSheet, onSave } = useBottomSheetBackHandler();
 *
 * // Register sheet refs
 * const breedSheetRef = useRef<BreedBottomSheetRef>(null);
 * registerSheet('breed', breedSheetRef);
 *
 * // Open sheet
 * const handleBreedPress = () => {
 *   openSheet('breed');
 *   breedSheetRef.current?.open();
 * };
 *
 * // Handle save
 * const handleBreedSave = (breed: Breed) => {
 *   setValue('breed', breed);
 *   onSave(); // Clears the open sheet state
 * };
 * ```
 */
export function useBottomSheetBackHandler() {
  const [openSheetKey, setOpenSheetKey] = useState<string | null>(null);
  const sheetsRef = useRef<Map<string, React.RefObject<BottomSheetRef>>>(new Map());

  // Handle Android back button
  useEffect(() => {
    if (!openSheetKey) return;

    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (openSheetKey) {
        const sheetRef = sheetsRef.current.get(openSheetKey);
        if (sheetRef?.current) {
          sheetRef.current.close();
          setOpenSheetKey(null);
          return true; // Prevent default back action
        }
      }
      return false;
    });

    return () => backHandler.remove();
  }, [openSheetKey]);

  /**
   * Register a bottom sheet ref with a unique key
   */
  const registerSheet = useCallback((key: string, ref: React.RefObject<BottomSheetRef | null>) => {
    sheetsRef.current.set(key, ref as React.RefObject<BottomSheetRef>);
  }, []);

  /**
   * Mark a bottom sheet as open
   */
  const openSheet = useCallback((key: string) => {
    setOpenSheetKey(key);
  }, []);

  /**
   * Mark the current bottom sheet as closed
   */
  const closeSheet = useCallback(() => {
    setOpenSheetKey(null);
  }, []);

  /**
   * Call this in the onSave/onCancel handlers of bottom sheets
   */
  const onSave = useCallback(() => {
    setOpenSheetKey(null);
  }, []);

  /**
   * Check if any sheet is currently open
   */
  const isAnySheetOpen = openSheetKey !== null;

  return {
    registerSheet,
    openSheet,
    closeSheet,
    onSave,
    isAnySheetOpen,
    openSheetKey,
  };
}
