import type {ImageStyle} from 'react-native';

/**
 * Shared icon style definitions to reduce duplication across the app
 * These are theme-independent baseline styles that work with any theme
 */

type IconStylesType = {
  dropdownIcon: ImageStyle;
  calendarIcon: ImageStyle;
  clockIcon: ImageStyle;
  deleteIcon: ImageStyle;
  addIcon: ImageStyle;
};

export const createIconStyles = (theme: any): IconStylesType => ({
  // Dropdown/Select icon - used in TouchableInput fields
  dropdownIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
  },

  // Calendar icon - used in date pickers
  calendarIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },

  // Clock icon - used in time pickers
  clockIcon: {
    width: 18,
    height: 18,
    resizeMode: 'contain',
  },

  // Delete icon - used in action buttons
  deleteIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: theme.colors.error,
  },

  // Add icon - used in action buttons
  addIcon: {
    width: 20,
    height: 20,
    resizeMode: 'contain',
    tintColor: theme.colors.secondary,
  },
});
