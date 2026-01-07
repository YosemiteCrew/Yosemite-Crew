import {useState, useRef, useCallback} from 'react';
import {useNavigation} from '@react-navigation/native';
import {useDispatch, useSelector} from 'react-redux';
import type {AppDispatch, RootState} from '@/app/store';
import {useTheme} from '@/hooks';
import {useFormBottomSheets} from './useFormBottomSheets';
import {useFileOperations} from './useFileOperations';

/**
 * Reusable hook for form screens with common patterns:
 * - Theme access
 * - Redux dispatch
 * - Navigation
 * - Form bottom sheets
 * - Unsaved changes tracking
 * - Discard sheet management
 */
export const useFormScreen = () => {
  const {theme} = useTheme();
  const dispatch = useDispatch<AppDispatch>();
  const navigation = useNavigation();
  const formSheets = useFormBottomSheets();

  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const discardSheetRef = useRef<any>(null);

  const handleGoBack = useCallback(() => {
    if (hasUnsavedChanges) {
      discardSheetRef.current?.open();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  }, [hasUnsavedChanges, navigation]);

  const markAsChanged = useCallback(() => {
    setHasUnsavedChanges(true);
  }, []);

  return {
    theme,
    dispatch,
    navigation,
    formSheets,
    hasUnsavedChanges,
    setHasUnsavedChanges,
    discardSheetRef,
    handleGoBack,
    markAsChanged,
  };
};

/**
 * Reusable hook for companion-based form screens
 */
export const useCompanionFormScreen = () => {
  const formScreen = useFormScreen();

  const companions = useSelector((state: RootState) => state.companion.companions);
  const selectedCompanionId = useSelector(
    (state: RootState) => state.companion.selectedCompanionId,
  );

  return {
    ...formScreen,
    companions,
    selectedCompanionId,
  };
};

/**
 * Hook for file operations with form change tracking
 */
export const useFormFileOperations = <T extends {[key: string]: any}>(
  files: any[],
  filesKey: keyof T,
  onFormChange: (field: keyof T, value: any) => void,
  onErrorClear: (field: any) => void,
  formSheets: ReturnType<typeof useFormBottomSheets>,
) => {
  return useFileOperations({
    files,
    setFiles: (newFiles) => onFormChange(filesKey, newFiles),
    clearError: () => onErrorClear(filesKey as any),
    openSheet: formSheets.openSheet,
    closeSheet: formSheets.closeSheet,
    deleteSheetRef: formSheets.refs.deleteSheetRef,
  });
};
