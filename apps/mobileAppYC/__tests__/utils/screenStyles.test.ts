import {
  createScreenContainerStyles,
  createErrorContainerStyles,
  createEmptyStateStyles,
  createSearchAndSelectorStyles,
} from '@/shared/utils/screenStyles';

// Define a mock theme
const mockTheme = {
  colors: {
    background: '#F0F0F0',
    error: '#FF0000',
    textSecondary: '#666666',
  },
  spacing: {
    2: 8,
    4: 16,
    6: 24,
  },
  typography: {
    bodyLarge: { fontSize: 18 },
    bodyMedium: { fontSize: 16 },
  },
};

describe('screenStyles', () => {
  describe('createScreenContainerStyles', () => {
    it('should create correct container styles', () => {
      const styles = createScreenContainerStyles(mockTheme);
      expect(styles).toEqual({
        container: {
          flex: 1,
          backgroundColor: '#F0F0F0',
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
        errorText: {
          fontSize: 18,
          color: '#FF0000',
        },
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
        emptyText: {
          fontSize: 16,
          color: '#666666',
        },
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