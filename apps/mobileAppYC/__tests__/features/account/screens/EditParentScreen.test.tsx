import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
// FIX: Removed unused View and Text. Kept BackHandler for tests.
import {EditParentScreen} from '@/features/account/screens/EditParentScreen';
import {useTheme} from '@/hooks';
import {selectAuthUser, selectAuthIsLoading} from '@/features/auth/selectors';
import {updateUserProfile} from '@/features/auth';
// FIX: Import AppDispatch to solve TS errors
import type {RootState, AppDispatch} from '@/app/store';
import type {User} from '@/features/auth/types';

// --- Mock Data ---
const mockUser: User = {
  id: 'user-123',
  email: 'test@example.com',
  firstName: 'Test',
  lastName: 'User',
  phone: '+18005551212',
  dateOfBirth: '1990-05-15',
  currency: 'USD',
  address: {
    addressLine: '123 Main St',
    city: 'Anytown',
    stateProvince: 'CA',
    postalCode: '12345',
    country: 'United States',
  },
  profilePicture: 'https://example.com/image.png',
};

// --- NEW ---
// Mock user with minimal/null data to test fallbacks
const minimalUser: User = {
  id: 'min-123',
  email: 'min@example.com',
  firstName: null,
  lastName: undefined,
  phone: null,
  dateOfBirth: null,
  currency: undefined,
  address: undefined, // Test no address object
  profilePicture: undefined,
} as any;
// --- END NEW ---

const mockTheme: any = {
  spacing: {1: 2, 3: 6, 4: 8, 6: 12},
  colors: {
    background: '#FFF',
    primary: '#007AFF',
    secondary: '#333',
    textSecondary: '#888',
    white: '#FFF',
  },
  typography: {
    h4Alt: {fontSize: 18, fontWeight: '600'},
    bodySmall: {fontSize: 12},
    h3: {fontSize: 20},
    paragraph: {fontSize: 14},
  },
};

jest.mock(
  '@/shared/utils/countryList.json',
  () => [
    {name: 'United States', dial_code: '+1', code: 'US'},
    {name: 'United Kingdom', dial_code: '+44', code: 'GB'},
  ],
  {virtual: true},
);

// --- Mocks ---

// react-navigation
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn(() => true);
const mockNavigation = {
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: jest.fn(() => mockNavigation),
}));

// react-redux
// FIX: Type the mock dispatch as AppDispatch and cast jest.fn() to 'any'
// This resolves the complex "Conversion of type" TypeScript error.
const mockAppDispatch: AppDispatch = jest.fn((action: any) => {
  if (typeof action === 'function') {
    return action(mockAppDispatch, () => mockState, undefined);
  }
  return action;
}) as any;

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'), // FIX: Return the correctly typed mock without 'as unknown'
  useDispatch: jest.fn(() => mockAppDispatch),
  useSelector: jest.fn(selector => selector(mockState)),
}));

// Hooks
jest.mock('@/hooks');
(useTheme as jest.Mock).mockReturnValue({theme: mockTheme});

// Redux Thunks & Selectors
const mockUpdateUserProfileImpl = jest.fn();
jest.mock('@/features/auth/selectors', () => ({
  selectAuthUser: jest.fn(),
  selectAuthIsLoading: jest.fn(),
}));
jest.mock('@/features/auth', () => ({
  __esModule: true,
  updateUserProfile: jest.fn(
    (patch: Partial<User>) => () => mockUpdateUserProfileImpl(patch),
  ),
  // Provide stubs for other exports referenced via the barrel
  selectAuthState: jest.fn(),
  establishSession: jest.fn(() => () => Promise.resolve()),
  initializeAuth: jest.fn(() => () => Promise.resolve()),
  logout: jest.fn(() => () => Promise.resolve()),
  refreshSession: jest.fn(() => () => Promise.resolve()),
  authReducer: jest.fn(),
}));

// --- Component Mocks ---

jest.mock('@/shared/components/common/Header/Header', () => {
  const {View: MockView} = require('react-native');
  return {
    Header: jest.fn(({onBack}: any) => (
      <MockView testID="mock-header" onPress={onBack} />
    )),
  };
});

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View: MockView} = require('react-native');
  return {
    LiquidGlassCard: jest.fn(({children}: any) => (
      <MockView testID="mock-glass-card">{children}</MockView>
    )),
  };
});

jest.mock('@/shared/components/common/FormRowComponents', () => {
  const {View: MockView, Text: MockText} = require('react-native');
  return {
    Separator: jest.fn(() => <MockView testID="mock-separator" />),
    RowButton: jest.fn((props: any) => (
      <MockView
        testID={`mock-row-${props.label}`}
        {...props}
        onPress={props.onPress}>
                <MockText>{props.label}</MockText>       {' '}
        <MockText>{props.value}</MockText>     {' '}
      </MockView>
    )),
    ReadOnlyRow: jest.fn((props: any) => (
      <MockView testID={`mock-row-${props.label}`} {...props}>
                <MockText>{props.label}</MockText>       {' '}
        <MockText>{props.value}</MockText>     {' '}
      </MockView>
    )),
  };
});

jest.mock('@/shared/components/common/InlineEditRow/InlineEditRow', () => {
  const {View: MockView, Text: MockText} = require('react-native');
  return {
    InlineEditRow: jest.fn((props: any) => (
      <MockView testID={`mock-inline-edit-${props.label}`} {...props}>
                <MockText>{props.label}</MockText>       {' '}
        <MockText>{props.value}</MockText>       {' '}
        <MockView
          testID={`mock-inline-save-${props.label}`}
          onPress={() => props.onSave('newValue')}
        />
             {' '}
      </MockView>
    )),
  };
});

// Bottom Sheets
const mockCurrencySheetRef = {current: {open: jest.fn(), close: jest.fn()}};
const mockAddressSheetRef = {current: {open: jest.fn(), close: jest.fn()}};
const mockPhoneSheetRef = {current: {open: jest.fn(), close: jest.fn()}};

jest.mock('@/shared/components/common/CurrencyBottomSheet/CurrencyBottomSheet', () => {
  const ReactInside = require('react');
  const {View: MockView} = require('react-native');
  return {
    CurrencyBottomSheet: ReactInside.forwardRef((props: any, ref: any) => {
      ReactInside.useImperativeHandle(ref, () => mockCurrencySheetRef.current);
      return <MockView testID="mock-currency-sheet" {...props} />;
    }),
  };
});

jest.mock('@/shared/components/common/AddressBottomSheet/AddressBottomSheet', () => {
  const ReactInside = require('react');
  const {View: MockView} = require('react-native');
  return {
    AddressBottomSheet: ReactInside.forwardRef((props: any, ref: any) => {
      ReactInside.useImperativeHandle(ref, () => mockAddressSheetRef.current);
      return <MockView testID="mock-address-sheet" {...props} />;
    }),
  };
});

jest.mock(
  '@/shared/components/common/CountryMobileBottomSheet/CountryMobileBottomSheet',
  () => {
    const ReactInside = require('react');
    const {View: MockView} = require('react-native');
    return {
      CountryMobileBottomSheet: ReactInside.forwardRef(
        (props: any, ref: any) => {
          ReactInside.useImperativeHandle(ref, () => mockPhoneSheetRef.current);
          return <MockView testID="mock-phone-sheet" {...props} />;
        },
      ),
    };
  },
);

// Date Picker
// --- UPDATED MOCK ---
// Add 'value' prop and a 'clear' button to test all paths
jest.mock('@/shared/components/common/SimpleDatePicker/SimpleDatePicker', () => {
  const {View: MockView} = require('react-native');
  return {
    SimpleDatePicker: jest.fn(({onDateChange, onDismiss, show, value}: any) =>
      show ? (
        <MockView testID="mock-date-picker" value={value}>
                   {' '}
          <MockView
            testID="mock-date-picker-save"
            onPress={() => onDateChange(new Date('2000-01-01T00:00:00.000Z'))}
          />
                   {' '}
          <MockView
            testID="mock-date-picker-clear"
            onPress={() => onDateChange(null)}
          />
                   {' '}
          <MockView testID="mock-date-picker-dismiss" onPress={onDismiss} />   
             {' '}
        </MockView>
      ) : null,
    ),
    formatDateForDisplay: jest.fn(date => date?.toLocaleDateString('en-US')),
  };
});
// --- END UPDATED MOCK ---

// Image Picker
jest.mock('@/shared/components/common/ProfileImagePicker/ProfileImagePicker', () => {
  const {View: MockView} = require('react-native');
  return {
    ProfileImagePicker: jest.fn((props: any) => (
      <MockView
        testID="mock-image-picker"
        {...props}
        onPress={() => props.onImageSelected('new-uri')}
      />
    )),
  };
});

// User Profile Header
jest.mock('@/features/account/components/UserProfileHeader', () => {
  const {View: MockView, Text: MockText} = require('react-native');
  return {
    UserProfileHeader: jest.fn((props: any) => (
      <MockView testID="mock-user-profile-header">
        <MockText>{props.firstName} {props.lastName}</MockText>
        <MockView
          testID="mock-image-picker"
          {...props}
          onPress={() => props.onImageSelected('new-uri')}
        />
      </MockView>
    )),
  };
});

// Utils
jest.mock('@/shared/utils/formScreenStyles', () => ({
  createFormScreenStyles: jest.fn(() => ({
    container: {},
    content: {},
    centered: {},
    muted: {},
    glassContainer: {},
    glassFallback: {},
    listContainer: {},
  })),
}));

jest.mock('react-native-safe-area-context', () => {
  const {View: MockView} = require('react-native');
  return {
    SafeAreaView: jest.fn(({children}: any) => <MockView>{children}</MockView>),
  };
});

// BackHandler
const mockBackHandlerListeners: any[] = [];
jest.mock('react-native/Libraries/Utilities/BackHandler', () => ({
  __esModule: true,
  default: {
    addEventListener: jest.fn((event: string, cb: any) => {
      mockBackHandlerListeners.push(cb);
      return {
        remove: jest.fn(() => {
          const index = mockBackHandlerListeners.indexOf(cb);
          if (index > -1) mockBackHandlerListeners.splice(index, 1);
        }),
      };
    }),
    removeEventListener: jest.fn(),
    exitApp: jest.fn(),
  },
}));

const fireBackPress = () => {
  let handled = false;
  act(() => {
    for (const listener of mockBackHandlerListeners) {
      if (listener()) {
        handled = true;
        break;
      }
    }
  });
  return handled;
};

// --- Global State ---
let mockState: RootState;

// --- Test Suite ---
describe('EditParentScreen', () => {
  const setupMockState = (user: User | null, isLoading: boolean) => {
    (selectAuthUser as jest.Mock).mockReturnValue(user);
    (selectAuthIsLoading as jest.Mock).mockReturnValue(isLoading);

    mockState = {
      auth: {user, loading: isLoading},
      theme: {theme: 'light', isDark: false},
    } as any;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockBackHandlerListeners.length = 0;
    setupMockState(mockUser, false);

    (updateUserProfile as unknown as jest.Mock).mockClear();
    mockUpdateUserProfileImpl.mockClear();
  });

  const renderComponent = () =>
    render(
      <EditParentScreen navigation={mockNavigation as any} route={{} as any} />,
    );

  // --- NEW TEST BLOCK ---

  // --- END NEW TEST BLOCK ---

  // --- NEW TEST BLOCK ---
  describe('Minimal User Data', () => {
    it('renders empty strings or defaults for a user with minimal data', () => {
      setupMockState(minimalUser, false);
      const {getByTestId} = renderComponent(); // Test ?? ''

      expect(getByTestId('mock-inline-edit-First name').props.value).toBe('');
      expect(getByTestId('mock-inline-edit-Last name').props.value).toBe(''); // Test safeUser.phone ? ... : '' (memo default)
      expect(getByTestId('mock-row-Date of birth').props.value).toBe(''); // Test safeUser.currency ?? 'USD'
      expect(getByTestId('mock-row-Currency').props.value).toBe('USD'); // Test safeUser.address?. ... ?? ''
      expect(getByTestId('mock-row-Address').props.value).toBe('');
      expect(getByTestId('mock-row-State/Province').props.value).toBe('');
      expect(getByTestId('mock-row-City').props.value).toBe('');
      expect(getByTestId('mock-row-Postal Code').props.value).toBe('');
      expect(getByTestId('mock-row-Country').props.value).toBe('');
    });

    it('passes correct default props to bottom sheets for minimal user', () => {
      setupMockState(minimalUser, false);
      const {getByTestId} = renderComponent(); // Test currency sheet prop

      fireEvent.press(getByTestId('mock-row-Currency'));
      expect(getByTestId('mock-currency-sheet').props.selectedCurrency).toBe(
        'USD',
      ); // Test address sheet prop

      fireEvent.press(getByTestId('mock-row-Address'));
      expect(getByTestId('mock-address-sheet').props.selectedAddress).toEqual(
        {},
      ); // Test date picker prop

      fireEvent.press(getByTestId('mock-row-Date of birth'));
      expect(getByTestId('mock-date-picker').props.value).toBeNull();
    });
  });
  // --- END NEW TEST BLOCK ---

  describe('Main Functionality', () => {
    it('navigates back when header back button is pressed and canGoBack is true', () => {
      mockCanGoBack.mockReturnValue(true);
      const {getByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-header'));
      expect(mockCanGoBack).toHaveBeenCalled();
      expect(mockGoBack).toHaveBeenCalledTimes(1);
    });

    it('does not navigate back when header back button is pressed and canGoBack is false', () => {
      mockCanGoBack.mockReturnValue(false);
      const {getByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-header'));
      expect(mockCanGoBack).toHaveBeenCalled();
      expect(mockGoBack).not.toHaveBeenCalled();
    });

    it('renders all user data correctly', () => {
      const {getByTestId} = renderComponent();

      expect(getByTestId('mock-inline-edit-First name').props.value).toBe(
        'Test',
      );
      expect(getByTestId('mock-inline-edit-Last name').props.value).toBe(
        'User',
      );
      expect(getByTestId('mock-row-Phone').props.value).toBe('+1 8005551212');
      expect(getByTestId('mock-row-Email').props.value).toBe(
        'test@example.com',
      );
      expect(getByTestId('mock-row-Date of birth').props.value).toBe(
        new Date(mockUser.dateOfBirth!).toLocaleDateString('en-US'),
      );
      expect(getByTestId('mock-row-Currency').props.value).toBe('USD');
      expect(getByTestId('mock-row-Address').props.value).toBe('123 Main St');
      expect(getByTestId('mock-row-State/Province').props.value).toBe('CA');
      expect(getByTestId('mock-row-City').props.value).toBe('Anytown');
      expect(getByTestId('mock-row-Postal Code').props.value).toBe('12345');
      expect(getByTestId('mock-row-Country').props.value).toBe('United States');
    });

    it('updates first name on save', () => {
      const {getByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-inline-save-First name'));

      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserProfileImpl).toHaveBeenCalledWith({
        firstName: 'newValue',
      });
    });

    it('updates last name on save', () => {
      const {getByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-inline-save-Last name'));

      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserProfileImpl).toHaveBeenCalledWith({
        lastName: 'newValue',
      });
    });

    it('updates profile picture on change', () => {
      const {getByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-image-picker'));

      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserProfileImpl).toHaveBeenCalledWith({
        profilePicture: 'new-uri',
      });
    });

    it('updates profile picture to undefined on null', () => {
      const {getByTestId} = renderComponent();
      const picker = getByTestId('mock-image-picker');

      act(() => {
        picker.props.onImageSelected(null);
      });

      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserProfileImpl).toHaveBeenCalledWith({
        profilePicture: undefined,
      });
    });
  });

  describe('Phone Number Parsing', () => {
    it('parses UK phone number correctly', () => {
      setupMockState({...mockUser, phone: '+442079460000'}, false);
      const {getByTestId} = renderComponent();
      expect(getByTestId('mock-row-Phone').props.value).toBe('+44 2079460000');
    });

    it('handles phone number with no country code (defaults to US)', () => {
      setupMockState({...mockUser, phone: '8005551212'}, false);
      const {getByTestId} = renderComponent();
      expect(getByTestId('mock-row-Phone').props.value).toBe('+1 8005551212');
    });

    it('handles null phone number', () => {
      setupMockState({...mockUser, phone: null as any}, false);
    });

    // --- NEW TEST ---
    it('handles an unknown phone dial code by defaulting to US', () => {
      // This tests the !match path in parsedPhone memo
      setupMockState({...mockUser, phone: '+9991234567890'}, false);
      const {getByTestId} = renderComponent(); // It should parse as +1 (default) and take the last 10 digits
      expect(getByTestId('mock-row-Phone').props.value).toBe('+1 1234567890'); // It should also pass the US country object to the bottom sheet

      fireEvent.press(getByTestId('mock-row-Phone'));
      expect(getByTestId('mock-phone-sheet').props.selectedCountry.code).toBe(
        'US',
      );
    });
    // --- END NEW TEST ---
  });

  describe('Bottom Sheets and Pickers', () => {
    it('opens and saves currency from CurrencyBottomSheet', () => {
      const {getByTestId} = renderComponent();
      const sheet = getByTestId('mock-currency-sheet');

      fireEvent.press(getByTestId('mock-row-Currency'));
      expect(mockCurrencySheetRef.current.open).toHaveBeenCalledTimes(1);

      act(() => {
        sheet.props.onSave('EUR');
      });

      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserProfileImpl).toHaveBeenCalledWith({currency: 'EUR'});
    });

    it('opens and saves address from AddressBottomSheet', () => {
      const {getByTestId} = renderComponent();
      const sheet = getByTestId('mock-address-sheet');
      const newAddress = {city: 'New City'};

      fireEvent.press(getByTestId('mock-row-Address'));
      expect(mockAddressSheetRef.current.open).toHaveBeenCalledTimes(1);

      act(() => {
        sheet.props.onSave(newAddress);
      });

      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserProfileImpl).toHaveBeenCalledWith({
        address: newAddress,
      });
    });

    it('opens address sheet from all address rows', () => {
      const {getByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-row-Address'));
      expect(mockAddressSheetRef.current.open).toHaveBeenCalledTimes(1);
      fireEvent.press(getByTestId('mock-row-State/Province'));
      expect(mockAddressSheetRef.current.open).toHaveBeenCalledTimes(2);
      fireEvent.press(getByTestId('mock-row-City'));
      expect(mockAddressSheetRef.current.open).toHaveBeenCalledTimes(3);
      fireEvent.press(getByTestId('mock-row-Postal Code'));
      expect(mockAddressSheetRef.current.open).toHaveBeenCalledTimes(4);
      fireEvent.press(getByTestId('mock-row-Country'));
      expect(mockAddressSheetRef.current.open).toHaveBeenCalledTimes(5);
    });

    it('opens and saves phone from CountryMobileBottomSheet', () => {
      const {getByTestId} = renderComponent();
      const sheet = getByTestId('mock-phone-sheet');
      const newCountry = {dial_code: '+44'};
      const newPhone = '2079460000';

      fireEvent.press(getByTestId('mock-row-Phone'));
      expect(mockPhoneSheetRef.current.open).toHaveBeenCalledTimes(1);

      act(() => {
        sheet.props.onSave(newCountry, newPhone);
      });

      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserProfileImpl).toHaveBeenCalledWith({
        phone: '+442079460000',
      });
    });

    it('opens and saves date from SimpleDatePicker', () => {
      const {getByTestId, queryByTestId} = renderComponent();

      expect(queryByTestId('mock-date-picker')).toBeNull();
      fireEvent.press(getByTestId('mock-row-Date of birth'));
      expect(queryByTestId('mock-date-picker')).toBeTruthy();

      fireEvent.press(getByTestId('mock-date-picker-save'));

      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserProfileImpl).toHaveBeenCalledWith({
        dateOfBirth: '2000-01-01',
      });
      expect(queryByTestId('mock-date-picker')).toBeNull();
    });

    // --- NEW TEST ---
    it('updates date of birth to undefined when cleared', () => {
      const {getByTestId, queryByTestId} = renderComponent();

      fireEvent.press(getByTestId('mock-row-Date of birth'));
      expect(queryByTestId('mock-date-picker')).toBeTruthy(); // Fire the new "clear" event from our updated mock

      fireEvent.press(getByTestId('mock-date-picker-clear'));

      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
      expect(mockUpdateUserProfileImpl).toHaveBeenCalledWith({
        dateOfBirth: undefined,
      });
      expect(queryByTestId('mock-date-picker')).toBeNull(); // It should close
    });
    // --- END NEW TEST ---

    it('dismisses date picker', () => {
      const {getByTestId, queryByTestId} = renderComponent();

      fireEvent.press(getByTestId('mock-row-Date of birth'));
      expect(queryByTestId('mock-date-picker')).toBeTruthy();

      act(() => {
        fireEvent.press(getByTestId('mock-date-picker-dismiss'));
      });
      expect(queryByTestId('mock-date-picker')).toBeNull();
    });
  });

  describe('Hardware Back Button', () => {
    it('removes back handler on unmount', () => {
      const {unmount} = renderComponent();
      expect(mockBackHandlerListeners.length).toBe(1);
      unmount();
      expect(mockBackHandlerListeners.length).toBe(0);
    });

    it('handles back press when date picker is open', () => {
      const {getByTestId, queryByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-row-Date of birth'));

      const handled = fireBackPress();

      expect(handled).toBe(true);
      expect(queryByTestId('mock-date-picker')).toBeNull();
    });

    it('handles back press when currency sheet is open', () => {
      const {getByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-row-Currency'));

      const handled = fireBackPress();

      expect(handled).toBe(true);
      expect(mockCurrencySheetRef.current.close).toHaveBeenCalledTimes(1);
    });

    it('handles back press when address sheet is open', () => {
      const {getByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-row-Address'));

      const handled = fireBackPress();

      expect(handled).toBe(true);
      expect(mockAddressSheetRef.current.close).toHaveBeenCalledTimes(1);
    });

    it('handles back press when phone sheet is open', () => {
      const {getByTestId} = renderComponent();
      fireEvent.press(getByTestId('mock-row-Phone'));

      const handled = fireBackPress();

      expect(handled).toBe(true);
      expect(mockPhoneSheetRef.current.close).toHaveBeenCalledTimes(1);
    });

    it('does not handle back press when nothing is open', () => {
      renderComponent();
      const handled = fireBackPress();
      expect(handled).toBe(false);
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });
});
