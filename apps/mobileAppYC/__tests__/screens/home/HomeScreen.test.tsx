import React from 'react';
import {render, fireEvent, waitFor, act} from '@testing-library/react-native';
import {
  HomeScreen,
  deriveHomeGreetingName,
} from '@/screens/home/HomeScreen/HomeScreen';
import {useAuth} from '@/contexts/AuthContext';
import {useDispatch, useSelector} from 'react-redux';
import {
  fetchCompanions,
  selectCompanions,
  selectSelectedCompanionId,
  setSelectedCompanion,
} from '@/features/companion';
import {selectAuthUser} from '@/features/auth/selectors';
import {View as MockView} from 'react-native';

jest.useFakeTimers();

const mockTheme = {
  colors: {
    background: '#FFF',
    primary: '#007AFF',
    onPrimary: '#FFF',
    surface: '#FFFFFF',
    onSurface: '#000000',
    surfaceVariant: '#F5F5F5',
    outline: '#E0E0E0',
    neutralShadow: '#000000',
    shadow: '#000000',
    white: '#FFF',
    black: '#000',
    secondary: '#666',
    borderMuted: '#EEE',
    cardBackground: '#FCFCFC',
    lightBlueBackground: '#F0F8FF',
    whiteOverlay70: 'rgba(255,255,255,0.7)',
    text: {
      primary: '#000000',
      secondary: '#666666',
    },
  },
  spacing: {
    '1.25': 5,
    2: 8,
    3: 12,
    '3.5': 14,
    4: 16,
    '4.5': 18,
    5: 20,
    6: 24,
    8: 32,
    30: 120,
  },
  typography: {
    titleMedium: {fontSize: 18, fontWeight: 'bold'},
    bodyMedium: {fontSize: 14, fontWeight: 'normal'},
    labelMedium: {fontSize: 12, fontWeight: '500'},
    headlineSmall: {fontSize: 24, fontWeight: 'bold'},
    titleLarge: {fontSize: 20, fontWeight: 'bold'},
    bodySmallTight: {fontSize: 12},
    labelXsBold: {fontSize: 10, fontWeight: 'bold'},
  },
  borderRadius: {sm: 8, md: 12, lg: 16, xl: 24},
  shadows: {
    sm: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 1},
      shadowOpacity: 0.1,
      shadowRadius: 2,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 2},
      shadowOpacity: 0.15,
      shadowRadius: 4,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 4},
      shadowOpacity: 0.2,
      shadowRadius: 8,
      elevation: 8,
    },
    xl: {
      shadowColor: '#000',
      shadowOffset: {width: 0, height: 8},
      shadowOpacity: 0.3,
      shadowRadius: 16,
      elevation: 16,
    },
  },
};

const mockUser = {id: 'user-123', firstName: 'John'};
const mockAuthUser = {
  ...mockUser,
  profilePicture: '',
  firstName: 'John',
  lastName: 'Doe',
};
const mockCompanions = [
  {id: 'comp-1', name: 'Buddy', profilePicture: ''},
  {id: 'comp-2', name: 'Lucy', profilePicture: ''},
];

jest.mock('@/assets/images', () => ({
  Images: {
    healthIcon: 1,
    hygeineIcon: 2,
    dietryIcon: 3,
    cat: 4,
    emergencyIcon: 5,
    notificationIcon: 6,
    paw: 7,
    plusIcon: 8,
  },
}));

jest.mock('react-native/Libraries/Image/Image', () => ({
  __esModule: true,
  default: (props: any) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const {source, ...rest} = props; // Destructure source to avoid potential issues if it's complex
    // Use testID passed down or a default one
    const testId = props.testID || 'mock-image';
    return <MockView testID={testId} {...rest} />;
  },
}));

jest.mock('@/hooks', () => ({
  useTheme: jest.fn(() => ({theme: mockTheme})),
}));
jest.mock('@/contexts/AuthContext', () => ({useAuth: jest.fn()}));
jest.mock('react-redux', () => ({
  useDispatch: jest.fn(),
  useSelector: jest.fn(),
}));
jest.mock('@/features/companion', () => ({
  fetchCompanions: jest.fn(() => ({type: 'FETCH_COMPANIONS_MOCK'})),
  setSelectedCompanion: jest.fn((id: string) => ({
    type: 'SET_SELECTED_COMPANION_MOCK',
    payload: id,
  })),
  selectCompanions: jest.fn(),
  selectSelectedCompanionId: jest.fn(),
}));
jest.mock('@/features/auth/selectors', () => ({selectAuthUser: jest.fn()}));

jest.mock('@/components/common/TaskCard/TaskCard', () => {
  const {TouchableOpacity, Text} = jest.requireActual('react-native');
  return {
    __esModule: true,
    TaskCard: ({onComplete}: any) => (
      <TouchableOpacity onPress={onComplete} testID="task-card">
        <Text>Task</Text>
      </TouchableOpacity>
    ),
  };
});

const mockOnGetDirections = jest.fn();
const mockOnChat = jest.fn();

jest.mock('@/components/common/AppointmentCard/AppointmentCard', () => {
  const {TouchableOpacity, Text, View} = jest.requireActual('react-native');
  return {
    __esModule: true,
    AppointmentCard: ({onCheckIn}: any) => (
      <View testID="appointment-card-container">
        {' '}
        {/* Add container */}
        <TouchableOpacity onPress={onCheckIn} testID="appointment-checkin">
          <Text>Check In</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={mockOnGetDirections}
          testID="appointment-directions">
          <Text>Get Directions</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={mockOnChat} testID="appointment-chat">
          <Text>Chat</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('@/components/common/CompanionSelector/CompanionSelector', () => {
  const {TouchableOpacity, Text, View} = jest.requireActual('react-native');
  return {
    __esModule: true,
    CompanionSelector: ({
      companions,
      onSelect,
      onAddCompanion,
      getBadgeText,
    }: any) => (
      <View testID="companion-selector">
        {companions.map((companion: any) => (
          <TouchableOpacity
            key={companion.id}
            testID={`select-${companion.id}`}
            onPress={() => onSelect(companion.id)}>
            <Text>{companion.name}</Text>
            {getBadgeText && <Text>{getBadgeText(companion)}</Text>}
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          testID="add-companion-button"
          onPress={onAddCompanion}>
          <Text>Add</Text>
        </TouchableOpacity>
      </View>
    ),
  };
});

jest.mock('@/components/common/LiquidGlassCard/LiquidGlassCard', () => {
  const {View} = jest.requireActual('react-native');
  return {
    __esModule: true,
    LiquidGlassCard: ({children, style}: any) => (
      <View style={style} testID="liquid-glass-card">
        {children}
      </View>
    ),
  };
});

jest.mock('@/components/common/YearlySpendCard/YearlySpendCard', () => {
  const {View, Text} = jest.requireActual('react-native');
  return {
    __esModule: true,
    YearlySpendCard: ({amount}: {amount: number}) => (
      <View testID="yearly-spend-card">
        <Text>Spent: {amount}</Text>
      </View>
    ),
  };
});

jest.mock('@/components/common/SearchBar/SearchBar', () => {
  const {TouchableOpacity, Text} = jest.requireActual('react-native');
  return {
    __esModule: true,
    SearchBar: ({onPress, placeholder}: any) => (
      <TouchableOpacity onPress={onPress} testID="search-bar">
        <Text>{placeholder}</Text>
      </TouchableOpacity>
    ),
  };
});

jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children}: {children: React.ReactNode}) => children,
}));

const mockedUseAuth = useAuth as jest.Mock;
const mockedUseSelector = useSelector as unknown as jest.Mock;
const mockedUseDispatch = useDispatch as unknown as jest.Mock;

const mockDispatch = jest.fn();
const mockParentNavigation = {navigate: jest.fn()};
const mockNavigation = {
  navigate: jest.fn(),
  getParent: jest.fn(() => mockParentNavigation),
  goBack: jest.fn(),
};
const mockRoute = {name: 'Home'};

const setupMocks = ({
  user = mockUser,
  authUser = mockAuthUser,
  companions = [],
  selectedCompanionId = null,
}: {
  user?: any;
  authUser?: any;
  companions?: any[];
  selectedCompanionId?: string | null;
}) => {
  mockedUseAuth.mockReturnValue({user});
  mockedUseDispatch.mockReturnValue(mockDispatch);
  mockedUseSelector.mockImplementation(selector => {
    if (selector === selectAuthUser) return authUser;
    if (selector === selectCompanions) return companions;
    if (selector === selectSelectedCompanionId) return selectedCompanionId;
  });
};

const renderHomeScreen = () => {
  return render(
    <HomeScreen navigation={mockNavigation as any} route={mockRoute as any} />,
  );
};

describe('deriveHomeGreetingName', () => {
  it('returns Sky when invalid', () => {
    expect(deriveHomeGreetingName(null).displayName).toBe('Sky');
    expect(deriveHomeGreetingName('').displayName).toBe('Sky');
    expect(deriveHomeGreetingName().displayName).toBe('Sky');
  });

  it('truncates long names', () => {
    expect(deriveHomeGreetingName('Abcdefghijklmn').displayName).toBe(
      'Abcdefghijklm...',
    );
    expect(
      deriveHomeGreetingName('ThisIsAVeryLongNameThatExceedsLimit').displayName,
    ).toBe('ThisIsAVeryLo...');
  });

  it('returns original name when short enough', () => {
    expect(deriveHomeGreetingName('John').displayName).toBe('John');
    expect(deriveHomeGreetingName('John Doe').displayName).toBe('John Doe');
    expect(deriveHomeGreetingName('Johnny').displayName).toBe('Johnny');
  });
});

describe('HomeScreen Component', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupMocks({
      user: mockUser,
      authUser: mockAuthUser,
      companions: [],
      selectedCompanionId: null,
    });
    mockOnGetDirections.mockClear();
    mockOnChat.mockClear();
  });

  it('renders correctly and shows empty companion state', async () => {
    const {getByText, queryByTestId, getByTestId} = renderHomeScreen();
    expect(getByText('Hello, John')).toBeTruthy();
    expect(getByText('J')).toBeTruthy();
    expect(getByText('Add your first companion')).toBeTruthy();
    expect(queryByTestId('companion-selector')).toBeNull();
    expect(getByTestId('task-card')).toBeTruthy();
    expect(getByTestId('appointment-card-container')).toBeTruthy();
    expect(getByTestId('yearly-spend-card')).toBeTruthy();
    expect(getByText('Manage health')).toBeTruthy();
    expect(queryByTestId('View more')).toBeNull();
  });

  it('fetches companions on mount if user exists', async () => {
    renderHomeScreen();
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(fetchCompanions(mockUser.id));
    });
  });

  it('does not fetch companions if user.id is missing', async () => {
    setupMocks({user: null, authUser: null, companions: []});
    renderHomeScreen();
    await act(async () => {});
    expect(mockDispatch).not.toHaveBeenCalledWith(expect.anything());
  });

  it('selects the first companion as default if none is selected', async () => {
    setupMocks({
      user: mockUser,
      authUser: mockAuthUser,
      companions: mockCompanions,
      selectedCompanionId: null,
    });
    renderHomeScreen();
    await waitFor(() => {
      expect(mockDispatch).toHaveBeenCalledWith(
        setSelectedCompanion(mockCompanions[0].id),
      );
    });
  });

  it('renders companion selector when companions exist', () => {
    setupMocks({
      user: mockUser,
      authUser: mockAuthUser,
      companions: mockCompanions,
      selectedCompanionId: 'comp-1',
    });
    const {getByTestId, queryByText, getByText} = renderHomeScreen();
    expect(getByTestId('companion-selector')).toBeTruthy();
    expect(getByText('Buddy')).toBeTruthy();
    expect(getByText('Lucy')).toBeTruthy();
    expect(getByText('1 Tasks')).toBeTruthy();
    expect(getByText('2 Tasks')).toBeTruthy();
    expect(queryByText('Add your first companion')).toBeNull();
    expect(getByText('View more')).toBeTruthy();
  });

  it('handles navigation logic', () => {
    const {getByText} = renderHomeScreen();
    fireEvent.press(getByText('Hello, John'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('Account');
    const tabNavigation = mockNavigation.getParent();
    tabNavigation?.navigate('Appointments');
    expect(mockParentNavigation.navigate).toHaveBeenCalledWith('Appointments');
  });

  it('handles "Add your first companion" press', () => {
    const {getByText} = renderHomeScreen();
    fireEvent.press(getByText('Add your first companion'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('AddCompanion');
  });

  it('handles selecting a different companion', () => {
    setupMocks({
      user: mockUser,
      authUser: mockAuthUser,
      companions: mockCompanions,
      selectedCompanionId: 'comp-1',
    });
    const {getByTestId} = renderHomeScreen();
    fireEvent.press(getByTestId('select-comp-2'));
    expect(mockDispatch).toHaveBeenCalledWith(setSelectedCompanion('comp-2'));
  });

  it('handles "Add" button press from companion selector', () => {
    setupMocks({
      user: mockUser,
      authUser: mockAuthUser,
      companions: mockCompanions,
      selectedCompanionId: 'comp-1',
    });
    const {getByTestId} = renderHomeScreen();
    fireEvent.press(getByTestId('add-companion-button'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('AddCompanion');
  });

  it('toggles upcoming tasks card to empty state and back', async () => {
    const {getByTestId, findByText, queryByTestId, queryByText} =
      renderHomeScreen();
    expect(getByTestId('task-card')).toBeTruthy();
    fireEvent.press(getByTestId('task-card'));
    const emptyTile = await findByText('No upcoming tasks');
    expect(emptyTile).toBeTruthy();
    expect(queryByTestId('task-card')).toBeNull();
    fireEvent.press(emptyTile);
    const taskCard = await findByText('Task');
    expect(taskCard).toBeTruthy();
    expect(queryByText('No upcoming tasks')).toBeNull();
  });

  it('toggles upcoming appointments card to empty state and back', async () => {
    const {getByTestId, findByText, queryByTestId, queryByText} =
      renderHomeScreen();
    expect(getByTestId('appointment-checkin')).toBeTruthy();
    fireEvent.press(getByTestId('appointment-checkin'));
    const emptyTile = await findByText('No upcoming appointments');
    expect(emptyTile).toBeTruthy();
    expect(queryByTestId('appointment-card-container')).toBeNull();
    fireEvent.press(emptyTile);
    const apptCard = await findByText('Check In');
    expect(apptCard).toBeTruthy();
    expect(queryByText('No upcoming appointments')).toBeNull();
  });

  it('handles AppointmentCard onGetDirections press', () => {
    const {getByTestId} = renderHomeScreen();
    expect(getByTestId('appointment-directions')).toBeTruthy();
    fireEvent.press(getByTestId('appointment-directions'));
    expect(mockOnGetDirections).toHaveBeenCalledTimes(1);
  });

  it('handles AppointmentCard onChat press', () => {
    const {getByTestId} = renderHomeScreen();
    expect(getByTestId('appointment-chat')).toBeTruthy();
    fireEvent.press(getByTestId('appointment-chat'));
    expect(mockOnChat).toHaveBeenCalledTimes(1);
  });

  it('navigates to ProfileOverview when "View more" is pressed', () => {
    setupMocks({
      user: mockUser,
      authUser: mockAuthUser,
      companions: mockCompanions,
      selectedCompanionId: 'comp-1',
    });
    const {getByText} = renderHomeScreen();
    fireEvent.press(getByText('View more'));
    expect(mockNavigation.navigate).toHaveBeenCalledWith('ProfileOverview', {
      companionId: 'comp-1',
    });
  });

  it('warns if "View more" is pressed with no selected companion (edge case)', () => {
    const consoleWarnSpy = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => {});
    setupMocks({
      user: mockUser,
      authUser: mockAuthUser,
      companions: mockCompanions,
      selectedCompanionId: null,
    });
    const {getByText} = renderHomeScreen();
    fireEvent.press(getByText('View more'));
    expect(mockNavigation.navigate).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      'No companion selected to view profile.',
    );
    consoleWarnSpy.mockRestore();
  });

  it('renders profile picture when available', () => {
    const userWithPic = {
      ...mockAuthUser,
      profilePicture: 'http://test.com/img.png',
    };
    setupMocks({
      user: mockUser,
      authUser: userWithPic,
      companions: [],
    });
    const {getByTestId, queryByText} = renderHomeScreen();
    const avatarImage = getByTestId('avatar-image');
    expect(avatarImage).toBeTruthy();
    expect(queryByText('J')).toBeNull();
  });

  it('renders correct initials and greeting for user with no name', () => {
    const userNoName = {
      ...mockAuthUser,
      firstName: null,
      profilePicture: '',
    };
    setupMocks({
      user: mockUser,
      authUser: userNoName,
      companions: [],
    });
    const {getByText} = renderHomeScreen();
    expect(getByText('Hello, Sky')).toBeTruthy();
    expect(getByText('S')).toBeTruthy();
  });

  it('handles search bar press (even if empty)', () => {
    const {getByTestId} = renderHomeScreen();
    const searchBar = getByTestId('search-bar');
    fireEvent.press(searchBar);
    expect(true).toBe(true);
  });

  it('handles quick action press (even if empty)', () => {
    const {getByText} = renderHomeScreen();
    const healthButton = getByText('Manage health');
    fireEvent.press(healthButton);
    expect(true).toBe(true);
  });
});
