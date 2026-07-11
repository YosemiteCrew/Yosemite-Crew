import React from 'react';
import {Alert} from 'react-native';
import {mockTheme} from '../../../setup/mockTheme';
import {render, fireEvent, act, waitFor} from '@testing-library/react-native';
import Clipboard from '@react-native-clipboard/clipboard';
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

// mockTheme is imported from '../setup/mockTheme' at the top of the file

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
jest.mock('@/hooks', () => {
  const {mockTheme: theme} = require('../../../setup/mockTheme');
  return {
    __esModule: true,
    useTheme: jest.fn(() => ({theme, isDark: false})),
  };
});
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

const mockGetFreshStoredTokens = jest.fn(() => new Promise(() => {}));
const mockIsTokenExpired = jest.fn(() => true);
jest.mock('@/features/auth/sessionManager', () => ({
  __esModule: true,
  getFreshStoredTokens: (...args: any[]) => mockGetFreshStoredTokens(...args),
  isTokenExpired: (...args: any[]) => mockIsTokenExpired(...args),
}));

const mockPreparePhotoPayload = jest.fn();
jest.mock('@/features/account/utils/profilePhoto', () => ({
  preparePhotoPayload: (...args: any[]) => mockPreparePhotoPayload(...args),
}));

const mockRequestParentProfileUploadUrl = jest.fn();
const mockUploadFileToPresignedUrl = jest.fn();
jest.mock('@/shared/services/uploadService', () => ({
  requestParentProfileUploadUrl: (...args: any[]) =>
    mockRequestParentProfileUploadUrl(...args),
  uploadFileToPresignedUrl: (...args: any[]) =>
    mockUploadFileToPresignedUrl(...args),
}));

const mockUpdateParentProfile = jest.fn();
jest.mock('@/features/account/services/profileService', () => ({
  updateParentProfile: (...args: any[]) => mockUpdateParentProfile(...args),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({
  __esModule: true,
  default: {setString: jest.fn()},
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

jest.mock('@/shared/components/common/Separator', () => {
  const {View: MockView} = require('react-native');
  return {
    Separator: jest.fn(() => <MockView testID="mock-separator" />),
  };
});

jest.mock('@/shared/components/common/RowButton', () => {
  const {View: MockView, Text: MockText} = require('react-native');
  return {
    RowButton: jest.fn((props: any) => (
      <MockView
        testID={`mock-row-${props.label}`}
        {...props}
        onPress={props.onPress}>
        <MockText>{props.label}</MockText>
        <MockText>{props.value}</MockText>
      </MockView>
    )),
  };
});

jest.mock('@/shared/components/common/ReadOnlyRow', () => {
  const {View: MockView, Text: MockText} = require('react-native');
  return {
    ReadOnlyRow: jest.fn((props: any) => (
      <MockView testID={`mock-row-${props.label}`} {...props}>
        <MockText>{props.label}</MockText>
        <MockText>{props.value}</MockText>
      </MockView>
    )),
  };
});

jest.mock('@/shared/components/common/InlineEditRow/InlineEditRow', () => {
  const {View: MockView, Text: MockText} = require('react-native');
  return {
    InlineEditRow: jest.fn((props: any) => (
      <MockView testID={`mock-inline-edit-${props.label}`} {...props}>
                <MockText>{props.label}</MockText>
        <MockText>{props.value}</MockText>
        <MockView
          testID={`mock-inline-save-${props.label}`}
          onPress={() => props.onSave('newValue')}
        />
      </MockView>
    )),
  };
});

// Bottom Sheets
const mockCurrencySheetRef = {current: {open: jest.fn(), close: jest.fn()}};
const mockAddressSheetRef = {current: {open: jest.fn(), close: jest.fn()}};
const mockPhoneSheetRef = {current: {open: jest.fn(), close: jest.fn()}};

jest.mock(
  '@/shared/components/common/CurrencyBottomSheet/CurrencyBottomSheet',
  () => {
    const ReactInside = require('react');
    const {View: MockView} = require('react-native');
    return {
      CurrencyBottomSheet: ReactInside.forwardRef((props: any, ref: any) => {
        ReactInside.useImperativeHandle(
          ref,
          () => mockCurrencySheetRef.current,
        );
        return <MockView testID="mock-currency-sheet" {...props} />;
      }),
    };
  },
);

jest.mock(
  '@/shared/components/common/AddressBottomSheet/AddressBottomSheet',
  () => {
    const ReactInside = require('react');
    const {View: MockView} = require('react-native');
    return {
      AddressBottomSheet: ReactInside.forwardRef((props: any, ref: any) => {
        ReactInside.useImperativeHandle(ref, () => mockAddressSheetRef.current);
        return <MockView testID="mock-address-sheet" {...props} />;
      }),
    };
  },
);

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
jest.mock(
  '@/shared/components/common/SimpleDatePicker/SimpleDatePicker',
  () => {
    const {View: MockView} = require('react-native');
    return {
      SimpleDatePicker: jest.fn(
        ({onDateChange, onDismiss, show, value}: any) =>
          show ? (
            <MockView testID="mock-date-picker" value={value}>
              <MockView
                testID="mock-date-picker-save"
                onPress={() =>
                  onDateChange(new Date('2000-01-01T00:00:00.000Z'))
                }
              />
              <MockView
                testID="mock-date-picker-clear"
                onPress={() => onDateChange(null)}
              />
              <MockView testID="mock-date-picker-dismiss" onPress={onDismiss} />
            </MockView>
          ) : null,
      ),
    };
  },
);

jest.mock('@/shared/components/common/SimpleDatePicker/dateTimeFormat', () => ({
  formatDateForDisplay: jest.fn(date => date?.toLocaleDateString('en-US')),
}));
// --- END UPDATED MOCK ---

// Image Picker
jest.mock(
  '@/shared/components/common/ProfileImagePicker/ProfileImagePicker',
  () => {
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
  },
);

// User Profile Header
jest.mock('@/features/account/components/UserProfileHeader', () => {
  const {View: MockView, Text: MockText} = require('react-native');
  return {
    UserProfileHeader: jest.fn((props: any) => (
      <MockView testID="mock-user-profile-header">
        <MockText>
          {props.firstName} {props.lastName}
        </MockText>
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
    useSafeAreaInsets: () => ({top: 0, right: 0, bottom: 0, left: 0}),
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
      const {getByTestId, getByText} = renderComponent();

      expect(getByTestId('mock-inline-edit-First name').props.value).toBe(
        'Test',
      );
      expect(getByTestId('mock-inline-edit-Last name').props.value).toBe(
        'User',
      );
      expect(getByTestId('mock-row-Phone').props.value).toBe('+1 8005551212');
      expect(getByText('Email')).toBeTruthy();
      expect(getByText('test@example.com')).toBeTruthy();
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
      const {getByTestId} = renderComponent(); // It should parse as +1 (default) and take the last 12 digits
      expect(getByTestId('mock-row-Phone').props.value).toBe('+1 991234567890'); // It should also pass the US country object to the bottom sheet

      fireEvent.press(getByTestId('mock-row-Phone'));
      expect(getByTestId('mock-phone-sheet').props.selectedCountry.code).toBe(
        'US',
      );
    });
    // --- END NEW TEST ---

    it('renders an empty local number when the phone has no digits', () => {
      // Drives the `if (normalizedPhoneDigits)` false branch in parsedPhone.
      setupMockState({...mockUser, phone: '+'} as any, false);
      const {getByTestId} = renderComponent();
      expect(getByTestId('mock-row-Phone').props.value).toBe('+1 ');
    });

    it('falls back to the first country when no US entry exists', () => {
      // Drives the `COUNTRIES.find(US) ?? COUNTRIES[0]` fallback in parsedPhone.
      const list = require('@/shared/utils/countryList.json');
      const snapshot = list.map((c: any) => ({...c}));
      list.length = 0;
      list.push({name: 'United Kingdom', dial_code: '+44', code: 'GB'});
      try {
        setupMockState({...mockUser, phone: '5551212'} as any, false);
        const {getByTestId} = renderComponent();
        expect(getByTestId('mock-row-Phone').props.value).toBe('+44 5551212');
      } finally {
        list.length = 0;
        snapshot.forEach((c: any) => list.push(c));
      }
    });
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

  describe('User Not Found', () => {
    it('shows a loader while auth is loading and there is no user', () => {
      setupMockState(null, true);
      const {queryByTestId, queryByText} = renderComponent();
      expect(queryByText('User not found.')).toBeNull();
      // GifLoader renders a mocked FastImage; absence of the text message
      // combined with no crash confirms the loading branch rendered.
      expect(queryByTestId('mock-header')).toBeTruthy();
    });

    it('shows a "User not found" message once loading finishes with no user', () => {
      setupMockState(null, false);
      const {getByText} = renderComponent();
      expect(getByText('User not found.')).toBeTruthy();
    });
  });

  describe('Email Copy', () => {
    beforeEach(() => {
      jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    });

    it('copies the email to the clipboard and shows a confirmation', () => {
      const {UNSAFE_getAllByType} = renderComponent();

      // The copy-icon PressableOpacity is the only real (unmocked)
      // Pressable this screen renders itself; every other row/section is
      // mocked away as a plain View in this test file.
      const {Pressable} = require('react-native');
      const PressableType = (Pressable as any).type;
      const [copyButton] = UNSAFE_getAllByType(PressableType);
      fireEvent.press(copyButton);

      expect(Clipboard.setString).toHaveBeenCalledWith('test@example.com');
      expect(Alert.alert).toHaveBeenCalledWith(
        'Copied',
        'Email Id copied to clipboard',
      );
    });

    it('does nothing when the user has no email to copy', () => {
      setupMockState({...mockUser, email: '  '} as any, false);
      const {UNSAFE_getAllByType} = renderComponent();

      // The copy-icon PressableOpacity is the only real (unmocked)
      // Pressable this screen renders itself; every other row/section is
      // mocked away as a plain View in this test file.
      const {Pressable} = require('react-native');
      const PressableType = (Pressable as any).type;
      const [copyButton] = UNSAFE_getAllByType(PressableType);
      fireEvent.press(copyButton);

      expect(Clipboard.setString).not.toHaveBeenCalled();
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('renders an em dash placeholder when the user has no email', () => {
      setupMockState({...mockUser, email: null} as any, false);
      const {getByText} = renderComponent();
      expect(getByText('—')).toBeTruthy();
    });
  });

  describe('Token Loading', () => {
    it('sets the access token when a fresh, non-expired token is available', async () => {
      mockGetFreshStoredTokens.mockResolvedValueOnce({
        accessToken: 'tok-valid',
        expiresAt: Date.now() + 100000,
      });
      mockIsTokenExpired.mockReturnValueOnce(false);

      const parentUser = {...mockUser, parentId: 'parent-1'};
      setupMockState(parentUser, false);
      mockPreparePhotoPayload.mockResolvedValue({
        remoteUrl: 'https://existing.png',
        localFile: null,
      });
      mockUpdateParentProfile.mockResolvedValue({});

      const {getByTestId} = renderComponent();

      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(mockUpdateParentProfile).toHaveBeenCalledWith(
          expect.any(Object),
          'tok-valid',
        );
      });
    });

    it('discards an expired token', async () => {
      mockGetFreshStoredTokens.mockResolvedValueOnce({
        accessToken: 'tok-expired',
        expiresAt: Date.now() - 100000,
      });
      mockIsTokenExpired.mockReturnValueOnce(true);
      const warnSpy = consoleWarnSpyFn();

      const parentUser = {...mockUser, parentId: 'parent-1'};
      setupMockState(parentUser, false);

      const {getByTestId} = renderComponent();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          '[EditParent] No access token available; skipping remote sync.',
        );
      });
      expect(mockUpdateParentProfile).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('discards a null tokens response', async () => {
      mockGetFreshStoredTokens.mockResolvedValueOnce(null);
      const warnSpy = consoleWarnSpyFn();

      const parentUser = {...mockUser, parentId: 'parent-1'};
      setupMockState(parentUser, false);

      const {getByTestId} = renderComponent();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          '[EditParent] No access token available; skipping remote sync.',
        );
      });
      warnSpy.mockRestore();
    });

    it('warns when loading the stored tokens throws', async () => {
      mockGetFreshStoredTokens.mockRejectedValueOnce(new Error('storage down'));
      const warnSpy = consoleWarnSpyFn();

      renderComponent();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(warnSpy).toHaveBeenCalledWith(
        '[EditParent] Failed to load stored tokens',
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });

    it('treats tokens with no expiry or access token as no token', async () => {
      mockGetFreshStoredTokens.mockResolvedValueOnce({
        accessToken: null,
        expiresAt: null,
      });
      mockIsTokenExpired.mockReturnValueOnce(false);
      const warnSpy = consoleWarnSpyFn();

      const parentUser = {...mockUser, parentId: 'parent-1'};
      setupMockState(parentUser, false);

      const {getByTestId} = renderComponent();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });

      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          '[EditParent] No access token available; skipping remote sync.',
        );
      });
      // expiresAt was null, so the expiry check receives `undefined`, and the
      // null accessToken resolves through the `?? null` fallback.
      expect(mockIsTokenExpired).toHaveBeenCalledWith(undefined);
      expect(mockUpdateParentProfile).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('ignores tokens that resolve after the screen unmounts', async () => {
      let resolveTokens: (value: any) => void = () => {};
      mockGetFreshStoredTokens.mockReturnValueOnce(
        new Promise(resolve => {
          resolveTokens = resolve;
        }),
      );

      const {unmount} = renderComponent();
      unmount();

      await act(async () => {
        resolveTokens({
          accessToken: 'late-token',
          expiresAt: Date.now() + 100000,
        });
        await Promise.resolve();
        await Promise.resolve();
      });

      // Effect cleanup set mounted=false, so the expiry check never runs.
      expect(mockIsTokenExpired).not.toHaveBeenCalled();
    });
  });

  describe('Parent Profile Sync', () => {
    const parentUser = {...mockUser, parentId: 'parent-1'};

    const renderWithFreshToken = async (user = parentUser) => {
      mockGetFreshStoredTokens.mockResolvedValueOnce({
        accessToken: 'tok-1',
        expiresAt: Date.now() + 100000,
      });
      mockIsTokenExpired.mockReturnValueOnce(false);
      setupMockState(user, false);

      const utils = renderComponent();
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      return utils;
    };

    it('warns and skips the sync when the user has no parentId', async () => {
      const warnSpy = consoleWarnSpyFn();
      mockGetFreshStoredTokens.mockResolvedValueOnce({
        accessToken: 'tok-1',
        expiresAt: Date.now() + 100000,
      });
      mockIsTokenExpired.mockReturnValueOnce(false);

      const {getByTestId} = await renderWithFreshToken(mockUser);
      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(warnSpy).toHaveBeenCalledWith(
          '[EditParent] Missing parent identifier; skipping remote sync.',
        );
      });
      expect(mockUpdateParentProfile).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('uploads a new local photo and applies the full remote patch', async () => {
      mockPreparePhotoPayload.mockResolvedValue({
        remoteUrl: null,
        localFile: {path: '/tmp/photo.jpg', mimeType: 'image/jpeg'},
      });
      mockRequestParentProfileUploadUrl.mockResolvedValue({
        url: 'https://upload.example.com',
        key: 'uploaded-key',
      });
      mockUploadFileToPresignedUrl.mockResolvedValue(undefined);
      mockUpdateParentProfile.mockResolvedValue({
        profileImageUrl: 'https://cdn.example.com/pic.png',
        isComplete: true,
        birthDate: '1990-05-15',
        phoneNumber: '+18005551212',
        address: {
          addressLine: 'New Line',
          city: 'New City',
          state: 'New State',
          postalCode: '99999',
          country: 'New Country',
        },
      });

      const {getByTestId} = await renderWithFreshToken();
      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(mockUpdateParentProfile).toHaveBeenCalled();
      });

      expect(mockRequestParentProfileUploadUrl).toHaveBeenCalledWith({
        accessToken: 'tok-1',
        mimeType: 'image/jpeg',
      });
      expect(mockUploadFileToPresignedUrl).toHaveBeenCalledWith({
        filePath: '/tmp/photo.jpg',
        mimeType: 'image/jpeg',
        url: 'https://upload.example.com',
      });

      const [payload] = mockUpdateParentProfile.mock.calls[0];
      expect(payload.profileImageKey).toBe('uploaded-key');
      expect(payload.existingPhotoUrl).toBeNull();
      expect(payload.address).toEqual(
        expect.objectContaining({addressLine: '123 Main St'}),
      );

      // Second dispatch call carries the mapped remote patch.
      await waitFor(() => {
        expect(mockUpdateUserProfileImpl).toHaveBeenLastCalledWith(
          expect.objectContaining({
            profileToken: 'https://cdn.example.com/pic.png',
            profilePicture: 'https://cdn.example.com/pic.png',
            profileCompleted: true,
            dateOfBirth: '1990-05-15',
            phone: '+18005551212',
            address: {
              addressLine: 'New Line',
              city: 'New City',
              stateProvince: 'New State',
              postalCode: '99999',
              country: 'New Country',
            },
          }),
        );
      });
    });

    it('reuses the existing remote photo url without uploading', async () => {
      mockPreparePhotoPayload.mockResolvedValue({
        remoteUrl: 'https://existing.example.com/pic.png',
        localFile: null,
      });
      mockUpdateParentProfile.mockResolvedValue({});

      const {getByTestId} = await renderWithFreshToken();
      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(mockUpdateParentProfile).toHaveBeenCalled();
      });

      expect(mockRequestParentProfileUploadUrl).not.toHaveBeenCalled();
      expect(mockUploadFileToPresignedUrl).not.toHaveBeenCalled();

      const [payload] = mockUpdateParentProfile.mock.calls[0];
      expect(payload.profileImageKey).toBeNull();
      expect(payload.existingPhotoUrl).toBe(
        'https://existing.example.com/pic.png',
      );
    });

    it('omits the address from the payload when the user has no address fields', async () => {
      mockPreparePhotoPayload.mockResolvedValue({
        remoteUrl: null,
        localFile: null,
      });
      mockUpdateParentProfile.mockResolvedValue({});

      const userWithoutAddress = {
        ...parentUser,
        address: {
          addressLine: undefined,
          city: undefined,
          stateProvince: undefined,
          postalCode: undefined,
          country: undefined,
        },
      } as any;

      const {getByTestId} = await renderWithFreshToken(userWithoutAddress);
      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(mockUpdateParentProfile).toHaveBeenCalled();
      });

      const [payload] = mockUpdateParentProfile.mock.calls[0];
      expect(payload.address).toBeUndefined();
    });

    it('does not dispatch a second update when the summary has no updatable fields', async () => {
      mockPreparePhotoPayload.mockResolvedValue({
        remoteUrl: null,
        localFile: null,
      });
      mockUpdateParentProfile.mockResolvedValue({});

      const {getByTestId} = await renderWithFreshToken();
      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(mockUpdateParentProfile).toHaveBeenCalled();
      });

      // Only the initial local-patch dispatch happened; no remote patch.
      expect(mockAppDispatch).toHaveBeenCalledTimes(1);
    });

    it('logs an error when the remote sync request fails', async () => {
      mockPreparePhotoPayload.mockResolvedValue({
        remoteUrl: null,
        localFile: null,
      });
      mockUpdateParentProfile.mockRejectedValue(new Error('server exploded'));
      const errorSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const {getByTestId} = await renderWithFreshToken();
      fireEvent.press(getByTestId('mock-inline-save-First name'));

      await waitFor(() => {
        expect(errorSpy).toHaveBeenCalledWith(
          '[EditParent] Failed to sync parent profile',
          expect.any(Error),
        );
      });
      errorSpy.mockRestore();
    });

    it('defaults null profile fields when building the sync payload', async () => {
      mockPreparePhotoPayload.mockResolvedValue({
        remoteUrl: null,
        localFile: null,
      });
      mockUpdateParentProfile.mockResolvedValue({});

      const nullFieldsUser = {
        ...parentUser,
        firstName: null,
        phone: null,
        dateOfBirth: null,
        profilePicture: null,
        profileToken: null,
      } as any;

      // Save the last name so firstName stays null in the synced snapshot.
      const {getByTestId} = await renderWithFreshToken(nullFieldsUser);
      fireEvent.press(getByTestId('mock-inline-save-Last name'));

      await waitFor(() => {
        expect(mockUpdateParentProfile).toHaveBeenCalled();
      });

      expect(mockPreparePhotoPayload).toHaveBeenCalledWith(
        expect.objectContaining({imageUri: null}),
      );

      const [payload] = mockUpdateParentProfile.mock.calls[0];
      expect(payload.firstName).toBe('');
      expect(payload.phoneNumber).toBe('');
      expect(payload.dateOfBirth).toBeNull();
    });
  });
});

function consoleWarnSpyFn() {
  return jest.spyOn(console, 'warn').mockImplementation(() => {});
}
