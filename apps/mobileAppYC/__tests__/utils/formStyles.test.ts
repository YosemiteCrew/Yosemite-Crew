import { createFormStyles } from '@/shared/utils/formStyles';

// Define a mock theme
const mockTheme = {
  spacing: {
    1: 4,
    2: 8,
    3: 12,
    4: 16,
  },
  colors: {
    secondary: '#555',
    surface: '#f5f5f5',
    lightBlueBackground: '#e0f7ff',
    primary: '#007aff',
    error: '#ff0000',
  },
  typography: {
    bodyMedium: { fontSize: 16 },
    bodySmall: { fontSize: 14 },
    labelXsBold: { fontSize: 10, fontWeight: 'bold' },
  },
};

describe('createFormStyles', () => {
  it('should create the correct styles from the theme', () => {
    const styles = createFormStyles(mockTheme);

    expect(styles).toEqual({
      fieldGroup: {
        marginBottom: 16,
      },
      toggleSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
      },
      toggleLabel: {
        fontSize: 16, // from bodyMedium
        color: '#555',
        fontWeight: '500',
      },
      dateTimeRow: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 16,
      },
      dateTimeField: {
        flex: 1,
      },
      textArea: {
        minHeight: 100,
        textAlignVertical: 'top',
      },
      reminderPillsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 16,
      },
      reminderPill: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        backgroundColor: '#f5f5f5',
        borderRadius: 28,
        borderWidth: 0.5,
        borderColor: '#312943',
      },
      reminderPillSelected: {
        backgroundColor: '#e0f7ff',
        borderColor: '#007aff',
      },
      reminderPillText: {
        fontSize: 14, // from bodySmall
        color: '#555',
        fontWeight: '500',
      },
      reminderPillTextSelected: {
        color: '#007aff',
        fontWeight: '600',
      },
      errorText: {
        fontSize: 10, // from labelXsBold
        fontWeight: 'bold',
        color: '#ff0000',
        marginTop: 3,
        marginBottom: 12,
        marginLeft: 4,
      },
    });
  });
});