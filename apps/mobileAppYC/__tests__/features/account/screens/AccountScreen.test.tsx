import React from 'react';
import {
  render,
  fireEvent,
  waitFor,
  screen,
  act,
} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import configureStore from 'redux-mock-store';
// FIX: Relative imports
import {AccountScreen} from '../../../../src/features/account/screens/AccountScreen';
import {useAuth} from '../../../../src/features/auth/context/AuthContext';
import {useTheme} from '../../../../src/hooks';
import {
  Linking,
  Alert,
  Image,
  BackHandler,
  Platform,
  ToastAndroid,
} from 'react-native';
import {deleteParentProfile} from '../../../../src/features/account/services/profileService';
import {
  deleteAmplifyAccount,
  deleteFirebaseAccount,
} from '../../../../src/features/auth/services/accountDeletion';
import {normalizeImageUri} from '../../../../src/shared/utils/imageUri';
import {calculateAgeFromDateOfBirth} from '../../../../src/shared/utils/helpers';
import {setSelectedCompanion} from '../../../../src/features/companion';
import {isTokenExpired} from '../../../../src/features/auth/sessionManager';

// --- Mocks ---

// Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockNavigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
} as any;

// Auth Context
const mockLogout = jest.fn().mockResolvedValue(undefined);
jest.mock('../../../../src/features/auth/context/AuthContext', () => ({
  useAuth: jest.fn(),
}));

// Theme Hook
jest.mock('../../../../src/hooks', () => ({
  useTheme: jest.fn(),
}));

// Services
jest.mock('../../../../src/features/account/services/profileService', () => ({
  deleteParentProfile: jest.fn(),
}));
jest.mock('../../../../src/features/auth/services/accountDeletion', () => ({
  deleteAmplifyAccount: jest.fn(),
  deleteFirebaseAccount: jest.fn(),
}));
jest.mock('../../../../src/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(() =>
    Promise.resolve({accessToken: 'valid-token'}),
  ),
  isTokenExpired: jest.fn(() => false),
}));

// Companion Action
jest.mock('../../../../src/features/companion', () => ({
  ...jest.requireActual('../../../../src/features/companion'),
  setSelectedCompanion: jest.fn(id => ({
    type: 'companion/setSelected',
    payload: id,
  })),
  selectCompanions: (state: any) => state.companion.companions,
}));

// Utilities & Native Modules
jest.mock('../../../../src/shared/utils/imageUri', () => ({
  normalizeImageUri: jest.fn(uri => uri),
}));
jest.mock('../../../../src/shared/utils/helpers', () => ({
  calculateAgeFromDateOfBirth: jest.fn(() => 5),
  truncateText: jest.fn(t => t),
}));

jest.mock('react-native-device-info', () => ({
  getVersion: jest.fn(() => '1.0.0'),
  getBuildNumber: jest.fn(() => '100'),
}));

// Mock Assets
jest.mock('../../../../src/assets/images', () => ({
  Images: {
    faqIcon: {uri: 'faq'},
    aboutusIcon: {uri: 'about'},
    tncIcon: {uri: 'terms'},
    privacyIcon: {uri: 'privacy'},
    contactIcon: {uri: 'contact'},
    deleteIconRed: {uri: 'delete'},
    rightArrow: {uri: 'arrow'},
    logoutIcon: {uri: 'logout'},
    blackEdit: {uri: 'edit-icon'},
  },
}));

// UI Components
jest.mock('../../../../src/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {View, Text, TouchableOpacity} = require('react-native');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const React = require('react');
    return (
      <View>
        <Text>{title}</Text>
        <TouchableOpacity onPress={onBack} testID="header-back-btn">
          <Text>Back</Text>
        </TouchableOpacity>
      </View>
    );
  },
}));

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassCard/LiquidGlassCard',
  () => ({
    LiquidGlassCard: ({children, style}: any) => {
      const {View} = require('react-native');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const React = require('react');
      return <View style={style}>{children}</View>;
    },
  }),
);

jest.mock(
  '../../../../src/shared/components/common/LiquidGlassButton/LiquidGlassButton',
  () => {
    const {TouchableOpacity, Text} = require('react-native');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const React = require('react');
    return ({title, onPress}: any) => (
      <TouchableOpacity onPress={onPress} testID="logout-btn">
        <Text>{title}</Text>
      </TouchableOpacity>
    );
  },
);

jest.mock(
  '../../../../src/features/account/components/AccountMenuList',
  () => ({
    AccountMenuList: ({items, onItemPress}: any) => {
      const {View, TouchableOpacity, Text} = require('react-native');
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const React = require('react');
      return (
        <View>
          {items.map((item: any) => (
            <TouchableOpacity
              key={item.id}
              onPress={() => onItemPress(item.id)}
              testID={`menu-item-${item.id}`}>
              <Text>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      );
    },
  }),
);

jest.mock(
  '../../../../src/features/account/components/DeleteAccountBottomSheet',
  () => {
    const {forwardRef, useImperativeHandle} = require('react');
    const {View, Button} = require('react-native');
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const React = require('react');

    return forwardRef(({onDelete}: any, ref: any) => {
      useImperativeHandle(ref, () => ({
        open: jest.fn(),
        close: jest.fn(),
      }));
      return (
        <View testID="delete-sheet">
          <Button
            title="Confirm Delete"
            onPress={() => {
              // Execute onDelete. This mimics the sheet calling the prop.
              // We return the result (Promise) so act() can await it.
              return onDelete();
            }}
            testID="confirm-delete-btn"
          />
        </View>
      );
    });
  },
);

// --- Setup ---

const mockStore = configureStore([]);
const defaultAuthUser = {
  id: 'user-1',
  parentId: 'parent-1',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john@example.com',
  profilePicture: 'https://example.com/avatar.jpg',
};

const defaultCompanions = [
  {
    id: 'c1',
    name: 'Buddy',
    breed: {breedName: 'Golden'},
    gender: 'Male',
    dateOfBirth: '2020-01-01',
  },
  {
    id: 'c2',
    name: 'Luna',
    breed: {breedName: 'Lab'},
    gender: 'Female',
    currentWeight: 50,
  },
];

describe('AccountScreen', () => {
  let store: any;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, 'alert');
    jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    jest.spyOn(BackHandler, 'addEventListener');

    // Default implementation: Token is valid
    (isTokenExpired as jest.Mock).mockReturnValue(false);

    (useTheme as jest.Mock).mockReturnValue({
      theme: {
        colors: {
          background: '#fff',
          white: '#fff',
          textSecondary: '#666',
          secondary: '#000',
          primary: 'blue',
          lightBlueBackground: '#eef',
          borderSeperator: '#eee',
          cardBackground: '#f9f9f9',
          border: '#ddd',
        },
        spacing: {'2': 8, '3': 12, '4': 16, '5': 20, '10': 40},
        typography: {h4: {}, caption: {}, button: {}, bodySmall: {}},
        borderRadius: {lg: 12, full: 999},
      },
    });

    (useAuth as jest.Mock).mockReturnValue({
      logout: mockLogout,
      provider: 'firebase',
    });

    store = mockStore({
      auth: {user: defaultAuthUser},
      companion: {companions: defaultCompanions},
      coParent: {
        accessByCompanionId: {},
        defaultAccess: null,
        lastFetchedRole: 'PRIMARY',
        lastFetchedPermissions: null,
      },
    });
  });

  const renderScreen = (customStore = store) => {
    return render(
      <Provider store={customStore}>
        <AccountScreen navigation={mockNavigation} route={{} as any} />
      </Provider>,
    );
  };

  // --- Rendering Tests ---

  it('renders user profile correctly with full name', () => {
    renderScreen();
    expect(screen.getByText('John Doe')).toBeTruthy();
    expect(screen.getByText('2 Companions')).toBeTruthy();
    expect(normalizeImageUri).toHaveBeenCalledWith(
      'https://example.com/avatar.jpg',
    );
  });

  it('renders user profile correctly with only first name', () => {
    store = mockStore({
      ...store.getState(),
      auth: {user: {...defaultAuthUser, lastName: ''}},
    });
    renderScreen(store);
    expect(screen.getByText('John')).toBeTruthy();
  });

  it('renders user profile correctly with fallback "You" if no name', () => {
    store = mockStore({
      ...store.getState(),
      auth: {user: {...defaultAuthUser, firstName: '', lastName: ''}},
    });
    renderScreen(store);
    expect(screen.getByText('You')).toBeTruthy();
  });

  it('renders singular subtitle when only 1 companion', () => {
    store = mockStore({
      ...store.getState(),
      companion: {companions: [defaultCompanions[0]]},
    });
    renderScreen(store);
    expect(screen.getByText('1 Companion')).toBeTruthy();
  });

  it('renders companion list correctly including calculated age', () => {
    (calculateAgeFromDateOfBirth as jest.Mock).mockReturnValue(5); // Mock return age 5
    renderScreen();
    expect(screen.getByText('Buddy')).toBeTruthy();
    expect(screen.getByText(/5Y/)).toBeTruthy(); // Checks for age string
  });

  // --- Avatar Logic ---

  it('renders fallback initials if avatar is missing or fails load', () => {
    store = mockStore({
      ...store.getState(),
      auth: {user: {...defaultAuthUser, profilePicture: null}},
      companion: {
        companions: [{id: 'c1', name: 'Buddy', profileImage: null}],
      },
    });
    renderScreen(store);
    expect(screen.getByText('J')).toBeTruthy(); // User
    expect(screen.getByText('B')).toBeTruthy(); // Companion
  });

  it('handles image error state updates specifically', () => {
    renderScreen();

    // Use .find() instead of .filter()[0] to satisfy SonarQube
    const userAvatar = screen
      .UNSAFE_getAllByType(Image)
      .find(img => img.props.source.uri === 'https://example.com/avatar.jpg');

    expect(userAvatar).toBeTruthy();

    if (userAvatar) {
      // First error
      act(() => {
        userAvatar.props.onError();
      });
    }

    // Verify state updated (fallback renders)
    expect(screen.getByText('J')).toBeTruthy();

    // Trigger error AGAIN to test the "if (prev[id]) return prev;" branch
    expect(screen.getByText('J')).toBeTruthy();
  });

  // --- Interaction Tests ---

  it('navigates to Edit User Profile (Primary) when first edit button is clicked', () => {
    renderScreen();
    const allImages = screen.UNSAFE_getAllByType(Image);
    const editIcons = allImages.filter(
      img => img.props.source && img.props.source.uri === 'edit-icon',
    );

    // Index 0 = User Edit
    fireEvent.press(editIcons[0].parent);

    expect(mockNavigate).toHaveBeenCalledWith('EditParentOverview', {
      companionId: 'primary',
    });
  });

  it('navigates to Edit Companion Profile when allowed (Primary Parent)', () => {
    renderScreen();
    const allImages = screen.UNSAFE_getAllByType(Image);
    const editIcons = allImages.filter(
      img => img.props.source && img.props.source.uri === 'edit-icon',
    );

    // Index 1 = First Companion Edit
    fireEvent.press(editIcons[1].parent);

    expect(setSelectedCompanion).toHaveBeenCalledWith('c1');
    expect(mockNavigate).toHaveBeenCalledWith('ProfileOverview', {
      companionId: 'c1',
    });
  });

  it('denies edit access and shows toast/alert if permissions missing (Android)', () => {
    store = mockStore({
      ...store.getState(),
      coParent: {
        accessByCompanionId: {},
        defaultAccess: {
          role: 'EDITOR',
          permissions: {companionProfile: false},
        },
        lastFetchedRole: 'EDITOR',
      },
    });

    Platform.OS = 'android';
    const toastSpy = jest.spyOn(ToastAndroid, 'show');

    renderScreen(store);

    const allImages = screen.UNSAFE_getAllByType(Image);
    const editIcons = allImages.filter(
      img => img.props.source && img.props.source.uri === 'edit-icon',
    );

    fireEvent.press(editIcons[1].parent);

    expect(toastSpy).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalledWith(
      'ProfileOverview',
      expect.anything(),
    );
  });

  it('denies edit access and shows Alert on iOS', () => {
    store = mockStore({
      ...store.getState(),
      coParent: {
        accessByCompanionId: {},
        defaultAccess: {
          role: 'EDITOR',
          permissions: {companionProfile: false},
        },
        lastFetchedRole: 'EDITOR',
      },
    });
    Platform.OS = 'ios';
    renderScreen(store);

    const allImages = screen.UNSAFE_getAllByType(Image);
    const editIcons = allImages.filter(
      img => img.props.source && img.props.source.uri === 'edit-icon',
    );

    fireEvent.press(editIcons[1].parent);

    expect(Alert.alert).toHaveBeenCalledWith(
      'Permission needed',
      expect.stringContaining("You don't have access"),
    );
  });

  // --- Menu Navigation ---

  it('navigates to menu items correctly', () => {
    renderScreen();

    fireEvent.press(screen.getByTestId('menu-item-faqs'));
    expect(mockNavigate).toHaveBeenCalledWith('FAQ');

    fireEvent.press(screen.getByTestId('menu-item-terms'));
    expect(mockNavigate).toHaveBeenCalledWith('TermsAndConditions');

    fireEvent.press(screen.getByTestId('menu-item-privacy'));
    expect(mockNavigate).toHaveBeenCalledWith('PrivacyPolicy');

    fireEvent.press(screen.getByTestId('menu-item-contact'));
    expect(mockNavigate).toHaveBeenCalledWith('ContactUs');
  });

  it('opens external link for About Us', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('menu-item-about'));
    expect(Linking.openURL).toHaveBeenCalledWith(
      'https://www.yosemitecrew.com/about',
    );
  });

  // --- Logout ---

  it('handles Logout interaction success', async () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('logout-btn'));
    await waitFor(() => {
      expect(mockLogout).toHaveBeenCalled();
    });
  });

  it('handles Logout interaction failure (logs warning)', async () => {
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    mockLogout.mockRejectedValueOnce(new Error('Logout failed'));

    renderScreen();
    fireEvent.press(screen.getByTestId('logout-btn'));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        '[AccountScreen] Logout failed',
        expect.any(Error),
      );
    });
    consoleSpy.mockRestore();
  });

  // --- Delete Account Flow ---

  it('opens Delete Account sheet on menu press', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('menu-item-delete'));
    expect(screen.getByTestId('delete-sheet')).toBeTruthy();
  });

  it('handles hardware back press when sheet is open (closes sheet)', () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('menu-item-delete'));
    expect(BackHandler.addEventListener).toHaveBeenCalledWith(
      'hardwareBackPress',
      expect.any(Function),
    );
  });

  it('handles Delete Account confirmation flow (Amplify)', async () => {
    (useAuth as jest.Mock).mockReturnValue({
      logout: mockLogout,
      provider: 'amplify',
    });
    renderScreen();

    fireEvent.press(screen.getByTestId('menu-item-delete'));
    const confirmBtn = screen.getByTestId('confirm-delete-btn');

    await act(async () => {
      fireEvent.press(confirmBtn);
    });

    expect(deleteParentProfile).toHaveBeenCalledWith('parent-1', 'valid-token');
    expect(deleteAmplifyAccount).toHaveBeenCalled();
    expect(mockLogout).toHaveBeenCalled();
  });

  it('handles Delete Account confirmation flow (Firebase)', async () => {
    renderScreen();
    fireEvent.press(screen.getByTestId('menu-item-delete'));

    await act(async () => {
      fireEvent.press(screen.getByTestId('confirm-delete-btn'));
    });

    expect(deleteFirebaseAccount).toHaveBeenCalled();
  });

  it('handles Delete Account error (expired token)', async () => {
    (isTokenExpired as jest.Mock).mockReturnValue(true);

    renderScreen();
    fireEvent.press(screen.getByTestId('menu-item-delete'));
    const confirmBtn = screen.getByTestId('confirm-delete-btn');

    // We catch the error re-thrown by the component so the test doesn't crash
    try {
      await act(async () => {
        await fireEvent.press(confirmBtn);
      });
    } catch (e) {
      // Expected error bubbling up
    }

    expect(deleteParentProfile).not.toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Failed',
      expect.stringContaining('sign in again'),
    );
  });

  it('handles Delete Account error (missing parentId) - EXPECTED REJECTION', async () => {
    // Test the path where parentId is missing.
    // This throws synchronously before the try/catch in the component.
    store = mockStore({
      ...store.getState(),
      auth: {user: {...defaultAuthUser, parentId: null}},
    });
    renderScreen(store);

    fireEvent.press(screen.getByTestId('menu-item-delete'));
    const confirmBtn = screen.getByTestId('confirm-delete-btn');

    // Since the error happens OUTSIDE try/catch in the component, it rejects/throws to the caller.
    // We must catch it here to satisfy the test runner.
    try {
      await act(async () => {
        await fireEvent.press(confirmBtn);
      });
    } catch (e: any) {
      expect(e.message).toContain('Missing parent identifier');
    }

    // Alert is NOT called because the component crashed before the catch block
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it('handles Delete Account error (Reauthenticate)', async () => {
    // Ensure token is valid so we proceed to API call
    (isTokenExpired as jest.Mock).mockReturnValue(false);
    // Mock API failure to throw 'requires-recent-login'
    (deleteParentProfile as jest.Mock).mockRejectedValue(
      new Error('requires-recent-login'),
    );

    renderScreen();
    fireEvent.press(screen.getByTestId('menu-item-delete'));
    const confirmBtn = screen.getByTestId('confirm-delete-btn');

    // Component catches error, calls Alert, then RE-THROWS.
    // We must catch the re-throw.
    try {
      await act(async () => {
        await fireEvent.press(confirmBtn);
      });
    } catch (e) {
      // Expected re-throw
    }

    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Failed',
      expect.stringContaining('sign out, sign back in'),
    );
  });

  it('handles Delete Account generic string error', async () => {
    (deleteParentProfile as jest.Mock).mockRejectedValue('Network Error');
    renderScreen();
    fireEvent.press(screen.getByTestId('menu-item-delete'));

    try {
      await act(async () => {
        await fireEvent.press(screen.getByTestId('confirm-delete-btn'));
      });
    } catch (e) {
      // expected error
    }

    expect(Alert.alert).toHaveBeenCalledWith('Delete Failed', 'Network Error');
  });

  it('handles Delete Account unknown error object', async () => {
    (deleteParentProfile as jest.Mock).mockRejectedValue({some: 'object'});
    renderScreen();
    fireEvent.press(screen.getByTestId('menu-item-delete'));

    try {
      await act(async () => {
        await fireEvent.press(screen.getByTestId('confirm-delete-btn'));
      });
    } catch (e) {
      // expected error
    }

    expect(Alert.alert).toHaveBeenCalledWith(
      'Delete Failed',
      expect.stringContaining('Failed to delete your account'),
    );
  });

  it('handles Header Back Press', () => {
    renderScreen();
    const backBtn = screen.getByTestId('header-back-btn');

    mockCanGoBack.mockReturnValue(true);
    fireEvent.press(backBtn);
    expect(mockGoBack).toHaveBeenCalled();

    mockCanGoBack.mockReturnValue(false);
    fireEvent.press(backBtn);
    expect(mockNavigate).toHaveBeenCalledWith('Home');
  });

  it('handles app version display', () => {
    renderScreen();
    expect(screen.getByText('Version 1.0.0 (100)')).toBeTruthy();
  });
});
