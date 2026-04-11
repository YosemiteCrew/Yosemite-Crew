import {
  createBottomSheetImperativeHandle,
  createBottomSheetStyles,
  createBottomSheetContainerStyles,
  createBottomSheetButtonStyles,
} from '@/shared/utils/bottomSheetHelpers';
import type { RefObject } from 'react';
import type { BottomSheetRef } from '@/shared/components/common/BottomSheet/BottomSheet';
import {mockTheme} from '../setup/mockTheme';

// Mock react-native's StyleSheet to provide a static value for hairlineWidth
jest.mock('react-native', () => ({
  StyleSheet: {
    hairlineWidth: 1, // Use 1 for predictable test output
  },
}));

// Create a comprehensive mock theme to test all style functions


describe('bottomSheetHelpers', () => {
  describe('createBottomSheetImperativeHandle', () => {
    // Create mock functions for the ref's methods
    const mockSnapToIndex = jest.fn();
    const mockClose = jest.fn();
    const mockCleanupFn = jest.fn();

    // Create a mock ref object
    // --- THIS IS THE FIX ---
    // Cast 'current' to 'as any' to bypass strict type-checking.
    // We only care about the methods our function actually calls.
    const mockRef: RefObject<BottomSheetRef> = {
      current: {
        snapToIndex: mockSnapToIndex,
        close: mockClose,
      } as any,
    };

    beforeEach(() => {
      // Reset mocks before each test
      mockSnapToIndex.mockClear();
      mockClose.mockClear();
      mockCleanupFn.mockClear();
    });

    it('should call snapToIndex(0) and cleanupFn on open', () => {
      const handle = createBottomSheetImperativeHandle(mockRef, mockCleanupFn);
      handle.open();

      expect(mockCleanupFn).toHaveBeenCalledTimes(1);
      expect(mockSnapToIndex).toHaveBeenCalledWith(0);
      expect(mockClose).not.toHaveBeenCalled();
    });

    it('should call close() and cleanupFn on close', () => {
      const handle = createBottomSheetImperativeHandle(mockRef, mockCleanupFn);
      handle.close();

      expect(mockCleanupFn).toHaveBeenCalledTimes(1);
      expect(mockClose).toHaveBeenCalledTimes(1);
      expect(mockSnapToIndex).not.toHaveBeenCalled();
    });

    it('should handle open/close without a cleanupFn', () => {
      const handle = createBottomSheetImperativeHandle(mockRef); // No cleanupFn

      expect(() => handle.open()).not.toThrow();
      expect(mockSnapToIndex).toHaveBeenCalledWith(0);

      expect(() => handle.close()).not.toThrow();
      expect(mockClose).toHaveBeenCalledTimes(1);
    });

    it('should not throw if ref.current is null', () => {
      const nullRef: RefObject<BottomSheetRef | null> = { current: null };
      const handle = createBottomSheetImperativeHandle(nullRef, mockCleanupFn);

      expect(() => handle.open()).not.toThrow();
      expect(mockCleanupFn).toHaveBeenCalledTimes(1); // Cleanup should still run

      expect(() => handle.close()).not.toThrow();
      expect(mockCleanupFn).toHaveBeenCalledTimes(2); // Cleanup runs again

      expect(mockSnapToIndex).not.toHaveBeenCalled();
      expect(mockClose).not.toHaveBeenCalled();
    });
  });

  describe('createBottomSheetStyles', () => {
    it('should return correct styles from the theme', () => {
      const styles = createBottomSheetStyles(mockTheme);
      expect(styles).toEqual({
        bottomSheetBackground: {
          backgroundColor: mockTheme.colors.background,
          borderTopLeftRadius: mockTheme.spacing['6'],
          borderTopRightRadius: mockTheme.spacing['6'],
        },
        bottomSheetHandle: {
          backgroundColor: mockTheme.colors.borderMuted,
        },
      });
    });
  });

  describe('createBottomSheetContainerStyles', () => {
    it('should return correct container styles from the theme', () => {
      const styles = createBottomSheetContainerStyles(mockTheme);
      expect(styles).toEqual({
        container: {
          flex: 1,
          paddingHorizontal: mockTheme.spacing['5'],
          backgroundColor: mockTheme.colors.background,
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: mockTheme.spacing['4'],
          position: 'relative',
        },
        title: {
          ...mockTheme.typography.h3,
          color: mockTheme.colors.text,
        },
        closeButton: {
          position: 'absolute',
          right: 0,
        },
        closeIcon: {
          width: mockTheme.spacing['6'],
          height: mockTheme.spacing['6'],
        },
        scrollView: {
          flex: 1,
        },
        scrollContent: {
          paddingBottom: mockTheme.spacing['4'],
          gap: mockTheme.spacing['4'],
        },
      });
    });
  });

  describe('createBottomSheetButtonStyles', () => {
    it('should return correct button styles from the theme', () => {
      const styles = createBottomSheetButtonStyles(mockTheme);
      expect(styles).toEqual({
        buttonContainer: {
          flexDirection: 'row',
          gap: mockTheme.spacing['3'],
          paddingVertical: mockTheme.spacing['4'],
          borderTopWidth: 1, // From StyleSheet.hairlineWidth mock
          borderTopColor: mockTheme.colors.border,
          backgroundColor: mockTheme.colors.surface,
        },
        cancelButton: {
          flex: 1,
          backgroundColor: mockTheme.colors.surface,
        },
        cancelButtonText: {
          ...mockTheme.typography.paragraphBold,
          color: mockTheme.colors.secondary,
        },
        saveButton: {
          flex: 1,
        },
        saveButtonText: {
          ...mockTheme.typography.paragraphBold,
          color: mockTheme.colors.white,
        },
      });
    });
  });
});
