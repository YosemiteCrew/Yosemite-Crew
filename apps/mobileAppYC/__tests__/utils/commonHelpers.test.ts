import { Alert } from 'react-native';
import {
  showErrorAlert,
  showSuccessAlert,
  showConfirmAlert,
  capitalize,
  formatYesNo,
  formatDateDisplay,
  displayNeutered,
  displayInsured,
  displayOrigin,
  createRowStyles,
  createCenteredStyle,
} from '@/shared/utils/commonHelpers';

// Mock Alert.alert
jest.mock('react-native', () => ({
  Alert: {
    alert: jest.fn(),
  },
}));

// Cast the mock for easier access
const mockAlert = Alert.alert as jest.Mock;

describe('commonHelpers', () => {
  beforeEach(() => {
    // Clear mock calls before each test
    mockAlert.mockClear();
  });

  // --- Alert Functions ---
  describe('showErrorAlert', () => {
    it('should call Alert.alert with the correct title, message, and OK button', () => {
      showErrorAlert('Error', 'Something went wrong');
      expect(mockAlert).toHaveBeenCalledWith('Error', 'Something went wrong', [
        { text: 'OK' },
      ]);
    });
  });

  describe('showSuccessAlert', () => {
    it('should call Alert.alert with the correct title, message, and OK button', () => {
      showSuccessAlert('Success', 'It worked');
      expect(mockAlert).toHaveBeenCalledWith('Success', 'It worked', [
        { text: 'OK' },
      ]);
    });
  });

  describe('showConfirmAlert', () => {
    const mockOnConfirm = jest.fn();

    beforeEach(() => {
      mockOnConfirm.mockClear();
    });

    it('should call Alert.alert with default button text', () => {
      showConfirmAlert('Confirm', 'Are you sure?', mockOnConfirm);

      expect(mockAlert).toHaveBeenCalledWith(
        'Confirm',
        'Are you sure?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Confirm', onPress: mockOnConfirm },
        ],
      );
    });

    it('should call Alert.alert with custom button text', () => {
      showConfirmAlert(
        'Delete',
        'Delete this item?',
        mockOnConfirm,
        'Delete',
        'Go Back',
      );

      expect(mockAlert).toHaveBeenCalledWith(
        'Delete',
        'Delete this item?',
        [
          { text: 'Go Back', style: 'cancel' },
          { text: 'Delete', onPress: mockOnConfirm },
        ],
      );
    });

    it('should call onConfirm when the confirm button is pressed', () => {
      showConfirmAlert('Confirm', 'Are you sure?', mockOnConfirm);

      // Get the arguments passed to Alert.alert
      const alertArgs = mockAlert.mock.calls[0];
      // Get the buttons array (third argument)
      const buttons = alertArgs[2];
      // Get the confirm button (second in the array)
      const confirmButton = buttons[1];

      // Simulate pressing the button
      confirmButton.onPress();

      expect(mockOnConfirm).toHaveBeenCalledTimes(1);
    });
  });

  // --- Formatting Functions ---
  describe('capitalize', () => {
    it('should capitalize the first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
    });

    it('should return an empty string for null', () => {
      expect(capitalize(null)).toBe('');
    });

    it('should return an empty string for undefined', () => {
      expect(capitalize()).toBe('');
    });

    it('should return an empty string for an empty string', () => {
      expect(capitalize('')).toBe('');
    });

    it('should handle already capitalized strings', () => {
      expect(capitalize('World')).toBe('World');
    });
  });

  describe('formatYesNo', () => {
    it('should return "Yes" for true', () => {
      expect(formatYesNo(true)).toBe('Yes');
    });

    it('should return "No" for false', () => {
      expect(formatYesNo(false)).toBe('No');
    });

    it('should return an empty string for null', () => {
      expect(formatYesNo(null)).toBe('');
    });

    it('should return an empty string for undefined', () => {
      expect(formatYesNo()).toBe('');
    });
  });

  describe('formatDateDisplay', () => {
    it('should format a Date object correctly', () => {
      // Use a UTC string to ensure consistent timezone
      const testDate = new Date('2025-10-31T12:00:00Z');
      expect(formatDateDisplay(testDate)).toBe('31/10/2025');
    });

    it('should format a date string correctly', () => {
      const testDateString = '2024-02-05T10:00:00Z';
      expect(formatDateDisplay(testDateString)).toBe('05/02/2024');
    });

    it('should format a date with single-digit month/day', () => {
      const testDate = new Date('2024-01-01T12:00:00Z');
      expect(formatDateDisplay(testDate)).toBe('01/01/2024');
    });

    it('should return an empty string for null', () => {
      expect(formatDateDisplay(null)).toBe('');
    });

    it('should return an empty string for undefined', () => {
      expect(formatDateDisplay()).toBe('');
    });

    it('should return an empty string for an empty string', () => {
      expect(formatDateDisplay('')).toBe('');
    });
  });

  describe('displayNeutered', () => {
    it('should return "Neutered"', () => {
      expect(displayNeutered('neutered')).toBe('Neutered');
    });

    it('should return "Not neutered"', () => {
      expect(displayNeutered('not-neutered')).toBe('Not neutered');
    });

    it('should return an empty string for null', () => {
      expect(displayNeutered(null)).toBe('');
    });
  });

  describe('displayInsured', () => {
    it('should return "Insured"', () => {
      expect(displayInsured('insured')).toBe('Insured');
    });

    it('should return "Not insured"', () => {
      expect(displayInsured('not-insured')).toBe('Not insured');
    });

    it('should return an empty string for null', () => {
      expect(displayInsured(null)).toBe('');
    });
  });

  describe('displayOrigin', () => {
    it('should return "Shop"', () => {
      expect(displayOrigin('shop')).toBe('Shop');
    });

    it('should return "Breeder"', () => {
      expect(displayOrigin('breeder')).toBe('Breeder');
    });

    it('should return "Foster/ Shelter"', () => {
      expect(displayOrigin('foster-shelter')).toBe('Foster/ Shelter');
    });

    it('should return "Friends or family"', () => {
      expect(displayOrigin('friends-family')).toBe('Friends or family');
    });

    it('should return "Unknown"', () => {
      expect(displayOrigin('unknown')).toBe('Unknown');
    });

    it('should return an empty string for null', () => {
      expect(displayOrigin(null)).toBe('');
    });

    it('should return an empty string for an invalid value', () => {
      expect(displayOrigin('random-string' as any)).toBe('');
    });
  });

  // --- Style Functions ---
  describe('createRowStyles', () => {
    const mockTheme = {
      spacing: [0, 4, 8, 12], // Use an array as implied by spacing[3]
      typography: {
        paragraphBold: { fontSize: 16, fontWeight: 'bold' },
        bodyMedium: { fontSize: 14 },
      },
      colors: {
        secondary: '#555',
        textSecondary: '#777',
        borderSeperator: '#eee',
      },
    };

    it('should create the correct row style object', () => {
      const styles = createRowStyles(mockTheme);

      expect(styles.row).toEqual({
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingVertical: 12, // from mockTheme.spacing[3]
        paddingHorizontal: 12, // from mockTheme.spacing[3]
      });

      expect(styles.rowLabel).toEqual({
        fontSize: 16, // from mockTheme.typography.paragraphBold
        fontWeight: 'bold', // from mockTheme.typography.paragraphBold
        color: '#555', // from mockTheme.colors.secondary
        flex: 1,
      });

      expect(styles.rowValue).toEqual({
        fontSize: 14, // from mockTheme.typography.bodyMedium
        color: '#777', // from mockTheme.colors.textSecondary
        flex: 1,
        textAlign: 'right',
      });

      expect(styles.separator).toEqual({
        height: 1,
        backgroundColor: '#eee', // from mockTheme.colors.borderSeperator
      });
    });
  });

  describe('createCenteredStyle', () => {
    it('should create the correct centered style object', () => {
      const styles = createCenteredStyle(); // No theme needed
      expect(styles.centered).toEqual({
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
      });
    });
  });
});