import { createTaskFormSectionStyles } from '@/features/tasks/components/shared/taskFormStyles';

// Mock the theme object
const mockTheme = {
  spacing: {
    '3': 12,
    '4': 16,
  },
};

describe('createTaskFormSectionStyles', () => {
  it('creates the correct style object from the theme', () => {
    const styles = createTaskFormSectionStyles(mockTheme);

    // Snapshot test to ensure styles don't change unexpectedly

    // Specific checks to ensure theme values are used
    expect(styles.fieldGroup.marginBottom).toBe(16);
    expect(styles.dateTimeRow.gap).toBe(12);
    expect(styles.dateTimeRow.marginBottom).toBe(16);

    // Check static values
    expect(styles.calendarIcon.width).toBe(18);
    expect(styles.textArea.minHeight).toBe(100);
    expect(styles.dateTimeField.flex).toBe(1);
  });

  it('handles a theme with different spacing', () => {
    const differentTheme = {
      spacing: {
        '3': 10,
        '4': 20,
      },
    };
    const styles = createTaskFormSectionStyles(differentTheme);

    expect(styles.fieldGroup.marginBottom).toBe(20);
    expect(styles.dateTimeRow.gap).toBe(10);
    expect(styles.dateTimeRow.marginBottom).toBe(20);
  });
});
