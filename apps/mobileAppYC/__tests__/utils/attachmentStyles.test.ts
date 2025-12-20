import { createAttachmentStyles } from '@/shared/utils/attachmentStyles';
import {mockTheme} from '../setup/mockTheme';


jest.mock('react-native', () => ({
  StyleSheet: {
    create: jest.fn(styles => styles),
  },
}));



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
