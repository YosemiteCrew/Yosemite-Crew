import type {ImageStyle} from 'react-native';

/**
 * Shared icon style definitions to reduce duplication across the app
 * These are theme-independent baseline styles that work with any theme
 */

export const createIconStyles = (theme: any) => ({
  // Dropdown/Select icon - used in TouchableInput fields
  dropdownIcon: {
    width: 16,
    height: 16,
    resizeMode: 'contain' as const,
  } as ImageStyle,

  // Calendar icon - used in date pickers
  calendarIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain' as const,
  } as ImageStyle,

  // Clock icon - used in time pickers
  clockIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain' as const,
  } as ImageStyle,

  // Delete icon - used in action buttons
  deleteIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain' as const,
    tintColor: theme.colors.error,
  } as ImageStyle,

  // Add icon - used in action buttons
  addIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain' as const,
    tintColor: theme.colors.secondary,
  } as ImageStyle,
});
