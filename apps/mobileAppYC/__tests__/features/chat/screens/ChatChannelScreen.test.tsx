import React from 'react';
import {render, waitFor, fireEvent, act} from '@testing-library/react-native';
import {ChatChannelScreen} from '@/features/chat/screens/ChatChannelScreen';
import {Alert} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {
  getChatClient,
  connectStreamUser,
  getAppointmentChannel,
} from '@/features/chat/services/streamChatService';

// --- Mocks ---

// 1. Navigation
const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockCanGoBack = jest.fn();
const mockGetParent = jest.fn();

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: mockGoBack,
    canGoBack: mockCanGoBack,
    getParent: mockGetParent,
  }),
  useRoute: jest.fn(),
}));

// 2. Redux
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

// 3. Stream Chat Service
jest.mock('@/features/chat/services/streamChatService', () => ({
  getChatClient: jest.fn(),
  connectStreamUser: jest.fn(),
  getAppointmentChannel: jest.fn(),
}));

// 4. Stream Chat Components
jest.mock('stream-chat-react-native', () => {
  const {View, Button} = require('react-native');
  return {
    OverlayProvider: ({children}: any) => <View>{children}</View>,
    Chat: ({children}: any) => <View testID="StreamChat">{children}</View>,
    Channel: ({children}: any) => (
      <View testID="StreamChannel">{children}</View>
    ),
    MessageList: ({onThreadSelect}: any) => (
      <View testID="MessageList">
        <Button
          title="Select Thread"
          onPress={() => onThreadSelect({id: 'thread-123'})}
          testID="ThreadSelectBtn"
        />
      </View>
    ),
    MessageInput: () => <View testID="MessageInput" />,
  };
});

// 5. Common Components & Hooks
jest.mock('@/hooks', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#ffffff',
        primary: 'blue',
        textSecondary: 'gray',
        error: 'red',
      },
      typography: {
        bodyMedium: {},
        bodySmall: {},
      },
    },
  }),
}));

jest.mock('@/shared/components/common/Header/Header', () => ({
  Header: ({title, onBack}: any) => {
    const {TouchableOpacity, Text, View} = require('react-native');
    return (
      <View testID="Header">
        <Text>{title}</Text>
        <TouchableOpacity onPress={onBack} testID="HeaderBackButton" />
      </View>
    );
  },
}));

jest.mock('@/features/chat/components/CustomAttachment', () => ({
  CustomAttachment: () => null,
}));

// 6. Safe Area
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: ({children}: any) => <>{children}</>,
}));

describe('ChatChannelScreen', () => {
  const mockRouteParams = {
    appointmentId: 'apt-123',
    vetId: 'vet-456',
    appointmentTime: '2025-01-01T10:00:00Z',
    doctorName: 'Dr. Smith',
    petName: 'Rex',
  };

  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    email: 'john@example.com',
    profilePicture: 'avatar-url',
  };

  const mockChannel = {id: 'channel-123', cid: 'messaging:channel-123'};
  const mockClient = {userID: 'user-123'};

  beforeEach(() => {
    jest.clearAllMocks();

    (useRoute as jest.Mock).mockReturnValue({params: mockRouteParams});
    (useSelector as unknown as jest.Mock).mockReturnValue(mockUser);

    (getChatClient as jest.Mock).mockReturnValue(mockClient);
    (connectStreamUser as jest.Mock).mockResolvedValue(true);
    (getAppointmentChannel as jest.Mock).mockResolvedValue(mockChannel);

    jest.spyOn(Alert, 'alert');
    jest.spyOn(console, 'log').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  // --- Rendering & Initialization Tests ---

  it('renders loading state initially', async () => {
    (connectStreamUser as jest.Mock).mockImplementation(
      () => new Promise(() => {}),
    );
    const {getByText} = render(<ChatChannelScreen />);
    expect(getByText('Loading chat...')).toBeTruthy();
  });

  it('initializes chat successfully and renders channel', async () => {
    const {getByTestId} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(getByTestId('StreamChat')).toBeTruthy();
      expect(getByTestId('StreamChannel')).toBeTruthy();
    });
    expect(connectStreamUser).toHaveBeenCalledWith(
      'user-123',
      'John Doe',
      'avatar-url',
    );
  });

  // --- Auth User Data Variations ---

  it('alerts and navigates back if user is not logged in', async () => {
    (useSelector as unknown as jest.Mock).mockReturnValue(null);
    render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Chat unavailable',
        expect.stringContaining('must be signed in'),
        expect.any(Array),
      );
    });
    // @ts-ignore
    const buttons = Alert.alert.mock.calls[0][2];
    buttons[0].onPress();
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('uses email as display name if name missing', async () => {
    (useSelector as unknown as jest.Mock).mockReturnValue({
      id: 'user-123',
      email: 'onlyemail@example.com',
      firstName: '',
      lastName: null,
    });
    render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(connectStreamUser).toHaveBeenCalledWith(
        'user-123',
        'onlyemail@example.com',
        undefined,
      );
    });
  });

  it('uses fallback display name if all info missing', async () => {
    (useSelector as unknown as jest.Mock).mockReturnValue({
      id: 'user-123',
      email: '',
      firstName: null,
    });
    render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(connectStreamUser).toHaveBeenCalledWith(
        'user-123',
        'Pet Owner',
        undefined,
      );
    });
  });

  it('uses parentId as chatUserId if available', async () => {
    (useSelector as unknown as jest.Mock).mockReturnValue({
      id: 'child-user',
      parentId: 'parent-user',
      firstName: 'Child',
    });
    render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(connectStreamUser).toHaveBeenCalledWith(
        'parent-user',
        'Child',
        undefined,
      );
    });
  });

  // --- Error Handling ---

  it('handles generic initialization error', async () => {
    (connectStreamUser as jest.Mock).mockRejectedValue(
      new Error('Generic Error'),
    );
    const {getByText} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(getByText('Generic Error')).toBeTruthy();
    });
  });

  it('handles non-Error object thrown', async () => {
    (connectStreamUser as jest.Mock).mockRejectedValue('String Error');
    const {getByText} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(getByText('Failed to load chat. Please try again.')).toBeTruthy();
    });
  });

  it('handles specific API key error message', async () => {
    (connectStreamUser as jest.Mock).mockRejectedValue(
      new Error('Something API key invalid'),
    );
    const {getByText} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(
        getByText('Chat is not configured. Please contact support.'),
      ).toBeTruthy();
    });
  });

  it('handles specific network error message', async () => {
    (connectStreamUser as jest.Mock).mockRejectedValue(
      new Error('Connection network failed'),
    );
    const {getByText} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(
        getByText('Network error. Please check your connection and try again.'),
      ).toBeTruthy();
    });
  });

  // --- Retry Logic ---

  it('retries initialization on Alert Retry press', async () => {
    // First attempt fails
    (connectStreamUser as jest.Mock).mockRejectedValueOnce(new Error('Fail 1'));
    // Second attempt (triggered by retry) succeeds
    (connectStreamUser as jest.Mock).mockResolvedValueOnce(true);

    const {queryByTestId} = render(<ChatChannelScreen />);

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
    });

    // Clear previous calls to check retry count cleanly
    (connectStreamUser as jest.Mock).mockClear();

    // Trigger Retry
    // @ts-ignore
    const buttons = Alert.alert.mock.calls[0][2];
    const retryBtn = buttons.find((b: any) => b.text === 'Retry');

    act(() => {
      retryBtn.onPress();
    });

    await waitFor(() => {
      expect(connectStreamUser).toHaveBeenCalled();
      expect(queryByTestId('StreamChat')).toBeTruthy();
    });
  });

  it('goes back on Alert Go Back press', async () => {
    (connectStreamUser as jest.Mock).mockRejectedValue(new Error('Fail'));
    render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalled();
    });
    // @ts-ignore
    const buttons = Alert.alert.mock.calls[0][2];
    const backBtn = buttons.find((b: any) => b.text === 'Go Back');
    backBtn.onPress();
    expect(mockGoBack).toHaveBeenCalled();
  });

  // --- Navigation Header ---

  it('navigates back using standard goBack if history exists', async () => {
    mockCanGoBack.mockReturnValue(true);
    const {getByTestId} = render(<ChatChannelScreen />);
    await waitFor(() => expect(getByTestId('Header')).toBeTruthy());
    fireEvent.press(getByTestId('HeaderBackButton'));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it('navigates to Appointments tab if cannot go back', async () => {
    mockCanGoBack.mockReturnValue(false);
    mockGetParent.mockReturnValue({navigate: mockNavigate});
    const {getByTestId} = render(<ChatChannelScreen />);
    await waitFor(() => expect(getByTestId('Header')).toBeTruthy());
    fireEvent.press(getByTestId('HeaderBackButton'));
    expect(mockNavigate).toHaveBeenCalledWith('Appointments', {
      screen: 'MyAppointments',
    });
  });

  it('handles navigation gracefully if getParent returns undefined', async () => {
    mockCanGoBack.mockReturnValue(false);
    mockGetParent.mockReturnValue(undefined);
    const {getByTestId} = render(<ChatChannelScreen />);
    await waitFor(() => expect(getByTestId('Header')).toBeTruthy());
    fireEvent.press(getByTestId('HeaderBackButton'));
    // Should verify no crash
  });

  // --- Message List Interaction ---

  it('logs thread selection', async () => {
    const {getByTestId} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(getByTestId('MessageList')).toBeTruthy();
    });
    fireEvent.press(getByTestId('ThreadSelectBtn'));
    expect(console.log).toHaveBeenCalledWith(
      '[Chat] Thread selected:',
      'thread-123',
    );
  });
});
