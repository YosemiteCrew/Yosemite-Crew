import { createFormStyles } from '@/shared/utils/formStyles';
import {mockTheme} from '../setup/mockTheme';

// Define a mock theme


describe('createFormStyles', () => {
  it('should create the correct styles from the theme', () => {
    const styles = createFormStyles(mockTheme);

    expect(styles).toEqual({
      fieldGroup: {
        marginBottom: mockTheme.spacing['4'],
      },
      toggleSection: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: mockTheme.spacing['4'],
      },
      toggleLabel: {
        ...mockTheme.typography.bodyMedium,
        color: mockTheme.colors.secondary,
        fontWeight: '500',
      },
      dateTimeRow: {
        flexDirection: 'row',
        gap: mockTheme.spacing['3'],
        marginBottom: mockTheme.spacing['4'],
      },
      dateTimeField: {
        flex: 1,
      },
      textArea: {
        minHeight: mockTheme.spacing['24'],
        textAlignVertical: 'top',
      },
      reminderPillsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: mockTheme.spacing['2'],
        marginBottom: mockTheme.spacing['4'],
      },
      reminderPill: {
        paddingVertical: mockTheme.spacing['2'],
        paddingHorizontal: mockTheme.spacing['3'],
        backgroundColor: mockTheme.colors.surface,
        borderRadius: mockTheme.borderRadius['3xl'],
        borderWidth: 0.5,
        borderColor: mockTheme.colors.borderMuted,
      },
      reminderPillSelected: {
        backgroundColor: mockTheme.colors.lightBlueBackground,
        borderColor: mockTheme.colors.primary,
      },
      reminderPillText: {
        ...mockTheme.typography.bodySmall,
        color: mockTheme.colors.secondary,
        fontWeight: '500',
      },
      reminderPillTextSelected: {
        color: mockTheme.colors.primary,
        fontWeight: '600',
      },
      errorText: {
        ...mockTheme.typography.labelXxsBold,
        color: mockTheme.colors.error,
        marginTop: mockTheme.spacing['1'],
        marginBottom: mockTheme.spacing['3'],
        marginLeft: mockTheme.spacing['1'],
      },
    });
  });
});
