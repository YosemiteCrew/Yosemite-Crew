/**
 * Common bottom sheet helper utilities to reduce duplication
 */
import type {BottomSheetRef} from '@/components/common/BottomSheet/BottomSheet';
import type {RefObject} from 'react';

/**
 * Creates imperative handle for bottom sheet with cleanup functions
 */
export const createBottomSheetImperativeHandle = (
  bottomSheetRef: RefObject<BottomSheetRef>,
  cleanupFn?: () => void,
) => ({
  open: () => {
    cleanupFn?.();
    bottomSheetRef.current?.snapToIndex(0);
  },
  close: () => {
    cleanupFn?.();
    bottomSheetRef.current?.close();
  },
});

/**
 * Common bottom sheet style configurations
 */
export const createBottomSheetStyles = (theme: any) => ({
  bottomSheetBackground: {
    backgroundColor: theme.colors.background,
    borderTopLeftRadius: theme.borderRadius['3xl'],
    borderTopRightRadius: theme.borderRadius['3xl'],
  },
  bottomSheetHandle: {
    backgroundColor: theme.colors.borderMuted,
  },
});

/**
 * Common bottom sheet container styles
 */
export const createBottomSheetContainerStyles = (theme: any) => ({
  container: {
    flex: 1,
    paddingHorizontal: theme.spacing['5'],
    backgroundColor: theme.colors.background,
  },
  header: {
    flexDirection: 'row' as const,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing['4'],
    position: 'relative' as const,
  },
  title: {
    ...theme.typography.h3,
    color: theme.colors.text,
  },
  closeButton: {
    position: 'absolute' as const,
    right: 0,
    padding: theme.spacing['2'],
  },
  closeIcon: {
    width: theme.spacing['6'],
    height: theme.spacing['6'],
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: theme.spacing['4'],
    gap: theme.spacing['4'],
  },
});

/**
 * Common button container styles for bottom sheets
 */
export const createBottomSheetButtonStyles = (theme: any) => ({
  buttonContainer: {
    flexDirection: 'row' as const,
    gap: theme.spacing['3'],
    paddingVertical: theme.spacing['4'],
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: theme.colors.border,
    backgroundColor: theme.colors.surface,
  },
  cancelButton: {
    flex: 1,
    backgroundColor: theme.colors.surface,
  },
  cancelButtonText: {
    ...theme.typography.paragraphBold,
    color: theme.colors.secondary,
  },
  saveButton: {
    flex: 1,
  },
  saveButtonText: {
    ...theme.typography.paragraphBold,
    color: theme.colors.white,
  },
});

// Need to import StyleSheet for hairlineWidth
import {StyleSheet} from 'react-native';
