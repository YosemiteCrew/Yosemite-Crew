import { createAttachmentStyles } from '@/shared/utils/attachmentStyles';
import {mockTheme} from '../setup/mockTheme';

jest.mock('react-native/Libraries/Utilities/Platform', () => ({
  OS: 'ios',
  select: jest.fn((options) => options.ios),
}));

jest.mock('react-native', () => ({
  StyleSheet: {
    create: jest.fn(styles => styles),
  },
  Platform: {
    OS: 'ios',
    select: jest.fn((options) => options.ios),
  },
}));



describe('createAttachmentStyles', () => {
  it('should create the correct styles from the theme', () => {
    const styles = createAttachmentStyles(mockTheme);

    expect(styles.container).toEqual({ gap: mockTheme.spacing[4] });
    expect(styles.previewCard).toMatchObject({
      borderRadius: mockTheme.borderRadius.lg,
      alignItems: 'center',
      width: '100%',
      gap: mockTheme.spacing[3],
    });
    expect(styles.emptyStateContainer).toMatchObject({
      borderColor: mockTheme.colors.borderMuted,
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
