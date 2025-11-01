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
  },
  colors: {
    cardBackground: '#fff',
    borderMuted: '#eee',
    surface: '#f5f5f5',
    textSecondary: '#666',
    primary: '#007aff',
    white: '#fff',
  },
  borderRadius: {
    lg: 16,
    base: 8,
  },
  typography: {
    bodySmall: { fontSize: 12 },
    labelSmall: { fontSize: 10 },
  },
  shadows: {
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 8,
    },
  },
};

describe('createAttachmentStyles', () => {
  it('should create the correct styles from the theme', () => {
    const styles = createAttachmentStyles(mockTheme);

    expect(styles).toEqual({
      container: { gap: 12 },
      previewCard: {
        backgroundColor: '#fff',
        borderRadius: 16,
        padding: 12,
        borderWidth: 1,
        borderColor: '#eee',
        alignItems: 'center',
      },
      previewImage: {
        width: '100%',
        height: 400,
        borderRadius: 8,
        marginBottom: 4,
      },
      pdfPlaceholder: {
        width: '100%',
        height: 300,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f5f5f5',
        borderRadius: 8,
        marginBottom: 4,
      },
      pdfIcon: {
        width: 64,
        height: 64,
        resizeMode: 'contain',
        marginBottom: 8,
      },
      pdfLabel: {
        fontSize: 12,
        color: '#666',
      },
      pageIndicator: {
        fontSize: 10,
        color: '#666',
      },
      shareButton: {
        width: 56,
        height: 56,
        borderRadius: 28,
        backgroundColor: '#007aff',
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
        elevation: 8,
      },
      shareIcon: {
        width: 28,
        height: 28,
        resizeMode: 'contain',
        tintColor: '#fff',
      },
    });
  });
});