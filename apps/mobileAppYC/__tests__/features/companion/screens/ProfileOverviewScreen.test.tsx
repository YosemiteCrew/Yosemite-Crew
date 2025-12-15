import React from 'react';
import {render, fireEvent, act} from '@testing-library/react-native';
import {ProfileOverviewScreen} from '@/features/companion/screens/ProfileOverviewScreen';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {
  Alert,
  BackHandler,
  ToastAndroid,
  Platform,
} from 'react-native';

// --- Imports to be mocked ---
import {
  updateCompanionProfile,
  deleteCompanion,
} from '@/features/companion/thunks';
import {setSelectedCompanion} from '@/features/companion';

// --- 1. Global Navigation Mocks ---
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockDispatchNav = jest.fn();
const mockGetParent = jest.fn();

const navigationMock: any = {
  navigate: mockNavigate,
  goBack: mockGoBack,
  canGoBack: mockCanGoBack,
  dispatch: mockDispatchNav,
  getParent: mockGetParent,
  getState: jest.fn(() => undefined),
};

const routeMock: any = {
  params: {companionId: 'comp-123'},
};

// --- 2. Setup Jest Mocks (Inside Factory Requires to prevent ReferenceError) ---

// Mock SafeAreaContext
jest.mock('react-native-safe-area-context', () => {
  const RN = require('react-native');
  return {
    SafeAreaView: ({children}: any) => <RN.View>{children}</RN.View>,
    useSafeAreaInsets: () => ({top: 0, bottom: 0, left: 0, right: 0}),
  };
});

// Mock Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: 'blue',
        textSecondary: 'gray',
        cardBackground: 'white',
        borderMuted: 'gray',
        borderSeperator: 'lightgray',
        secondary: 'black',
      },
      spacing: {1: 4, 2: 8, 3: 12, 5: 20, 10: 40},
      borderRadius: {lg: 8},
      typography: {body: {}, paragraphBold: {}},
      shadows: {md: {}},
    },
  }),
}));

jest.mock('@/features/auth/context/AuthContext', () => ({
  useAuth: jest.fn(() => ({user: {parentId: 'parent-123'}})),
}));

// Mock React Navigation
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useFocusEffect: (cb: Function) => cb(),
    CommonActions: {
      reset: jest.fn(payload => ({type: 'RESET', payload})),
    },
  };
});

// Mock Thunks
jest.mock('@/features/companion/thunks', () => {
  const mockUpdate = jest.fn();
  const mockDelete = jest.fn();
  // @ts-ignore
  mockDelete.fulfilled = {match: jest.fn()};
  return {
    updateCompanionProfile: mockUpdate,
    deleteCompanion: mockDelete,
  };
});

// Mock Slice Actions
jest.mock('@/features/companion', () => {
  const actual = jest.requireActual('@/features/companion');
  return {
    ...actual,
    setSelectedCompanion: jest.fn(() => ({
      type: 'companion/setSelectedCompanion',
    })),
  };
});

// Mock Child Components
jest.mock('@/shared/components/common/Header/Header', () => {
  const RN = require('react-native');
  return {
    Header: (props: any) => <RN.View testID="Header" {...props} />,
  };
});

jest.mock('@/features/companion/components/CompanionProfileHeader', () => {
  const RN = require('react-native');
  return {
    CompanionProfileHeader: (props: any) => (
      <RN.View testID="CompanionProfileHeader" {...props} />
    ),
  };
});

jest.mock(
  '@/shared/components/common/DeleteProfileBottomSheet/DeleteProfileBottomSheet',
  () => {
    // eslint-disable-next-line @typescript-eslint/no-shadow
    const React = require('react');
    const RN = require('react-native');

    const MockSheet = React.forwardRef(
      ({onDelete, onCancel}: any, ref: any) => {
        React.useImperativeHandle(ref, () => ({
          open: jest.fn(),
          close: jest.fn(),
        }));
        return (
          <RN.View
            testID="DeleteSheet"
            onDelete={onDelete}
            onCancel={onCancel}
          />
        );
      },
    );

    return {
      __esModule: true,
      default: MockSheet,
    };
  },
);

jest.mock('@/shared/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const RN = require('react-native');
  return {
    LiquidGlassCard: ({children}: any) => <RN.View>{children}</RN.View>,
  };
});

jest.mock('@/assets/images', () => ({
  Images: {
    deleteIconRed: 'delete-icon',
    rightArrow: 'arrow-icon',
  },
}));

describe('ProfileOverviewScreen', () => {
  let store: any;
  const initialState = {
    companion: {
      companions: [
        {
          id: 'comp-123',
          name: 'Buddy',
          breed: {breedName: 'Golden Retriever'},
          profileImage: 'some-url',
        },
      ],
      loading: false,
    },
    coParent: {
      accessByCompanionId: {
        'comp-123': {
          role: 'PRIMARY_OWNER',
          permissions: {
            documents: true,
            expenses: true,
            tasks: true,
            appointments: true,
          },
        },
      },
      lastFetchedRole: 'PRIMARY_OWNER',
      defaultAccess: null,
      loading: false,
      error: null,
    },
  };

  const setup = (customState = initialState) => {
    store = configureStore({
      reducer: {
        companion: (state = customState.companion) => state,
        coParent: (state = customState.coParent) => state,
      },
    });

    return render(
      <Provider store={store}>
        <ProfileOverviewScreen navigation={navigationMock} route={routeMock} />
      </Provider>,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetParent.mockReturnValue(null);
    Platform.OS = 'ios';

    (updateCompanionProfile as unknown as jest.Mock).mockReturnValue({
      unwrap: jest.fn().mockResolvedValue(true),
      type: 'update/fulfilled',
    });

    (deleteCompanion as unknown as jest.Mock).mockReturnValue({
      type: 'delete/fulfilled',
      payload: 'id',
    });
    (deleteCompanion as any).fulfilled.match.mockReturnValue(true);
  });

  it('renders empty state when companion not found', () => {
    const emptyState = {
      ...initialState,
      companion: {...initialState.companion, companions: []},
    };
    const {getByText} = setup(emptyState);
    expect(getByText('Companion not found.')).toBeTruthy();
  });

  it('renders correctly with companion data', () => {
    const {getByText, getByTestId, getAllByText} = setup();
    expect(getByText('Overview')).toBeTruthy();
    // Use getAllByText as "Complete" appears in multiple status badges
    expect(getAllByText('Complete').length).toBeGreaterThan(0);
    expect(getByTestId('CompanionProfileHeader')).toBeTruthy();
    expect(setSelectedCompanion).toHaveBeenCalledWith('comp-123');
  });

  it('resets the Tasks tab stack on focus via useFocusEffect', () => {
    mockGetParent.mockReturnValue({
      getState: () => ({
        routes: [
          {
            name: 'Tasks',
            state: {
              key: 'tasks-stack-key',
              routes: [{name: 'SomeDeepScreen'}],
            },
          },
        ],
      }),
      dispatch: mockDispatchNav,
    });

    setup();

    expect(mockDispatchNav).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'RESET',
        target: 'tasks-stack-key',
        payload: {
          index: 0,
          routes: [{name: 'TasksMain'}],
        },
      }),
    );
  });

  // --- 2. Header Actions ---
  it('handles back button press from header', () => {
    mockCanGoBack.mockReturnValue(true);
    const {getByTestId} = setup();
    const header = getByTestId('Header');

    act(() => {
      header.props.onBack();
    });

    expect(mockGoBack).toHaveBeenCalled();
  });

  it('does not go back if canGoBack is false', () => {
    mockCanGoBack.mockReturnValue(false);
    const {getByTestId} = setup();
    const header = getByTestId('Header');

    act(() => {
      header.props.onBack();
    });

    expect(mockGoBack).not.toHaveBeenCalled();
  });

  // --- 3. Section Navigation & Permissions ---
  it('navigates to EditCompanionOverview', () => {
    const {getByText} = setup();
    fireEvent.press(getByText('Overview'));
    expect(mockNavigate).toHaveBeenCalledWith('EditCompanionOverview', {
      companionId: 'comp-123',
    });
  });

  it('navigates to EditParentOverview', () => {
    const {getByText} = setup();
    fireEvent.press(getByText('Parent'));
    expect(mockNavigate).toHaveBeenCalledWith('EditParentOverview', {
      companionId: 'comp-123',
    });
  });

  it('navigates to CoParents screen', () => {
    const {getByText} = setup();
    fireEvent.press(getByText('Co-Parent (Optional)'));
    expect(mockNavigate).toHaveBeenCalledWith('CoParents');
  });

  it('navigates to Tasks (Health) if permission allowed', () => {
    const {getByText} = setup();
    mockGetParent.mockReturnValue(navigationMock);
    fireEvent.press(getByText('Health tasks'));

    expect(mockNavigate).toHaveBeenCalledWith('Tasks', {
      screen: 'TasksList',
      params: {category: 'health'},
    });
  });

  // --- 4. Permissions Logic ---
  it('allows access even if permissions undefined if role is PRIMARY', () => {
    const primaryState = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        accessByCompanionId: {
          'comp-123': {role: 'PRIMARY_OWNER', permissions: null},
        },
      },
    };
    const {getByText} = setup(primaryState);
    mockGetParent.mockReturnValue(navigationMock);

    fireEvent.press(getByText('Expense'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'ExpensesStack',
      expect.anything(),
    );
  });

  it('shows Alert on iOS when permission is missing', () => {
    Platform.OS = 'ios';
    const spyAlert = jest.spyOn(Alert, 'alert');

    const restrictedState = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        accessByCompanionId: {
          'comp-123': {
            role: 'CO_PARENT',
            permissions: {expenses: false},
          },
        },
      },
    };
    const {getByText} = setup(restrictedState);
    fireEvent.press(getByText('Expense'));

    expect(mockNavigate).not.toHaveBeenCalledWith(
      'ExpensesStack',
      expect.anything(),
    );
    expect(spyAlert).toHaveBeenCalledWith(
      'Permission needed',
      expect.stringContaining("don't have access"),
    );
  });

  it('shows Toast on Android when permission is missing', () => {
    Platform.OS = 'android';
    const spyToast = jest.spyOn(ToastAndroid, 'show');

    const restrictedState = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        accessByCompanionId: {
          'comp-123': {
            role: 'CO_PARENT',
            permissions: {tasks: false},
          },
        },
      },
    };
    const {getByText} = setup(restrictedState);
    fireEvent.press(getByText('Hygiene tasks'));

    expect(spyToast).toHaveBeenCalledWith(
      expect.stringContaining("don't have access"),
      ToastAndroid.SHORT,
    );
  });

  it('falls back to default access if companion specific access is missing', () => {
    const defaultAccessState = {
      ...initialState,
      coParent: {
        accessByCompanionId: {},
        defaultAccess: {role: 'VIEWER', permissions: {documents: true}},
      },
    };

    const {getByText} = setup(defaultAccessState);
    mockGetParent.mockReturnValue(navigationMock);

    fireEvent.press(getByText('Documents'));
    expect(mockGetParent).toHaveBeenCalled();
  });

  it('allows access if no access object exists (fallback)', () => {
    const noAccessState = {
      ...initialState,
      coParent: {accessByCompanionId: {}, defaultAccess: null},
    };
    const {getByText} = setup(noAccessState);
    mockGetParent.mockReturnValue(navigationMock);
    fireEvent.press(getByText('Dietary plan tasks'));
    expect(mockNavigate).toHaveBeenCalled();
  });

  // --- 5. Profile Image Update ---
  it('updates profile image successfully', async () => {
    const {getByTestId} = setup();
    const header = getByTestId('CompanionProfileHeader');

    await act(async () => {
      await header.props.onImageSelected('new-image-uri');
    });

    expect(updateCompanionProfile).toHaveBeenCalledWith({
      parentId: 'parent-123',
      updatedCompanion: expect.objectContaining({
        profileImage: 'new-image-uri',
        id: 'comp-123',
      }),
    });
  });

  it('shows error if update thunk fails', async () => {
    (updateCompanionProfile as unknown as jest.Mock).mockReturnValue({
      unwrap: () => Promise.reject('Network Error'),
    });
    const spyAlert = jest.spyOn(Alert, 'alert');
    const {getByTestId} = setup();
    const header = getByTestId('CompanionProfileHeader');

    await act(async () => {
      await header.props.onImageSelected('uri');
    });

    expect(spyAlert).toHaveBeenCalledWith(
      'Image Update Failed',
      expect.any(String),
      expect.any(Array),
    );
  });

  // --- 6. Delete Flow ---
  it('opens delete sheet on right icon press', () => {
    const {getByTestId} = setup();
    const header = getByTestId('Header');

    act(() => {
      header.props.onRightPress();
    });
    const sheet = getByTestId('DeleteSheet');
    expect(sheet).toBeDefined();
  });

  it('deletes companion successfully', async () => {
    const {getByTestId} = setup();
    const sheet = getByTestId('DeleteSheet');

    await act(async () => {
      await sheet.props.onDelete();
    });

    expect(deleteCompanion).toHaveBeenCalledWith({
      parentId: 'parent-123',
      companionId: 'comp-123',
    });
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('handles failed delete logic (action rejected)', async () => {
    (deleteCompanion as any).fulfilled.match.mockReturnValue(false);
    const spyAlert = jest.spyOn(Alert, 'alert');
    const {getByTestId} = setup();
    const sheet = getByTestId('DeleteSheet');

    await act(async () => {
      await sheet.props.onDelete();
    });

    expect(spyAlert).toHaveBeenCalledWith(
      'Delete Failed',
      expect.stringContaining('Failed to delete'),
      expect.any(Array),
    );
  });

  it('handles exception during delete', async () => {
    (deleteCompanion as unknown as jest.Mock).mockImplementation(() => {
      throw new Error('Boom');
    });
    const spyAlert = jest.spyOn(Alert, 'alert');
    const {getByTestId} = setup();
    const sheet = getByTestId('DeleteSheet');

    await act(async () => {
      await sheet.props.onDelete();
    });

    // Expect 3 arguments (Title, Message, Buttons Array)
    expect(spyAlert).toHaveBeenCalledWith(
      'Delete Failed',
      expect.stringContaining('An error occurred'),
      expect.any(Array),
    );
  });

  // --- 7. BackHandler (Android) ---
  it('handles hardware back press logic verification', () => {
    const addSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation(_ => {
        return {remove: jest.fn()} as any;
      });

    const {getByTestId} = setup();
    const header = getByTestId('Header');

    act(() => {
      header.props.onRightPress();
    });

    const lastCall = addSpy.mock.calls[addSpy.mock.calls.length - 1];
    const cb = lastCall[1];

    expect(cb()).toBe(true);
  });

  // --- 8. Coverage for all Menu Items ---
  it('handles boarder navigation correctly', () => {
    const {getByText} = setup();
    fireEvent.press(getByText('Boarder'));

    expect(mockNavigate).toHaveBeenCalledWith('LinkedBusinesses', {
      screen: 'BusinessSearch',
      params: expect.objectContaining({
        category: 'boarder',
        companionId: 'comp-123',
      }),
    });
  });

  it('handles custom tasks navigation', () => {
    const {getByText} = setup();
    mockGetParent.mockReturnValue(navigationMock);
    fireEvent.press(getByText('Custom tasks'));
    expect(mockNavigate).toHaveBeenCalledWith(
      'Tasks',
      expect.objectContaining({params: {category: 'custom'}}),
    );
  });
});
