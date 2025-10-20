/**
 * Common helper functions to reduce duplication across screens
 */
import {Alert} from 'react-native';

/**
 * Shows a standard error alert with OK button
 */
export const showErrorAlert = (title: string, message: string) => {
  Alert.alert(title, message, [{text: 'OK'}]);
};

/**
 * Shows a standard success alert with OK button
 */
export const showSuccessAlert = (title: string, message: string) => {
  Alert.alert(title, message, [{text: 'OK'}]);
};

/**
 * Shows a confirmation alert with Cancel and Confirm buttons
 */
export const showConfirmAlert = (
  title: string,
  message: string,
  onConfirm: () => void,
  confirmText: string = 'Confirm',
  cancelText: string = 'Cancel',
) => {
  Alert.alert(title, message, [
    {text: cancelText, style: 'cancel'},
    {text: confirmText, onPress: onConfirm},
  ]);
};

/**
 * Capitalizes the first letter of a string
 */
export const capitalize = (s?: string | null): string => {
  if (s == null || s === '') {
    return '';
  }
  return s.charAt(0).toUpperCase() + s.slice(1);
};

/**
 * Formats a boolean status as Yes/No
 */
export const formatYesNo = (value?: boolean | null): string => {
  if (value == null) return '';
  return value ? 'Yes' : 'No';
};

/**
 * Formats a date to display format (DD/MM/YYYY)
 */
export const formatDateDisplay = (date?: string | Date | null): string => {
  if (!date) return '';
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  return `${day}/${month}/${year}`;
};

/**
 * Display neutered status as human-readable text
 */
export const displayNeutered = (v?: 'neutered' | 'not-neutered' | null): string => {
  if (v == null) return '';
  return v === 'neutered' ? 'Neutered' : 'Not neutered';
};

/**
 * Display insured status as human-readable text
 */
export const displayInsured = (v?: 'insured' | 'not-insured' | null): string => {
  if (v == null) return '';
  return v === 'insured' ? 'Insured' : 'Not insured';
};

/**
 * Display companion origin as human-readable text
 */
export const displayOrigin = (v?: 'shop' | 'breeder' | 'foster-shelter' | 'friends-family' | 'unknown' | null): string => {
  switch (v) {
    case 'shop':
      return 'Shop';
    case 'breeder':
      return 'Breeder';
    case 'foster-shelter':
      return 'Foster/ Shelter';
    case 'friends-family':
      return 'Friends or family';
    case 'unknown':
      return 'Unknown';
    default:
      return '';
  }
};

/**
 * Common row styles for list items in screens
 */
export const createRowStyles = (theme: any) => ({
  row: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
    paddingVertical: theme.spacing[3],
    paddingHorizontal: theme.spacing[3],
  },
  rowLabel: {
    ...theme.typography.paragraphBold,
    color: theme.colors.secondary,
    flex: 1,
  },
  rowValue: {
    ...theme.typography.bodyMedium,
    color: theme.colors.textSecondary,
    flex: 1,
    textAlign: 'right' as const,
  },
  separator: {
    height: 1,
    backgroundColor: theme.colors.borderSeperator,
  },
});

/**
 * Common centered container style
 */
export const createCenteredStyle = (theme: any) => ({
  centered: {
    flex: 1,
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
  },
});
