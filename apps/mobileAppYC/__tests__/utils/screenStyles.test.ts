import {
  createScreenContainerStyles,
  createErrorContainerStyles,
  createEmptyStateStyles,
  createSearchAndSelectorStyles,
} from '@/shared/utils/screenStyles';
import {mockTheme} from '../setup/mockTheme';

// Define a mock theme


describe('screenStyles', () => {
  describe('createScreenContainerStyles', () => {
    it('should create correct container styles', () => {
      const styles = createScreenContainerStyles(mockTheme);
      expect(styles).toEqual({
        container: {
          flex: 1,
          backgroundColor: '#FFFEFE',
        },
        contentContainer: {
          paddingHorizontal: 16,
          paddingBottom: 24,
        },
      });
    });
  });

  describe('createErrorContainerStyles', () => {
    it('should create correct error styles', () => {
      const styles = createErrorContainerStyles(mockTheme);
      expect(styles).toEqual({
        errorContainer: {
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
        },
        errorText: expect.objectContaining({
          fontSize: 18,
          fontWeight: '400',
          lineHeight: 29.25,
          fontFamily: 'Satoshi-Regular',
          color: '#F44336',
        }),
      });
    });
  });

  describe('createEmptyStateStyles', () => {
    it('should create correct empty state styles', () => {
      const styles = createEmptyStateStyles(mockTheme);
      expect(styles).toEqual({
        emptyContainer: {
          paddingVertical: 16,
          alignItems: 'center',
        },
        emptyText: expect.objectContaining({
          fontSize: 14,
          fontWeight: '400',
          fontFamily: 'Satoshi-Regular',
          color: '#747473',
        }),
      });
    });
  });

  describe('createSearchAndSelectorStyles', () => {
    it('should create correct search and selector styles', () => {
      const styles = createSearchAndSelectorStyles(mockTheme);
      expect(styles).toEqual({
        searchBar: {
          marginTop: 16,
          marginBottom: 8,
        },
        companionSelector: {
          marginBottom: 16,
        },
      });
    });
  });
});