import {
  createBottomSheetImperativeHandle,
  createBottomSheetStyles,
  createBottomSheetContainerStyles,
  createBottomSheetButtonStyles,
} from '@/shared/utils/bottomSheetHelpers';
import type { RefObject } from 'react';
import type { BottomSheetRef } from '@/shared/components/common/BottomSheet/BottomSheet';

// Mock react-native's StyleSheet to provide a static value for hairlineWidth
jest.mock('react-native', () => ({
  StyleSheet: {
    hairlineWidth: 1, // Use 1 for predictable test output
  },
}));

// Create a comprehensive mock theme to test all style functions
const mockTheme = {
  colors: {
    background: '#ffffff',
    borderMuted: '#cccccc',
    border: '#dddddd',
    surface: '#fafafa',
    text: '#111111',
    secondary: '#555555',
    white: '#ffffff',
    borderSeperator: '#eeeeee',
  },
  borderRadius: {
    '3xl': 24,
  },
  spacing: {
    '2': 4,
    '3': 8,
    '4': 12,
    '5': 16,
    '6': 20,
  },
  typography: {
    h3: { fontSize: 24, fontWeight: '700' },
    paragraphBold: { fontSize: 16, fontWeight: '700' },
  },
};

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
          backgroundColor: '#ffffff',
          borderTopLeftRadius: 24,
          borderTopRightRadius: 24,
        },
        bottomSheetHandle: {
          backgroundColor: '#cccccc',
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
          paddingHorizontal: 16,
          backgroundColor: '#ffffff',
        },
        header: {
          flexDirection: 'row',
          justifyContent: 'center',
          alignItems: 'center',
          paddingVertical: 12,
          position: 'relative',
        },
        title: {
          fontSize: 24,
          fontWeight: '700',
          color: '#111111',
        },
        closeButton: {
          position: 'absolute',
          right: 0,
          padding: 4,
        },
        closeIcon: {
          width: 20,
          height: 20,
        },
        scrollView: {
          flex: 1,
        },
        scrollContent: {
          paddingBottom: 12,
          gap: 12,
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
          gap: 8,
          paddingVertical: 12,
          borderTopWidth: 1, // From StyleSheet.hairlineWidth mock
          borderTopColor: '#dddddd',
          backgroundColor: '#fafafa',
        },
        cancelButton: {
          flex: 1,
          backgroundColor: '#fafafa',
        },
        cancelButtonText: {
          fontSize: 16,
          fontWeight: '700',
          color: '#555555',
        },
        saveButton: {
          flex: 1,
        },
        saveButtonText: {
          fontSize: 16,
          fontWeight: '700',
          color: '#ffffff',
        },
      });
    });
  });
});