import { createAttachmentStyles } from '@/shared/utils/attachmentStyles';


jest.mock('react-native', () => ({
  StyleSheet: {
    create: jest.fn(styles => styles),
  },
}));

const mockTheme = {
  spacing: {
    2: 4,
    3: 8,
    4: 12,
    6: 16,
    8: 20,
  },
  colors: {
    cardBackground: '#fff',
    borderMuted: '#eee',
    surface: '#f5f5f5',
    textSecondary: '#666',
    primary: '#007aff',
    white: '#fff',
    secondary: '#111',
    border: '#ddd',
  },
  borderRadius: {
    lg: 16,
    base: 8,
  },
  typography: {
    bodySmall: { fontSize: 12 },
    labelSmall: { fontSize: 10 },
    titleMedium: { fontSize: 18 },
  },
  shadows: {
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.2,
      shadowRadius: 4,
      elevation: 4,
    },
  },
};

describe('createAttachmentStyles', () => {
  it('should create the correct styles from the theme', () => {
    const styles = createAttachmentStyles(mockTheme);

    expect(styles.container).toEqual({ gap: mockTheme.spacing[4] });
    expect(styles.previewCard).toMatchObject({
      backgroundColor: mockTheme.colors.cardBackground,
      borderRadius: mockTheme.borderRadius.lg,
      borderColor: mockTheme.colors.borderMuted,
      padding: mockTheme.spacing[4],
    });
    expect(styles.emptyStateContainer).toMatchObject({
      borderColor: mockTheme.colors.borderMuted,
      backgroundColor: mockTheme.colors.surface,
    });
    expect(styles.shareButton).toMatchObject({
      backgroundColor: mockTheme.colors.primary,
      width: 48,
      height: 48,
    });
    expect(styles.downloadButton).toMatchObject({
      backgroundColor: mockTheme.colors.secondary,
      width: 48,
      height: 48,
    });
  });
});
