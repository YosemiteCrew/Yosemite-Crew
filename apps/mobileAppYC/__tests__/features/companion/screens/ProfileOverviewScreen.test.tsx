import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, fireEvent, act} from '@testing-library/react-native';
import {ProfileOverviewScreen} from '@/features/companion/screens/ProfileOverviewScreen';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {Alert, BackHandler, ToastAndroid, Platform} from 'react-native';

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
  useTheme: () => ({theme: mockTheme, isDark: false}),
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

    const MockSheet = ({onDelete, onCancel, ref}: any) => {
      React.useImperativeHandle(ref, () => ({
        open: jest.fn(),
        close: jest.fn(),
      }));
      return (
        <RN.View testID="DeleteSheet" onDelete={onDelete} onCancel={onCancel} />
      );
    };

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
    auth: {
      user: {
        parentId: 'parent-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        phone: '1234567890',
        dateOfBirth: '1990-01-01',
        currency: 'USD',
        address: {
          addressLine: '123 Main St',
          city: 'New York',
          stateProvince: 'NY',
          postalCode: '10001',
          country: 'USA',
        },
      },
      status: 'authenticated',
    },
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
    documents: {
      documents: [],
    },
    businesses: {
      businesses: [],
    },
    tasks: {
      items: [],
    },
    expenses: {
      companionExpenses: {},
      hasHydratedCompanion: {},
      summaries: {},
    },
    coParent: {
      coParents: [],
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
    linkedBusinesses: {
      linkedBusinesses: [],
      loading: false,
      error: null,
    },
  };

  const setup = (customState = initialState) => {
    store = configureStore({
      reducer: {
        auth: (state = customState.auth) => state,
        companion: (state = customState.companion) => state,
        documents: (state = customState.documents) => state,
        businesses: (state = customState.businesses) => state,
        tasks: (state = customState.tasks) => state,
        expenses: (state = customState.expenses) => state,
        coParent: (state = customState.coParent) => state,
        linkedBusinesses: (state = customState.linkedBusinesses) => state,
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
    const {getByText, getByTestId} = setup();
    expect(getByText('Overview')).toBeTruthy();
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
    fireEvent.press(getByText('Co-parents'));
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

    fireEvent.press(getByText('Expenses'));
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
    fireEvent.press(getByText('Expenses'));

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
        coParents: [],
        accessByCompanionId: {},
        defaultAccess: {role: 'VIEWER', permissions: {documents: true}},
        lastFetchedRole: null,
        loading: false,
        error: null,
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
      coParent: {
        coParents: [],
        accessByCompanionId: {},
        defaultAccess: null,
        lastFetchedRole: null,
        loading: false,
        error: null,
      },
    };
    const {getByText} = setup(noAccessState);
    mockGetParent.mockReturnValue(navigationMock);
    fireEvent.press(getByText('Dietary plans'));
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

  it('renders stacked co-parent avatars on the Co-parents tile', () => {
    const coParentState = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        coParents: [
          {
            id: 'cp-1',
            email: 'friend@example.com',
            firstName: 'Friend',
            lastName: 'Smith',
          },
        ],
      },
    };
    const {getByText} = setup(coParentState);
    // The warm-bone profile hub shows co-parent initials (no completion badge).
    expect(getByText('FS')).toBeTruthy();
  });

  it('throws and shows an alert when parentId is missing during profile image update', async () => {
    const {useAuth} = require('@/features/auth/context/AuthContext');
    (useAuth as jest.Mock).mockReturnValueOnce({user: {parentId: undefined}});

    const spyAlert = jest.spyOn(Alert, 'alert');
    const {getByTestId} = setup();
    const header = getByTestId('CompanionProfileHeader');

    await act(async () => {
      await header.props.onImageSelected('new-image-uri');
    });

    expect(spyAlert).toHaveBeenCalledWith(
      'Image Update Failed',
      expect.any(String),
      expect.any(Array),
    );
    expect(updateCompanionProfile).not.toHaveBeenCalled();
  });

  it('blocks Documents when the documents permission is denied', () => {
    const restrictedState = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        accessByCompanionId: {
          'comp-123': {role: 'CO_PARENT', permissions: {documents: false}},
        },
      },
    };
    const spyAlert = jest.spyOn(Alert, 'alert');
    const {getByText} = setup(restrictedState);
    // setSelectedCompanion also fires unconditionally on mount, so clear it
    // to isolate the effect of pressing Documents specifically.
    (setSelectedCompanion as unknown as jest.Mock).mockClear();

    fireEvent.press(getByText('Documents'));

    expect(setSelectedCompanion).not.toHaveBeenCalled();
    expect(spyAlert).toHaveBeenCalledWith(
      'Permission needed',
      expect.stringContaining("don't have access"),
    );
  });

  it('blocks a linked-business section when the appointments permission is denied', () => {
    const restrictedState = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        accessByCompanionId: {
          'comp-123': {role: 'CO_PARENT', permissions: {appointments: false}},
        },
      },
    };
    const spyAlert = jest.spyOn(Alert, 'alert');
    const {getByText} = setup(restrictedState);

    fireEvent.press(getByText('Boarder'));

    expect(mockNavigate).not.toHaveBeenCalledWith(
      'LinkedBusinesses',
      expect.anything(),
    );
    expect(spyAlert).toHaveBeenCalledWith(
      'Permission needed',
      expect.stringContaining("don't have access"),
    );
  });

  it('blocks Health tasks when the tasks permission is denied', () => {
    const restrictedState = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        accessByCompanionId: {
          'comp-123': {role: 'CO_PARENT', permissions: {tasks: false}},
        },
      },
    };
    const {getByText} = setup(restrictedState);

    fireEvent.press(getByText('Health tasks'));

    expect(mockNavigate).not.toHaveBeenCalledWith(
      'Tasks',
      expect.objectContaining({params: {category: 'health'}}),
    );
  });

  it('navigates to Hygiene tasks when the tasks permission is granted', () => {
    const {getByText} = setup();
    mockGetParent.mockReturnValue(navigationMock);
    fireEvent.press(getByText('Hygiene tasks'));

    expect(mockNavigate).toHaveBeenCalledWith(
      'Tasks',
      expect.objectContaining({params: {category: 'hygiene'}}),
    );
  });

  it('blocks Dietary plan tasks when the tasks permission is denied', () => {
    const restrictedState = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        accessByCompanionId: {
          'comp-123': {role: 'CO_PARENT', permissions: {tasks: false}},
        },
      },
    };
    const {getByText} = setup(restrictedState);

    fireEvent.press(getByText('Dietary plans'));

    expect(mockNavigate).not.toHaveBeenCalledWith(
      'Tasks',
      expect.objectContaining({params: {category: 'dietary'}}),
    );
  });

  it('blocks Custom tasks when the tasks permission is denied', () => {
    const restrictedState = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        accessByCompanionId: {
          'comp-123': {role: 'CO_PARENT', permissions: {tasks: false}},
        },
      },
    };
    const {getByText} = setup(restrictedState);

    fireEvent.press(getByText('Custom tasks'));

    expect(mockNavigate).not.toHaveBeenCalledWith(
      'Tasks',
      expect.objectContaining({params: {category: 'custom'}}),
    );
  });

  it('BackHandler returns false when the delete sheet is not open', () => {
    const addSpy = jest
      .spyOn(BackHandler, 'addEventListener')
      .mockImplementation(_ => {
        return {remove: jest.fn()} as any;
      });

    setup();

    const lastCall = addSpy.mock.calls[addSpy.mock.calls.length - 1];
    const cb = lastCall[1];

    expect(cb()).toBe(false);
  });

  it('closes the delete sheet without deleting when cancelled', () => {
    const {getByTestId} = setup();
    const header = getByTestId('Header');
    act(() => {
      header.props.onRightPress();
    });
    const sheet = getByTestId('DeleteSheet');

    act(() => {
      sheet.props.onCancel();
    });

    expect(deleteCompanion).not.toHaveBeenCalled();
  });

  // --- 9. Remaining warm-bone branch coverage ---
  it('navigates to Hospital linked business and tolerates a nameless/imageless companion', () => {
    const sparseState = {
      ...initialState,
      companion: {
        ...initialState.companion,
        companions: [
          {
            id: 'comp-123',
            name: '',
            breed: {breedName: 'Golden Retriever'},
            profileImage: null,
          },
        ],
      },
    };
    const {getByText, getByTestId} = setup(sparseState);

    // profileImage `?? undefined` falls back to undefined when the image is null
    expect(
      getByTestId('CompanionProfileHeader').props.profileImage,
    ).toBeUndefined();

    fireEvent.press(getByText('Hospital'));

    // companionName `|| ''` falls back to an empty string when the name is falsy
    expect(mockNavigate).toHaveBeenCalledWith('LinkedBusinesses', {
      screen: 'BusinessSearch',
      params: expect.objectContaining({
        category: 'hospital',
        companionName: '',
      }),
    });
  });

  it('navigates to Breeder linked business', () => {
    const {getByText} = setup();
    fireEvent.press(getByText('Breeder'));

    expect(mockNavigate).toHaveBeenCalledWith('LinkedBusinesses', {
      screen: 'BusinessSearch',
      params: expect.objectContaining({
        category: 'breeder',
        companionId: 'comp-123',
      }),
    });
  });

  it('navigates to Groomer linked business', () => {
    const {getByText} = setup();
    fireEvent.press(getByText('Groomer'));

    expect(mockNavigate).toHaveBeenCalledWith('LinkedBusinesses', {
      screen: 'BusinessSearch',
      params: expect.objectContaining({
        category: 'groomer',
        companionId: 'comp-123',
      }),
    });
  });

  it('clears the profile image when null is selected', async () => {
    const {getByTestId} = setup();
    const header = getByTestId('CompanionProfileHeader');

    await act(async () => {
      await header.props.onImageSelected(null);
    });

    expect(updateCompanionProfile).toHaveBeenCalledWith({
      parentId: 'parent-123',
      updatedCompanion: expect.objectContaining({profileImage: null}),
    });
  });

  it('shows the loader in the empty state while companions are loading', () => {
    const loadingState = {
      ...initialState,
      companion: {companions: [], loading: true},
    };
    const {queryByText, getByTestId} = setup(loadingState);

    // isLoading true -> the loader branch renders, not the "not found" text
    expect(queryByText('Companion not found.')).toBeNull();
    expect(getByTestId('Header')).toBeTruthy();
  });

  it('renders co-parent avatars with fallback initials and alternating styles', () => {
    const sparseCoParents = {
      ...initialState,
      coParent: {
        ...initialState.coParent,
        // first entry is null (fully defensive fallbacks), second has only an email
        coParents: [null, {email: 'zoe@example.com'}],
      },
    };
    const {getByText} = setup(sparseCoParents);

    // null co-parent -> no name and no email -> '?'
    expect(getByText('?')).toBeTruthy();
    // email-only co-parent -> initials from the email's first char
    expect(getByText('Z')).toBeTruthy();
  });

  it('handles a co-parent slice that has no coParents array', () => {
    const missingCoParentsList = {
      ...initialState,
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
        defaultAccess: null,
        lastFetchedRole: 'PRIMARY_OWNER',
      },
    };
    const {getByText} = setup(missingCoParentsList);
    // selectCoParents returns undefined -> `(coParents ?? [])` falls back to []
    expect(getByText('Co-parents')).toBeTruthy();
  });

  it('renders when the co-parent slice is absent from the store', () => {
    const localStore = configureStore({
      reducer: {
        auth: (state = initialState.auth) => state,
        companion: (state = initialState.companion) => state,
        documents: (state = initialState.documents) => state,
        businesses: (state = initialState.businesses) => state,
        tasks: (state = initialState.tasks) => state,
        expenses: (state = initialState.expenses) => state,
        linkedBusinesses: (state = initialState.linkedBusinesses) => state,
        // intentionally omit the coParent reducer so state.coParent is undefined
      },
    });

    const {getByText} = render(
      <Provider store={localStore}>
        <ProfileOverviewScreen navigation={navigationMock} route={routeMock} />
      </Provider>,
    );

    // `state.coParent?.accessByCompanionId ?? {}` resolves via the nullish fallback
    expect(getByText('Overview')).toBeTruthy();
  });

  it('skips side effects when the resolved companion has a falsy id', async () => {
    const undefinedIdState = {
      ...initialState,
      companion: {
        ...initialState.companion,
        companions: [
          {
            id: undefined,
            name: 'Buddy',
            breed: {breedName: 'Golden Retriever'},
            profileImage: 'some-url',
          },
        ],
      },
    };
    const localStore = configureStore({
      reducer: {
        auth: (state = undefinedIdState.auth) => state,
        companion: (state = undefinedIdState.companion) => state,
        documents: (state = undefinedIdState.documents) => state,
        businesses: (state = undefinedIdState.businesses) => state,
        tasks: (state = undefinedIdState.tasks) => state,
        expenses: (state = undefinedIdState.expenses) => state,
        coParent: (state = undefinedIdState.coParent) => state,
        linkedBusinesses: (state = undefinedIdState.linkedBusinesses) => state,
      },
    });
    // route with no companionId -> matches the companion whose id is undefined
    const undefinedRoute: any = {params: {companionId: undefined}};

    const {getByTestId} = render(
      <Provider store={localStore}>
        <ProfileOverviewScreen
          navigation={navigationMock}
          route={undefinedRoute}
        />
      </Provider>,
    );

    // 221: the `if (companionId)` effect is skipped when companionId is falsy
    expect(setSelectedCompanion).not.toHaveBeenCalled();

    // 260: handleProfileImageChange returns early because companion.id is falsy
    const header = getByTestId('CompanionProfileHeader');
    await act(async () => {
      await header.props.onImageSelected('new-image-uri');
    });
    expect(updateCompanionProfile).not.toHaveBeenCalled();

    // 423: handleDeleteProfile returns early because companion.id is falsy
    const sheet = getByTestId('DeleteSheet');
    await act(async () => {
      await sheet.props.onDelete();
    });
    expect(deleteCompanion).not.toHaveBeenCalled();
  });

  it('skips deleting when parentId is missing', async () => {
    const {useAuth} = require('@/features/auth/context/AuthContext');
    (useAuth as jest.Mock).mockReturnValueOnce({user: {parentId: undefined}});

    const {getByTestId} = setup();
    const sheet = getByTestId('DeleteSheet');

    await act(async () => {
      await sheet.props.onDelete();
    });

    // 423: `!parentId` short-circuits the delete before dispatching
    expect(deleteCompanion).not.toHaveBeenCalled();
  });
});
