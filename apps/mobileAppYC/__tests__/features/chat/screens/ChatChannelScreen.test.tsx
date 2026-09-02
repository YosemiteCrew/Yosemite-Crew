import React from 'react';
import {mockTheme} from '../setup/mockTheme';
import {render, waitFor, fireEvent, act} from '@testing-library/react-native';
import {ChatChannelScreen} from '../../../../src/features/chat/screens/ChatChannelScreen';
import {Alert} from 'react-native';
import {useRoute} from '@react-navigation/native';
import {useSelector} from 'react-redux';
import {
  getChatClient,
  connectStreamUser,
  getAppointmentChannel,
} from '../../../../src/features/chat/services/streamChatService';

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
jest.mock('../../../../src/features/chat/services/streamChatService', () => ({
  getChatClient: jest.fn(),
  connectStreamUser: jest.fn(),
  getAppointmentChannel: jest.fn(),
}));

// 4. Stream Chat Components.
// The mocked Channel invokes the EmptyStateIndicator / TypingIndicator render
// props so the screen's renderEmptyState / renderTypingIndicator callbacks run.
jest.mock('stream-chat-react-native', () => {
  const {View, Button} = require('react-native');
  return {
    OverlayProvider: ({children}: any) => <View>{children}</View>,
    Chat: ({children}: any) => <View testID="StreamChat">{children}</View>,
    Channel: ({children, EmptyStateIndicator, TypingIndicator}: any) => (
      <View testID="StreamChannel">
        {EmptyStateIndicator ? <EmptyStateIndicator /> : null}
        {TypingIndicator ? <TypingIndicator /> : null}
        {children}
      </View>
    ),
    MessageList: ({onThreadSelect}: any) => (
      <View testID="MessageList">
        <Button
          title="Select Thread"
          onPress={() => onThreadSelect({id: 'thread-123'})}
          testID="ThreadSelectBtn"
        />
        <Button
          title="Select Thread No Id"
          onPress={() => onThreadSelect(null)}
          testID="ThreadSelectBtnNoId"
        />
      </View>
    ),
    MessageInput: () => <View testID="MessageInput" />,
  };
});

// 5. Theme hook
jest.mock('@/hooks', () => ({
  useTheme: () => ({theme: mockTheme, isDark: false}),
}));

// 6. Liquid glass header shell — render the header + children render-prop only.
jest.mock(
  '@/shared/components/common/LiquidGlassHeader/LiquidGlassHeaderScreen',
  () => ({
    LiquidGlassHeaderScreen: ({children, header}: any) => {
      const {View} = require('react-native');
      return (
        <View testID="screen-layout">
          {header}
          {children({paddingBottom: 0})}
        </View>
      );
    },
  }),
);

// 7. GifLoader (loading state) via the common index barrel
jest.mock('@/shared/components/common', () => {
  const {View, Text} = require('react-native');
  return {
    GifLoader: () => (
      <View testID="loading-indicator">
        <Text>Loading chat...</Text>
      </View>
    ),
  };
});

// 8. Chat sub-components rendered inside the Channel
jest.mock('../../../../src/features/chat/components/CustomAttachment', () => ({
  CustomAttachment: () => null,
}));

jest.mock('../../../../src/features/chat/components/ChatEmptyState', () => ({
  ChatEmptyState: ({petName}: any) => {
    const {View, Text} = require('react-native');
    return (
      <View testID="empty-state">
        <Text>{petName ?? 'no-pet'}</Text>
      </View>
    );
  },
}));

jest.mock(
  '../../../../src/features/chat/components/ChatTypingIndicator',
  () => ({
    ChatTypingIndicator: () => {
      const {View} = require('react-native');
      return <View testID="typing-indicator-stub" />;
    },
  }),
);

// A Stream channel stub that records `on` subscriptions so tests can emit
// typing events and assert unsubscribe on cleanup.
const createMockChannel = () => {
  const listeners: Record<string, Array<(event: any) => void>> = {};
  return {
    id: 'channel-123',
    cid: 'messaging:channel-123',
    on: jest.fn((eventType: string, handler: (event: any) => void) => {
      listeners[eventType] = listeners[eventType] ?? [];
      listeners[eventType].push(handler);
      return {
        unsubscribe: jest.fn(() => {
          listeners[eventType] = (listeners[eventType] ?? []).filter(
            h => h !== handler,
          );
        }),
      };
    }),
    __emit: (eventType: string, payload: any) => {
      (listeners[eventType] ?? []).forEach(handler => handler(payload));
    },
  };
};

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

  const mockClient = {userID: 'user-123'};
  let mockChannel: ReturnType<typeof createMockChannel>;

  beforeEach(() => {
    jest.clearAllMocks();

    mockChannel = createMockChannel();

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

  it('shows no presence indicator, because nothing tracks presence', async () => {
    /*
     * The dot used to render unconditionally, so every vet always appeared
     * online. Nothing subscribes to presence and the transport exposes none.
     *
     * Asserted structurally - the avatar holds the initials and nothing else.
     * A first attempt matched on the style NAME containing "presence", which
     * silently never bites: RN StyleSheet compiles styles to numeric ids, so
     * re-adding the dot still passed.
     */
    const {getByTestId} = render(<ChatChannelScreen />);
    const avatar = await waitFor(() => getByTestId('ChatHeaderAvatar'));

    expect(avatar.props.children).toBeTruthy();
    const children = Array.isArray(avatar.props.children)
      ? avatar.props.children.filter(Boolean)
      : [avatar.props.children];
    expect(children).toHaveLength(1);
  });

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
    expect(getByTestId('MessageInput')).toBeTruthy();
    // The Channel render props for empty/typing state are wired up.
    expect(getByTestId('empty-state')).toBeTruthy();
    expect(getByTestId('typing-indicator-stub')).toBeTruthy();
    expect(connectStreamUser).toHaveBeenCalledWith(
      'user-123',
      'John Doe',
      'avatar-url',
    );
    // Subscribes to both typing events on the live channel.
    expect(mockChannel.on).toHaveBeenCalledWith(
      'typing.start',
      expect.any(Function),
    );
    expect(mockChannel.on).toHaveBeenCalledWith(
      'typing.stop',
      expect.any(Function),
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
        'Pet Parent',
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

  it('renders error fallback when the chat client is unavailable', async () => {
    (getChatClient as jest.Mock).mockReturnValue(null);
    const {getByText} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(getByText('Unable to load chat')).toBeTruthy();
    });
    expect(
      getByText('Please check your connection and try again'),
    ).toBeTruthy();
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

  it('does not log thread selection when the message has no id', async () => {
    const {getByTestId} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(getByTestId('MessageList')).toBeTruthy();
    });
    (console.log as jest.Mock).mockClear();
    fireEvent.press(getByTestId('ThreadSelectBtnNoId'));
    expect(console.log).not.toHaveBeenCalled();
  });

  // --- Header Rendering Branches ---

  it('renders the doctor name and pet subtitle in the header', async () => {
    const {getByText} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(getByText('Dr. Smith')).toBeTruthy();
    });
    expect(getByText('About Rex')).toBeTruthy();
    // Initials derived from the doctor name (title prefix stripped).
    expect(getByText('S')).toBeTruthy();
  });

  it('renders fallback initials and omits subtitle when name is blank and petName missing', async () => {
    (useRoute as jest.Mock).mockReturnValue({
      params: {...mockRouteParams, doctorName: '   ', petName: undefined},
    });
    const {getByText, queryByText} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(getByText('?')).toBeTruthy();
    });
    expect(queryByText(/^About/)).toBeNull();
  });

  // --- Live Typing Indicator ---

  it('shows the typing status when the other participant starts typing', async () => {
    const {getByText, queryByText} = render(<ChatChannelScreen />);
    await waitFor(() => expect(getByText('About Rex')).toBeTruthy());
    // The typing listener registers only once the channel is ready; wait for it
    // before emitting so the event is not dropped.
    await waitFor(() =>
      expect(mockChannel.on).toHaveBeenCalledWith(
        'typing.start',
        expect.any(Function),
      ),
    );

    act(() => {
      mockChannel.__emit('typing.start', {user: {id: 'vet-456'}});
    });

    await waitFor(() => expect(getByText('typing...')).toBeTruthy());
    expect(queryByText('About Rex')).toBeNull();
  });

  it('clears the typing status when the other participant stops typing', async () => {
    const {getByText, queryByText} = render(<ChatChannelScreen />);
    await waitFor(() => expect(getByText('About Rex')).toBeTruthy());
    // The typing listener registers only once the channel is ready; wait for it
    // before emitting so the event is not dropped.
    await waitFor(() =>
      expect(mockChannel.on).toHaveBeenCalledWith(
        'typing.start',
        expect.any(Function),
      ),
    );

    act(() => {
      mockChannel.__emit('typing.start', {user: {id: 'vet-456'}});
    });
    await waitFor(() => expect(getByText('typing...')).toBeTruthy());

    act(() => {
      mockChannel.__emit('typing.stop', {user: {id: 'vet-456'}});
    });
    await waitFor(() => expect(getByText('About Rex')).toBeTruthy());
    expect(queryByText('typing...')).toBeNull();
  });

  it('ignores typing events from the current user', async () => {
    const {getByText, queryByText} = render(<ChatChannelScreen />);
    await waitFor(() => expect(getByText('About Rex')).toBeTruthy());
    // The typing listener registers only once the channel is ready; wait for it
    // before emitting so the event is not dropped.
    await waitFor(() =>
      expect(mockChannel.on).toHaveBeenCalledWith(
        'typing.start',
        expect.any(Function),
      ),
    );

    act(() => {
      mockChannel.__emit('typing.start', {user: {id: 'user-123'}});
      mockChannel.__emit('typing.stop', {user: {id: 'user-123'}});
    });

    expect(queryByText('typing...')).toBeNull();
    expect(getByText('About Rex')).toBeTruthy();
  });

  it('ignores typing events that have no user id', async () => {
    const {getByText, queryByText} = render(<ChatChannelScreen />);
    await waitFor(() => expect(getByText('About Rex')).toBeTruthy());
    // The typing listener registers only once the channel is ready; wait for it
    // before emitting so the event is not dropped.
    await waitFor(() =>
      expect(mockChannel.on).toHaveBeenCalledWith(
        'typing.start',
        expect.any(Function),
      ),
    );

    act(() => {
      mockChannel.__emit('typing.start', {user: {}});
      mockChannel.__emit('typing.stop', {});
    });

    expect(queryByText('typing...')).toBeNull();
    expect(getByText('About Rex')).toBeTruthy();
  });

  it('unsubscribes from typing events on unmount', async () => {
    const {getByTestId, unmount} = render(<ChatChannelScreen />);
    await waitFor(() => expect(getByTestId('StreamChat')).toBeTruthy());

    const subscriptions = (mockChannel.on as jest.Mock).mock.results;
    expect(subscriptions.length).toBe(2);

    unmount();

    subscriptions.forEach(result => {
      expect(result.value.unsubscribe).toHaveBeenCalled();
    });
  });

  // --- Error State Fallback Copy ---

  it('shows generic fallback copy when channel is null without an error', async () => {
    (getAppointmentChannel as jest.Mock).mockResolvedValue(null);
    const {getByText} = render(<ChatChannelScreen />);
    await waitFor(() => {
      expect(getByText('Unable to load chat')).toBeTruthy();
    });
    expect(
      getByText('Please check your connection and try again'),
    ).toBeTruthy();
  });
});
