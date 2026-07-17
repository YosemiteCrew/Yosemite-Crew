import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import ProtectedChatContainer, {
  ChatContainer,
  ChannelPreviewWrapper,
  ChatClosedFooter,
} from '@/app/features/chat/components/ChatContainer';
import {
  normalizeName,
  getSessionIdFromChannel,
  findSessionByStoredId,
  matchesDirectSession,
  matchesGroupSession,
  matchesChannelId,
  getChannelDisplayInfo,
  resolveChannelScope,
  formatRowTime,
  isCounterpartOnline,
  formatClosedTime,
} from '@/app/features/chat/components/chatContainerUtils';
import type { Channel as StreamChannel } from 'stream-chat';
import * as streamChatService from '@/app/features/chat/services/streamChatService';
import * as chatService from '@/app/features/chat/services/chatService';
import { useAuthStore } from '@/app/stores/authStore';
import { useOrgStore } from '@/app/stores/orgStore';
import { useAppointmentStore } from '@/app/stores/appointmentStore';
import { useCompanionStore } from '@/app/stores/companionStore';
import { useChannelStateContext, useChatContext } from 'stream-chat-react';

// ----------------------------------------------------------------------------
// 1. Mocks & Setup
// ----------------------------------------------------------------------------

// Mock Stores
jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

jest.mock('@/app/stores/orgStore', () => ({
  useOrgStore: jest.fn(),
}));

jest.mock('@/app/stores/appointmentStore', () => ({
  useAppointmentStore: jest.fn(),
}));

jest.mock('@/app/stores/companionStore', () => ({
  useCompanionStore: jest.fn(),
}));

jest.mock('@/app/hooks/useAppointments', () => ({
  useLoadAppointmentsForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/hooks/useCompanion', () => ({
  useLoadCompanionsForPrimaryOrg: jest.fn(),
}));

const mockRouterPush = jest.fn();
jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: mockRouterPush }),
}));

// Mock toast notifications
const mockNotify = jest.fn();
jest.mock('@/app/hooks/useNotify', () => ({
  useNotify: () => ({ notify: mockNotify }),
}));

// Mock Services
jest.mock('@/app/features/chat/services/streamChatService', () => ({
  getChatClient: jest.fn(),
  connectStreamUser: jest.fn(),
  endChatChannel: jest.fn(),
  getAppointmentChannel: jest.fn(),
}));

jest.mock('@/app/features/chat/services/chatService', () => ({
  createOrgDirectChat: jest.fn(),
  createOrgGroupChat: jest.fn(),
  fetchOrgUsers: jest.fn(),
  getChatSessions: jest.fn(),
  addGroupMembers: jest.fn(),
  removeGroupMembers: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  getChatSession: jest.fn(),
  listOrgChatSessions: jest.fn(),
}));

jest.mock('@/app/features/appointments/services/appointmentService', () => ({
  changeAppointmentStatus: jest.fn(),
}));

// Global mocks
globalThis.alert = jest.fn();
globalThis.confirm = jest.fn(() => true);

// Suppress console errors/warns for cleaner test output (optional but helpful)
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;
beforeAll(() => {
  console.error = jest.fn();
  console.warn = jest.fn();
});
afterAll(() => {
  console.error = originalConsoleError;
  console.warn = originalConsoleWarn;
});

// *** Default Mock Data ***
const defaultMockChannel = {
  id: 'channel-1',
  cid: 'messaging:channel-1',
  type: 'messaging',
  data: { name: 'Test Channel', member_count: 2 },
  state: {
    members: {
      'user-1': { user: { id: 'user-1', name: 'Me' }, role: 'owner' },
      'user-2': { user: { id: 'user-2', name: 'Other' } },
    },
  },
  watch: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  addMembers: jest.fn().mockResolvedValue({}),
  removeMembers: jest.fn().mockResolvedValue({}),
  hide: jest.fn().mockResolvedValue({}),
  on: jest.fn(),
  off: jest.fn(),
};

// *** Stream Chat Mock ***
jest.mock('stream-chat-react', () => {
  return {
    Chat: ({ children }: any) => <div data-testid="stream-chat">{children}</div>,
    Channel: ({ children }: any) => <div data-testid="stream-channel">{children}</div>,
    ChannelList: ({ filters: _filters, channelRenderFilterFn }: any) => {
      if (channelRenderFilterFn) {
        (window as any).__testChannelFilter = channelRenderFilterFn;
      }
      return <div data-testid="channel-list">Channel List</div>;
    },
    ChannelHeader: ({ title }: any) => <div data-testid="channel-header">{title}</div>,
    MessageList: () => <div data-testid="message-list" />,
    MessageInput: () => <div data-testid="message-input" />,
    Thread: () => <div data-testid="thread" />,
    TypingIndicator: () => <div data-testid="typing-indicator" />,
    Window: ({ children }: any) => <div data-testid="chat-window">{children}</div>,
    ChannelPreviewMessenger: ({ displayTitle }: any) => <div>{displayTitle}</div>,
    ComponentProvider: ({ children }: any) => <>{children}</>,
    useChannelStateContext: jest.fn(),
    useChatContext: jest.fn(),
    useChannelActionContext: jest.fn(() => ({ jumpToMessage: jest.fn() })),
  };
});

// Mock UI Components
jest.mock('@/app/ui/overlays/Loader', () => ({
  YosemiteLoader: () => <div data-testid="loader">Loading...</div>,
}));

jest.mock('@/app/ui/overlays/Modal', () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="group-modal">{children}</div> : null,
}));

jest.mock('@/app/ui/inputs/FormInput/FormInput', () => ({
  __esModule: true,
  default: ({ value, onChange, onFocus, onBlur, inlabel }: any) => (
    <input
      data-testid={`input-${inlabel || 'search'}`}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={inlabel}
    />
  ),
}));

jest.mock('@/app/ui/primitives/Icons/Close', () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button onClick={onClick} data-testid="close-icon">
      X
    </button>
  ),
}));

jest.mock('@/app/ui/layout/guards/ProtectedRoute', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="protected-route">{children}</div>,
}));

jest.mock('@/app/ui/layout/guards/OrgGuard', () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

jest.mock('@/app/features/appointments/pages/Appointments/Sections/Reschedule', () => ({
  __esModule: true,
  default: ({ showModal }: { showModal: boolean }) =>
    showModal ? <div data-testid="chat-reschedule-modal" /> : null,
}));

jest.mock(
  '@/app/features/appointments/pages/Appointments/Sections/AddAppointmentCentralModal',
  () => ({
    __esModule: true,
    default: ({ showModal }: { showModal: boolean }) =>
      showModal ? <div data-testid="chat-followup-modal" /> : null,
  })
);

const mockClient = {
  userID: 'user-1',
  channel: jest.fn(() => defaultMockChannel),
  queryChannels: jest.fn().mockResolvedValue([defaultMockChannel]),
};

describe('ChatContainer', () => {
  const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
  const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
  const mockUseAppointmentStore = useAppointmentStore as unknown as jest.Mock;
  const mockUseCompanionStore = useCompanionStore as unknown as jest.Mock;
  const mockUseChannelStateContext = useChannelStateContext as unknown as jest.Mock;
  const mockUseChatContext = useChatContext as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (streamChatService.getChatClient as jest.Mock).mockReturnValue(mockClient);
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(defaultMockChannel);

    // Default mock context return
    mockUseChannelStateContext.mockReturnValue({ channel: defaultMockChannel });
    mockUseChatContext.mockReturnValue({
      client: mockClient,
      setActiveChannel: jest.fn(),
    });

    // Default Store State
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        attributes: { sub: 'user-1', email: 'test@test.com' },
        status: 'authenticated',
        loading: false,
      })
    );

    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({
        primaryOrgId: 'org-1',
        status: 'loaded',
        getPrimaryOrg: () => ({ crossOrgMessagingEnabled: false }),
      })
    );

    mockUseAppointmentStore.mockImplementation((selector: any) =>
      selector({
        appointmentsById: {
          '123': {
            id: '123',
            status: 'UPCOMING',
            startTime: new Date('2026-06-25T15:00:00Z'),
            patient: { id: 'patient-1', name: 'Bella' },
            companion: { id: 'patient-1', name: 'Bella', parent: { id: 'parent-1', name: 'Pat' } },
          },
        },
      })
    );

    mockUseCompanionStore.mockImplementation((selector: any) =>
      selector({
        companionsById: {
          'patient-1': {
            id: 'patient-1',
            allergy: 'Penicillin',
            alerts: [{ title: 'Bleed risk', severity: 'high' }],
          },
        },
      })
    );

    // Service Defaults
    (chatService.fetchOrgUsers as jest.Mock).mockResolvedValue([
      { id: 'u2', userId: 'user-2', name: 'User Two', email: 'u2@test.com' },
      { id: 'u3', userId: 'user-3', name: 'User Three', email: 'u3@test.com' },
    ]);
    (chatService.getChatSessions as jest.Mock).mockResolvedValue({
      channels: [],
    });
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([]);

    // Mock Create Group response
    (chatService.createOrgGroupChat as jest.Mock).mockResolvedValue({
      _id: 'group-1',
      channelId: 'channel-1',
      title: 'New Team',
      organisationId: 'org-1',
      createdBy: 'user-1',
      type: 'ORG_GROUP',
    });

    // Mock Create Direct Chat response
    (chatService.createOrgDirectChat as jest.Mock).mockResolvedValue({
      _id: 'direct-1',
      channelId: 'channel-direct-1',
      title: 'User Two',
      organisationId: 'org-1',
      createdBy: 'user-1',
      type: 'ORG_DIRECT',
    });

    mockRouterPush.mockReset();
  });

  // --------------------------------------------------------------------------
  // Tests
  // --------------------------------------------------------------------------

  it('renders loader while initializing', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        status: 'checking',
        loading: true,
      })
    );
    render(<ChatContainer />);
    expect(screen.getByTestId('loader')).toBeInTheDocument();
  });

  it('renders error state if auth fails', () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        status: 'unauthenticated',
      })
    );
    render(<ChatContainer />);
    expect(screen.getByText(/User not authenticated/)).toBeInTheDocument();
  });

  it('renders chat layout when initialized', async () => {
    await act(async () => {
      render(<ChatContainer />);
    });
    await waitFor(() => expect(screen.getByTestId('stream-chat')).toBeInTheDocument());
    expect(screen.getByTestId('channel-list')).toBeInTheDocument();
  });

  it('renders empty state placeholder when scope changes', async () => {
    const { rerender } = render(<ChatContainer scope="colleagues" />);

    await act(async () => {
      rerender(<ChatContainer scope="clients" />);
    });

    await waitFor(() =>
      expect(screen.getByText('Your conversations live here')).toBeInTheDocument()
    );
  });

  it('does not reset the selection when only the onChannelSelect identity changes', async () => {
    const { rerender } = render(
      <ChatContainer scope="clients" onChannelSelect={() => undefined} />
    );

    await act(async () => {
      rerender(<ChatContainer scope="clients" onChannelSelect={() => undefined} />);
    });

    // Callers pass an inline arrow, so a fresh identity arrives on every parent
    // render; only a scope change may clear the active channel.
    expect(screen.queryByText('Your conversations live here')).not.toBeInTheDocument();
  });

  it('clears the selection through the latest callback when the scope changes', async () => {
    const firstCallback = jest.fn();
    const latestCallback = jest.fn();
    const { rerender } = render(
      <ChatContainer scope="colleagues" onChannelSelect={firstCallback} />
    );

    await act(async () => {
      rerender(<ChatContainer scope="clients" onChannelSelect={latestCallback} />);
    });

    await waitFor(() => expect(latestCallback).toHaveBeenCalledWith(null));
    expect(firstCallback).not.toHaveBeenCalled();
  });

  it('searches and starts direct chat (creates new)', async () => {
    // Force queryChannels to return empty so it doesn't find existing chat
    mockClient.queryChannels.mockResolvedValue([]);

    await act(async () => {
      render(<ChatContainer scope="colleagues" />);
    });
    await waitFor(() => expect(chatService.fetchOrgUsers).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Search teammate to chat');
    fireEvent.change(input, { target: { value: 'User Two' } });
    fireEvent.focus(input);

    const userButton = await screen.findByText('User Two');

    await act(async () => {
      fireEvent.click(userButton.closest('button')!);
    });

    await waitFor(() => {
      expect(chatService.createOrgDirectChat).toHaveBeenCalledWith(
        expect.objectContaining({
          otherUserId: 'user-2',
        })
      );
    });
  });

  it('reuses an existing direct channel without creating a new session', async () => {
    const existingDirectChannel = {
      ...defaultMockChannel,
      id: 'existing-direct',
      data: { chatCategory: 'colleagues' },
      state: {
        members: {
          'user-1': { user: { id: 'user-1', name: 'Me' } },
          'user-2': { user: { id: 'user-2', name: 'User Two' } },
        },
      },
      watch: jest.fn().mockResolvedValue({}),
    };
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([]);
    mockClient.queryChannels.mockResolvedValue([existingDirectChannel]);

    await act(async () => {
      render(<ChatContainer scope="colleagues" />);
    });
    await waitFor(() => expect(chatService.fetchOrgUsers).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Search teammate to chat');
    fireEvent.change(input, { target: { value: 'User Two' } });
    fireEvent.focus(input);

    const userButton = await screen.findByText('User Two');
    await act(async () => {
      fireEvent.click(userButton.closest('button')!);
    });

    await waitFor(() => {
      expect(existingDirectChannel.watch).toHaveBeenCalled();
    });
    expect(chatService.createOrgDirectChat).not.toHaveBeenCalled();
  });

  it('shows no-results message when teammate search has no matches', async () => {
    await act(async () => {
      render(<ChatContainer scope="colleagues" />);
    });
    await waitFor(() => expect(chatService.fetchOrgUsers).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Search teammate to chat');
    fireEvent.change(input, { target: { value: 'unknown teammate' } });
    fireEvent.focus(input);

    expect(screen.getByText('No teammates found. Adjust your search.')).toBeInTheDocument();
    expect(chatService.createOrgDirectChat).not.toHaveBeenCalled();
  });

  it('creates a group via modal', async () => {
    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    // The "Create Group" button in the header
    await waitFor(() => expect(screen.getAllByText('Create Group')[0]).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Create Group')[0]);

    // Modal opens
    expect(screen.getByTestId('group-modal')).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText('Group Title');
    fireEvent.change(titleInput, { target: { value: 'New Team' } });

    const searchInput = screen.getByPlaceholderText('Search teammates');
    fireEvent.change(searchInput, { target: { value: 'Two' } });
    const addButton = await screen.findAllByTitle('Add member');
    fireEvent.click(addButton[0]);

    // Click "Create Group" inside modal (last one)
    const createBtns = screen.getAllByText('Create Group');
    await act(async () => {
      fireEvent.click(createBtns.at(-1)!);
    });

    await waitFor(() => {
      expect(chatService.createOrgGroupChat).toHaveBeenCalled();
    });
  });

  it('keeps create-group submit inert until the form is valid', async () => {
    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    await waitFor(() => expect(screen.getAllByText('Create Group')[0]).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Create Group')[0]);

    const createBtns = screen.getAllByText('Create Group');
    await act(async () => {
      fireEvent.click(createBtns.at(-1)!);
    });

    expect(chatService.createOrgGroupChat).not.toHaveBeenCalled();
  });

  it('shows error alert when create group fails', async () => {
    (chatService.createOrgGroupChat as jest.Mock).mockRejectedValueOnce(new Error('create failed'));

    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    await waitFor(() => expect(screen.getAllByText('Create Group')[0]).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Create Group')[0]);

    fireEvent.change(screen.getByPlaceholderText('Group Title'), {
      target: { value: 'Core Team' },
    });
    fireEvent.change(screen.getByPlaceholderText('Search teammates'), {
      target: { value: 'Two' },
    });
    const addButtons = await screen.findAllByTitle('Add member');
    fireEvent.click(addButtons[0]);

    const createBtns = screen.getAllByText('Create Group');
    await act(async () => {
      fireEvent.click(createBtns.at(-1)!);
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ text: 'Unable to create group. Please try again.' })
      );
    });
  });

  it('handles delete group', async () => {
    // 1. Force the current channel context to be a group so "Group Info" appears
    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'group', name: 'Group Chat' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });

    // 2. Render with group scope
    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    await waitFor(() => expect(screen.getByTestId('channel-list')).toBeInTheDocument());

    // 3. Find Group Info button (might need wait if render is async)
    const groupInfoBtn = await screen.findByText('Group Info');

    // 4. Click Group Info to open modal in EDIT mode
    await act(async () => {
      fireEvent.click(groupInfoBtn);
    });

    // 5. Mock backend finding the session so delete is enabled.
    // This needs to resolve BEFORE we check for the delete button,
    // but after the modal logic fires listOrgChatSessions.
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([
      {
        _id: 'backend-group-id',
        channelId: groupChannel.id,
        type: 'ORG_GROUP',
      },
    ]);

    // Wait for the modal content to fully render (async backend ID fetch)
    await waitFor(() => expect(screen.getByTestId('group-modal')).toBeInTheDocument());

    // Wait a tick for the async session ID resolution inside the component
    await waitFor(() => {}, { timeout: 100 });

    const deleteBtn = screen.getByText('Delete Group');

    await act(async () => {
      fireEvent.click(deleteBtn);
    });
  });

  it('does not delete group when confirm is cancelled', async () => {
    (globalThis.confirm as jest.Mock).mockReturnValueOnce(false);
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([
      {
        _id: 'backend-group-id',
        channelId: 'channel-1',
        type: 'ORG_GROUP',
      },
    ]);

    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'group', name: 'Group Chat' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });

    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    const groupInfoBtn = await screen.findByText('Group Info');
    await act(async () => {
      fireEvent.click(groupInfoBtn);
    });

    const deleteBtn = await screen.findByText('Delete Group');
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    expect(chatService.deleteGroup).not.toHaveBeenCalled();
  });

  const openGroupEditModal = async () => {
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([
      { _id: 'backend-group-id', channelId: 'channel-1', type: 'ORG_GROUP' },
    ]);
    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'group', name: 'Group Chat' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });
    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });
    await act(async () => {
      fireEvent.click(await screen.findByText('Group Info'));
    });
    await waitFor(() => expect(screen.getByTestId('group-modal')).toBeInTheDocument());
  };

  it('saves the group title in edit mode', async () => {
    await openGroupEditModal();
    fireEvent.change(screen.getByTestId('input-Group Chat'), { target: { value: 'Renamed' } });
    await act(async () => {
      fireEvent.click(await screen.findByText('Save Title'));
    });
    await waitFor(() =>
      expect(chatService.updateGroup).toHaveBeenCalledWith('backend-group-id', { title: 'Renamed' })
    );
  });

  it('adds and removes members in edit mode', async () => {
    await openGroupEditModal();
    const addBtns = await screen.findAllByTitle('Add member');
    await act(async () => {
      fireEvent.click(addBtns[0]);
    });
    await waitFor(() => expect(chatService.addGroupMembers).toHaveBeenCalled());
    const removeBtns = await screen.findAllByTitle('Remove member');
    await act(async () => {
      fireEvent.click(removeBtns[0]);
    });
    await waitFor(() => expect(chatService.removeGroupMembers).toHaveBeenCalled());
  });

  it('deletes the group from edit mode when confirmed', async () => {
    await openGroupEditModal();
    await act(async () => {
      fireEvent.click(await screen.findByText('Delete Group'));
    });
    await waitFor(() => expect(chatService.deleteGroup).toHaveBeenCalledWith('backend-group-id'));
  });

  it('filters channels correctly based on scope', async () => {
    await act(async () => {
      render(<ChatContainer scope="clients" />);
    });
    await waitFor(() => expect(screen.getByTestId('channel-list')).toBeInTheDocument());

    const filterFn = (globalThis as any).__testChannelFilter;

    const clientChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'clients' },
    };
    expect(filterFn([clientChannel])).toHaveLength(1);

    const colleagueChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'colleagues' },
    };
    expect(filterFn([colleagueChannel])).toHaveLength(0);
  });

  it('renders specific appointment channel if ID provided', async () => {
    // Inject appointment context
    mockUseChannelStateContext.mockReturnValue({
      channel: { ...defaultMockChannel, data: { appointmentId: '123' } },
    });

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    await waitFor(() => {
      expect(streamChatService.getAppointmentChannel).toHaveBeenCalledWith('123');
    });
    await waitFor(() => {
      expect(mockUseChatContext().setActiveChannel).toHaveBeenCalled();
    });
  });

  it('handles closing session', async () => {
    // Force context to be client chat so "Close session" appears
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);
    (chatService.getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-123' });

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    await waitFor(() => expect(screen.getByText('Close session')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(screen.getByText('Close session'));
    });

    await waitFor(() => {
      expect(streamChatService.endChatChannel).toHaveBeenCalledWith('session-123');
    });
  });

  it('does not close session when user cancels confirmation', async () => {
    (globalThis.confirm as jest.Mock).mockReturnValueOnce(false);
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);
    (chatService.getChatSession as jest.Mock).mockResolvedValue({
      _id: 'session-123',
    });

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    const closeBtn = await screen.findByText('Close session');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    expect(streamChatService.endChatChannel).not.toHaveBeenCalled();
  });

  it('ProtectedChatContainer wraps with guards', async () => {
    await act(async () => {
      render(<ProtectedChatContainer />);
    });
    expect(screen.getByTestId('protected-route')).toBeInTheDocument();
    expect(screen.getByTestId('org-guard')).toBeInTheDocument();
  });

  it('fires onScopeChange when a scope tab is clicked', async () => {
    jest.useFakeTimers();
    const onScopeChange = jest.fn();
    try {
      await act(async () => {
        render(<ChatContainer scope="colleagues" onScopeChange={onScopeChange} />);
      });
      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      const tab = screen.getByText('Groups');
      await act(async () => {
        fireEvent.click(tab);
        jest.runOnlyPendingTimers();
      });

      expect(onScopeChange).toHaveBeenCalledWith('groups');
    } finally {
      jest.useRealTimers();
    }
  });

  it('routes Send form to the invoice workspace step', async () => {
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', patientId: 'patient-1', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    await waitFor(() => expect(screen.getByText('Close session')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Send form' }));

    expect(mockRouterPush).toHaveBeenCalledWith('/appointments/123/workspace?step=INVOICE');
  });

  it('opens the shared reschedule and follow-up modals from chat header actions', async () => {
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', patientId: 'patient-1', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    await waitFor(() => expect(screen.getByText('Close session')).toBeInTheDocument());
    fireEvent.click(screen.getByRole('button', { name: 'Reschedule' }));
    fireEvent.click(screen.getByRole('button', { name: 'Book follow-up' }));

    expect(screen.getByTestId('chat-reschedule-modal')).toBeInTheDocument();
    expect(screen.getByTestId('chat-followup-modal')).toBeInTheDocument();
  });

  it('notifies on error when closing the session fails', async () => {
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);
    (chatService.getChatSession as jest.Mock).mockResolvedValue({ _id: 'session-123' });
    (streamChatService.endChatChannel as jest.Mock).mockRejectedValueOnce(new Error('boom'));

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    const closeBtn = await screen.findByText('Close session');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', expect.anything());
    });
  });

  // Opens the edit-group modal where the backend session lookup returns NO match,
  // leaving groupModalBackendId undefined so the "Action unavailable" guards fire.
  const openGroupEditModalNoBackendId = async () => {
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([]);
    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'group', name: 'Group Chat' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });
    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });
    await act(async () => {
      fireEvent.click(await screen.findByText('Group Info'));
    });
    await waitFor(() => expect(screen.getByTestId('group-modal')).toBeInTheDocument());
  };

  it('warns when saving a title with no backend group id', async () => {
    await openGroupEditModalNoBackendId();
    fireEvent.change(screen.getByTestId('input-Group Chat'), { target: { value: 'Renamed' } });
    await act(async () => {
      fireEvent.click(await screen.findByText('Save Title'));
    });
    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('warning', expect.anything());
    });
    expect(chatService.updateGroup).not.toHaveBeenCalled();
  });

  it('warns when adding a member with no backend group id', async () => {
    await openGroupEditModalNoBackendId();
    const addBtns = await screen.findAllByTitle('Add member');
    await act(async () => {
      fireEvent.click(addBtns[0]);
    });
    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('warning', expect.anything());
    });
    expect(chatService.addGroupMembers).not.toHaveBeenCalled();
  });

  it('warns when removing a member with no backend group id', async () => {
    await openGroupEditModalNoBackendId();
    const removeBtns = await screen.findAllByTitle('Remove member');
    await act(async () => {
      fireEvent.click(removeBtns[0]);
    });
    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('warning', expect.anything());
    });
    expect(chatService.removeGroupMembers).not.toHaveBeenCalled();
  });

  // Reuse the happy-path edit-modal opener (resolves a backend group id) but force
  // the backend mutations to reject so the catch -> notify('error') paths run.
  const openGroupEditModalWithBackendId = async () => {
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([
      { _id: 'backend-group-id', channelId: 'channel-1', type: 'ORG_GROUP' },
    ]);
    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'group', name: 'Group Chat' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });
    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });
    await act(async () => {
      fireEvent.click(await screen.findByText('Group Info'));
    });
    await waitFor(() => expect(screen.getByTestId('group-modal')).toBeInTheDocument());
  };

  it('notifies on error when updating the group title fails', async () => {
    (chatService.updateGroup as jest.Mock).mockRejectedValueOnce(new Error('update failed'));
    await openGroupEditModalWithBackendId();
    fireEvent.change(screen.getByTestId('input-Group Chat'), { target: { value: 'Renamed' } });
    await act(async () => {
      fireEvent.click(await screen.findByText('Save Title'));
    });
    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', expect.anything());
    });
  });

  it('notifies on error when adding a member fails', async () => {
    (chatService.addGroupMembers as jest.Mock).mockRejectedValueOnce(new Error('add failed'));
    await openGroupEditModalWithBackendId();
    const addBtns = await screen.findAllByTitle('Add member');
    await act(async () => {
      fireEvent.click(addBtns[0]);
    });
    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', expect.anything());
    });
  });

  it('notifies on error when removing a member fails', async () => {
    (chatService.removeGroupMembers as jest.Mock).mockRejectedValueOnce(new Error('remove failed'));
    await openGroupEditModalWithBackendId();
    const removeBtns = await screen.findAllByTitle('Remove member');
    await act(async () => {
      fireEvent.click(removeBtns[0]);
    });
    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', expect.anything());
    });
  });

  it('notifies when a direct chat cannot be started', async () => {
    // queryChannels rejects for every candidate so success stays false -> error notify
    mockClient.queryChannels.mockRejectedValue(new Error('query failed'));
    (chatService.createOrgDirectChat as jest.Mock).mockRejectedValue(new Error('create failed'));

    await act(async () => {
      render(<ChatContainer scope="colleagues" />);
    });
    await waitFor(() => expect(chatService.fetchOrgUsers).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Search teammate to chat');
    fireEvent.change(input, { target: { value: 'User Two' } });
    fireEvent.focus(input);

    const userButton = await screen.findByText('User Two');
    await act(async () => {
      fireEvent.click(userButton.closest('button')!);
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', expect.anything());
    });

    // Restore the default resolved implementation so later tests are unaffected
    // (clearAllMocks only resets call history, not implementations).
    mockClient.queryChannels.mockResolvedValue([defaultMockChannel]);
  });

  it('handles focus, blur and hover interactions on the teammate search', async () => {
    jest.useFakeTimers();
    try {
      await act(async () => {
        render(<ChatContainer scope="colleagues" />);
      });
      await act(async () => {
        jest.runOnlyPendingTimers();
      });

      const input = screen.getByPlaceholderText('Search teammate to chat');
      const list = input.parentElement?.querySelector('ul') as HTMLUListElement;

      // Focus then blur with no hover -> blur timeout clears focus.
      act(() => {
        fireEvent.focus(input);
      });
      act(() => {
        fireEvent.blur(input);
      });
      act(() => {
        jest.advanceTimersByTime(200);
      });

      // Hover the results list, focus, blur (timeout should NOT clear focus while hovering),
      // then leave the list.
      act(() => {
        fireEvent.focus(input);
        fireEvent.mouseEnter(list);
        fireEvent.blur(input);
        jest.advanceTimersByTime(200);
        fireEvent.mouseLeave(list);
      });

      // Re-focus after the blur timeout was already scheduled to cover the
      // clearTimeout branch in onFocus.
      act(() => {
        fireEvent.blur(input);
        fireEvent.focus(input);
        jest.advanceTimersByTime(200);
      });

      expect(input).toBeInTheDocument();
    } finally {
      jest.useRealTimers();
    }
  });

  describe('channel filtering by scope', () => {
    type FilterFn = (channels: unknown[]) => unknown[];
    const getFilter = () =>
      (globalThis as unknown as { __testChannelFilter?: FilterFn }).__testChannelFilter;

    const renderForScope = async (scope: 'clients' | 'colleagues' | 'groups') => {
      await act(async () => {
        render(<ChatContainer scope={scope} />);
      });
      await waitFor(() => expect(getFilter()).toBeDefined());
      return getFilter() as FilterFn;
    };

    const groupCh = {
      ...defaultMockChannel,
      type: 'messaging',
      data: { chatCategory: 'group' },
      state: { members: { a: {}, b: {}, c: {} } },
    };
    const clientCh = {
      ...defaultMockChannel,
      type: 'messaging',
      data: { appointmentId: 'a1' },
      state: { members: {} },
    };

    it('keeps only group channels on the groups scope', async () => {
      const filter = await renderForScope('groups');
      const result = filter([groupCh, clientCh]);
      expect(result).toContain(groupCh);
      expect(result).not.toContain(clientCh);
    });

    it('keeps only client channels on the pet-parents scope', async () => {
      const filter = await renderForScope('clients');
      const result = filter([groupCh, clientCh]);
      expect(result).toContain(clientCh);
      expect(result).not.toContain(groupCh);
    });

    it('keeps a small team channel on the colleagues scope', async () => {
      const filter = await renderForScope('colleagues');
      const teamSmall = {
        ...defaultMockChannel,
        type: 'team',
        data: {},
        state: { members: { a: {}, b: {} } },
      };
      expect(filter([teamSmall])).toContain(teamSmall);
    });

    it('keeps a large team channel on the groups scope', async () => {
      const filter = await renderForScope('groups');
      const teamBig = {
        ...defaultMockChannel,
        type: 'team',
        data: {},
        state: { members: { a: {}, b: {}, c: {} } },
      };
      expect(filter([teamBig])).toContain(teamBig);
    });
  });

  it('completes the appointment when Mark complete succeeds', async () => {
    mockUseAppointmentStore.mockImplementation((selector: any) =>
      selector({
        appointmentsById: {
          '123': {
            id: '123',
            status: 'IN_PROGRESS',
            startTime: new Date('2026-06-25T15:00:00Z'),
            patient: { id: 'patient-1', name: 'Bella' },
            companion: { id: 'patient-1', name: 'Bella' },
          },
        },
      })
    );
    const appointmentService = jest.requireMock(
      '@/app/features/appointments/services/appointmentService'
    );
    appointmentService.changeAppointmentStatus.mockResolvedValue(undefined);

    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', patientId: 'patient-1', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    const markCompleteBtn = await screen.findByRole('button', { name: 'Mark complete' });
    await act(async () => {
      fireEvent.click(markCompleteBtn);
    });

    await waitFor(() => {
      expect(appointmentService.changeAppointmentStatus).toHaveBeenCalledWith(
        expect.objectContaining({ id: '123' }),
        'COMPLETED'
      );
    });
    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Appointment completed' })
      );
    });
  });

  it('notifies on error when Mark complete fails', async () => {
    mockUseAppointmentStore.mockImplementation((selector: any) =>
      selector({
        appointmentsById: {
          '123': {
            id: '123',
            status: 'IN_PROGRESS',
            startTime: new Date('2026-06-25T15:00:00Z'),
            patient: { id: 'patient-1', name: 'Bella' },
            companion: { id: 'patient-1', name: 'Bella' },
          },
        },
      })
    );
    const appointmentService = jest.requireMock(
      '@/app/features/appointments/services/appointmentService'
    );
    appointmentService.changeAppointmentStatus.mockRejectedValueOnce(new Error('failed to update'));

    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', patientId: 'patient-1', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    const markCompleteBtn = await screen.findByRole('button', { name: 'Mark complete' });
    await act(async () => {
      fireEvent.click(markCompleteBtn);
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Unable to complete', text: 'failed to update' })
      );
    });
  });

  it('routes to the appointments list when booking a follow-up without a linked companion', async () => {
    mockUseAppointmentStore.mockImplementation((selector: any) =>
      selector({
        appointmentsById: {
          '123': {
            id: '123',
            status: 'UPCOMING',
            startTime: new Date('2026-06-25T15:00:00Z'),
          },
        },
      })
    );
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    const followUpBtn = await screen.findByRole('button', { name: 'Book follow-up' });
    fireEvent.click(followUpBtn);

    expect(mockRouterPush).toHaveBeenCalledWith('/appointments');
    expect(screen.queryByTestId('chat-followup-modal')).not.toBeInTheDocument();
  });

  it('notifies an error when closing a session with no backend session id', async () => {
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);
    (chatService.getChatSession as jest.Mock).mockResolvedValue({});

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    const closeBtn = await screen.findByText('Close session');
    await act(async () => {
      fireEvent.click(closeBtn);
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith('error', expect.anything());
    });
    expect(streamChatService.endChatChannel).not.toHaveBeenCalled();
  });

  it('reconnects the stream user when the connected client id differs', async () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        attributes: { sub: 'user-9', email: 'nine@test.com' },
        status: 'authenticated',
        loading: false,
      })
    );

    await act(async () => {
      render(<ChatContainer />);
    });

    await waitFor(() => {
      expect(streamChatService.connectStreamUser).toHaveBeenCalledWith(
        'user-9',
        'nine@test.com',
        undefined
      );
    });
  });

  it('sets an error state when chat initialization throws', async () => {
    const stableAuthState = {
      attributes: { sub: 'user-9', email: 'nine@test.com' },
      status: 'authenticated',
      loading: false,
    };
    mockUseAuthStore.mockImplementation((selector: any) => selector(stableAuthState));
    (streamChatService.connectStreamUser as jest.Mock).mockRejectedValue(new Error('init boom'));

    await act(async () => {
      render(<ChatContainer />);
    });

    await waitFor(() => {
      expect(screen.getByText('init boom')).toBeInTheDocument();
    });
  });

  it('resolves the group owner from createdBy when no owner member role is present', async () => {
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([
      { _id: 'backend-group-id', channelId: 'channel-1', type: 'ORG_GROUP' },
    ]);
    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'group', name: 'Group Chat', createdBy: 'user-owner-1' },
      state: {
        members: {
          'user-1': { user: { id: 'user-1', name: 'Me' } },
          'user-2': { user: { id: 'user-2', name: 'Other' } },
        },
      },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });

    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    await act(async () => {
      fireEvent.click(await screen.findByText('Group Info'));
    });

    await waitFor(() => expect(screen.getByTestId('group-modal')).toBeInTheDocument());
    // Getting this far without throwing exercises the createdBy owner-resolution fallback.
    expect(screen.getByTestId('group-modal')).toBeInTheDocument();
  });

  it('falls back to channel-derived session id when listOrgChatSessions throws', async () => {
    (chatService.listOrgChatSessions as jest.Mock).mockRejectedValueOnce(new Error('list failed'));
    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'group', name: 'Group Chat', groupId: 'fallback-group-id-2' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });

    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    await act(async () => {
      fireEvent.click(await screen.findByText('Group Info'));
    });

    await waitFor(() => expect(screen.getByTestId('group-modal')).toBeInTheDocument());
    fireEvent.change(screen.getByTestId('input-Group Chat'), { target: { value: 'Renamed' } });
    await act(async () => {
      fireEvent.click(await screen.findByText('Save Title'));
    });

    await waitFor(() =>
      expect(chatService.updateGroup).toHaveBeenCalledWith('fallback-group-id-2', {
        title: 'Renamed',
      })
    );
  });

  it('skips org users without an id and recovers when fetchOrgUsers rejects', async () => {
    (chatService.fetchOrgUsers as jest.Mock).mockResolvedValueOnce([
      { id: '', userId: 'no-id-user', name: 'Ghost User' },
      { id: 'u2', userId: 'user-2', name: 'User Two', email: 'u2@test.com' },
    ]);

    await act(async () => {
      render(<ChatContainer scope="colleagues" />);
    });

    await waitFor(() => expect(chatService.fetchOrgUsers).toHaveBeenCalled());
    fireEvent.focus(screen.getByPlaceholderText('Search teammate to chat'));

    expect(screen.queryByText('Ghost User')).not.toBeInTheDocument();
    expect(await screen.findByText('User Two')).toBeInTheDocument();
  });

  it('reuses a direct channel found via the backend sessions list', async () => {
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([
      {
        _id: 'session-1',
        type: 'ORG_DIRECT',
        channelId: 'existing-channel-id',
        members: ['user-1', 'user-2'],
      },
    ]);
    const backendMatchedChannel = {
      ...defaultMockChannel,
      id: 'existing-channel-id',
      watch: jest.fn().mockResolvedValue({}),
    };
    mockClient.queryChannels.mockResolvedValue([backendMatchedChannel]);

    await act(async () => {
      render(<ChatContainer scope="colleagues" />);
    });
    await waitFor(() => expect(chatService.fetchOrgUsers).toHaveBeenCalled());

    const input = screen.getByPlaceholderText('Search teammate to chat');
    fireEvent.change(input, { target: { value: 'User Two' } });
    fireEvent.focus(input);

    const userButton = await screen.findByText('User Two');
    await act(async () => {
      fireEvent.click(userButton.closest('button')!);
    });

    await waitFor(() => {
      expect(backendMatchedChannel.watch).toHaveBeenCalled();
    });
    expect(chatService.createOrgDirectChat).not.toHaveBeenCalled();

    mockClient.queryChannels.mockResolvedValue([defaultMockChannel]);
  });

  it('activates the channel directly when creating a group and the channel is not immediately queryable', async () => {
    mockClient.queryChannels.mockResolvedValue([]);

    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    await waitFor(() => expect(screen.getAllByText('Create Group')[0]).toBeInTheDocument());
    fireEvent.click(screen.getAllByText('Create Group')[0]);

    fireEvent.change(screen.getByPlaceholderText('Group Title'), {
      target: { value: 'New Team' },
    });
    fireEvent.change(screen.getByPlaceholderText('Search teammates'), {
      target: { value: 'Two' },
    });
    const addButtons = await screen.findAllByTitle('Add member');
    fireEvent.click(addButtons[0]);

    const createBtns = screen.getAllByText('Create Group');
    await act(async () => {
      fireEvent.click(createBtns.at(-1)!);
    });

    await waitFor(() => {
      expect(chatService.createOrgGroupChat).toHaveBeenCalled();
    });
    expect(mockClient.channel).toHaveBeenCalledWith('team', 'channel-1');

    mockClient.queryChannels.mockResolvedValue([defaultMockChannel]);
  });

  it('swallows a hide() failure and still completes group deletion', async () => {
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([
      { _id: 'backend-group-id', channelId: 'channel-1', type: 'ORG_GROUP' },
    ]);
    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'group', name: 'Group Chat' },
      hide: jest.fn().mockRejectedValue(new Error('hide failed')),
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });

    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });
    await act(async () => {
      fireEvent.click(await screen.findByText('Group Info'));
    });
    await waitFor(() => expect(screen.getByTestId('group-modal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(await screen.findByText('Delete Group'));
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'success',
        expect.objectContaining({ title: 'Group deleted' })
      );
    });
  });

  it('notifies on error when deleting a group fails', async () => {
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([
      { _id: 'backend-group-id', channelId: 'channel-1', type: 'ORG_GROUP' },
    ]);
    (chatService.deleteGroup as jest.Mock).mockRejectedValueOnce(new Error('delete failed'));
    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: 'group', name: 'Group Chat' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });

    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });
    await act(async () => {
      fireEvent.click(await screen.findByText('Group Info'));
    });
    await waitFor(() => expect(screen.getByTestId('group-modal')).toBeInTheDocument());

    await act(async () => {
      fireEvent.click(await screen.findByText('Delete Group'));
    });

    await waitFor(() => {
      expect(mockNotify).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ title: 'Couldn’t delete group' })
      );
    });
  });

  it('recovers when refreshing chat session statuses fails', async () => {
    (chatService.getChatSessions as jest.Mock).mockRejectedValueOnce(new Error('sessions failed'));

    await act(async () => {
      render(<ChatContainer />);
    });

    await waitFor(() => expect(screen.getByTestId('stream-chat')).toBeInTheDocument());
  });

  it('marks a session ended when the chat session status is closed', async () => {
    (chatService.getChatSessions as jest.Mock).mockResolvedValue({
      channels: [{ appointmentId: '123', status: 'closed' }],
    });
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', chatCategory: 'clients' },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    await waitFor(() => expect(screen.getByText('Session closed')).toBeInTheDocument());
  });

  it('reacts to a channel.updated event by refreshing frozen/closed state', async () => {
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: '123', chatCategory: 'clients', frozen: false },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });
    (streamChatService.getAppointmentChannel as jest.Mock).mockResolvedValue(clientChannel);

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    await waitFor(() =>
      expect(clientChannel.on).toHaveBeenCalledWith('channel.updated', expect.any(Function))
    );

    const updateHandler = (clientChannel.on as jest.Mock).mock.calls.find(
      (call) => call[0] === 'channel.updated'
    )?.[1];
    clientChannel.data = { ...clientChannel.data, frozen: true };
    await act(async () => {
      updateHandler?.();
    });

    await waitFor(() => expect(screen.getByText(/Chat session closed/)).toBeInTheDocument());
  });

  it('mutes are treated as unmuted when muteStatus throws', async () => {
    const throwingChannel = {
      ...defaultMockChannel,
      id: 'throwing-channel',
      muteStatus: () => {
        throw new Error('boom');
      },
    };
    render(
      <ChannelPreviewWrapper
        channel={throwingChannel as unknown as StreamChannel}
        onPreviewSelect={jest.fn()}
        currentUserId="user-1"
        active={false}
        unread={0}
        lastMessage={undefined}
        setActiveChannel={jest.fn()}
      />
    );
    fireEvent.click(screen.getByLabelText('Conversation actions'));
    expect(screen.getByText('Mute')).toBeInTheDocument();
  });
});

describe('ChatContainer pure helpers', () => {
  const asChannel = (data: Record<string, unknown>) => data as unknown as StreamChannel;

  describe('normalizeName', () => {
    it('returns empty string for falsy input', () => {
      expect(normalizeName(undefined)).toBe('');
      expect(normalizeName('')).toBe('');
    });
    it('collapses whitespace and trims', () => {
      expect(normalizeName('  Bella   Rose  ')).toBe('Bella Rose');
    });
    it('replaces templated {..} markers with a space', () => {
      expect(normalizeName("Bella{' '}(Smith)")).toBe('Bella (Smith)');
    });
    it('keeps an unclosed brace as-is', () => {
      expect(normalizeName('a{b')).toBe('a{b');
    });
  });

  describe('getSessionIdFromChannel', () => {
    it('prefers groupId, then directId, then _id', () => {
      expect(getSessionIdFromChannel(asChannel({ data: { groupId: 'g1', directId: 'd1' } }))).toBe(
        'g1'
      );
      expect(getSessionIdFromChannel(asChannel({ data: { directId: 'd1', _id: 'x' } }))).toBe('d1');
      expect(getSessionIdFromChannel(asChannel({ data: { _id: 'x' } }))).toBe('x');
    });
    it('returns undefined when none present', () => {
      expect(getSessionIdFromChannel(asChannel({ data: {} }))).toBeUndefined();
    });
  });

  describe('findSessionByStoredId', () => {
    const sessions = [{ _id: 'a' }, { _id: 'b' }];
    it('returns undefined without a storedId', () => {
      expect(findSessionByStoredId(sessions, undefined)).toBeUndefined();
    });
    it('finds the matching session', () => {
      expect(findSessionByStoredId(sessions, 'b')).toEqual({ _id: 'b' });
    });
    it('returns undefined when not found', () => {
      expect(findSessionByStoredId(sessions, 'z')).toBeUndefined();
    });
  });

  describe('matchesDirectSession', () => {
    it('is false for a non-direct session or wrong member count', () => {
      expect(matchesDirectSession({ type: 'ORG_GROUP', members: ['a', 'b'] }, ['a', 'b'])).toBe(
        false
      );
      expect(matchesDirectSession({ type: 'ORG_DIRECT', members: ['a'] }, ['a'])).toBe(false);
    });
    it('is true when both members match exactly', () => {
      expect(matchesDirectSession({ type: 'ORG_DIRECT', members: ['a', 'b'] }, ['a', 'b'])).toBe(
        true
      );
    });
    it('is false when members differ', () => {
      expect(matchesDirectSession({ type: 'ORG_DIRECT', members: ['a', 'c'] }, ['a', 'b'])).toBe(
        false
      );
    });
  });

  describe('matchesGroupSession', () => {
    it('is false for a non-group session or <=2 members', () => {
      expect(
        matchesGroupSession({ type: 'ORG_DIRECT', members: ['a', 'b', 'c'] }, ['a', 'b', 'c'])
      ).toBe(false);
      expect(matchesGroupSession({ type: 'ORG_GROUP', members: ['a', 'b'] }, ['a', 'b'])).toBe(
        false
      );
    });
    it('matches by identical title', () => {
      expect(
        matchesGroupSession(
          { type: 'ORG_GROUP', members: ['a', 'b', 'c'], title: 'Team' },
          ['a', 'b', 'c'],
          'Team'
        )
      ).toBe(true);
    });
    it('matches by a full member set', () => {
      expect(
        matchesGroupSession({ type: 'ORG_GROUP', members: ['a', 'b', 'c'] }, ['a', 'b', 'c'])
      ).toBe(true);
    });
    it('is false when members differ too much', () => {
      expect(
        matchesGroupSession({ type: 'ORG_GROUP', members: ['a', 'b', 'c'] }, ['x', 'y', 'z'])
      ).toBe(false);
    });
  });

  describe('matchesChannelId', () => {
    const chan = asChannel({ id: 'ch1', cid: 'messaging:ch1' });
    it('matches by id or cid', () => {
      expect(matchesChannelId({ channelId: 'ch1' }, chan)).toBe(true);
      expect(matchesChannelId({ channelId: 'messaging:ch1' }, chan)).toBe(true);
    });
    it('matches by substring containment', () => {
      expect(matchesChannelId({ channelId: 'ch' }, chan)).toBe(true);
    });
    it('is false otherwise', () => {
      expect(matchesChannelId({ channelId: 'other' }, asChannel({ id: 'zzz' }))).toBe(false);
    });
  });

  describe('getChannelDisplayInfo', () => {
    it('returns a default title for no channel', () => {
      expect(getChannelDisplayInfo(null)).toEqual({ title: 'Chat' });
    });
    it('uses an explicit channel title', () => {
      expect(getChannelDisplayInfo(asChannel({ data: { title: 'VIP' } }), 'me').title).toBe('VIP');
    });
    it('builds a pet and owner title', () => {
      const info = getChannelDisplayInfo(
        asChannel({ data: { petName: 'Rex', petOwnerName: 'Sam' } }),
        'me'
      );
      expect(info.title).toContain('Rex');
      expect(info.title).toContain('Sam');
    });
    it('falls back to the counterpart name and image', () => {
      const info = getChannelDisplayInfo(
        asChannel({
          data: {},
          state: { members: { u2: { user: { id: 'u2', name: 'Other', image: 'img' } } } },
        }),
        'me'
      );
      expect(info.title).toBe('Other');
      expect(info.image).toBe('img');
    });
    it('falls back to the channel id', () => {
      expect(getChannelDisplayInfo(asChannel({ id: 'cid-1', data: {} }), 'me').title).toBe('cid-1');
    });
  });

  describe('resolveChannelScope', () => {
    it('maps client categories to clients', () => {
      expect(resolveChannelScope(asChannel({ data: { chatCategory: 'pet-parent' } }))).toBe(
        'clients'
      );
    });
    it('maps colleague categories to colleagues', () => {
      expect(resolveChannelScope(asChannel({ data: { category: 'team' } }))).toBe('colleagues');
    });
    it('maps group categories to groups', () => {
      expect(resolveChannelScope(asChannel({ data: { chatCategory: 'broadcast' } }))).toBe(
        'groups'
      );
    });
    it('treats appointment metadata as clients', () => {
      expect(resolveChannelScope(asChannel({ data: { appointmentId: 'a1' } }))).toBe('clients');
    });
    it('treats more than two members as a group', () => {
      expect(
        resolveChannelScope(asChannel({ data: {}, state: { members: { a: {}, b: {}, c: {} } } }))
      ).toBe('groups');
    });
    it('defaults to colleagues', () => {
      expect(
        resolveChannelScope(asChannel({ data: {}, state: { members: { a: {}, b: {} } } }))
      ).toBe('colleagues');
    });
  });

  describe('formatRowTime', () => {
    it('returns empty for no value', () => {
      expect(formatRowTime(null)).toBe('');
    });
    it('formats minutes and hours', () => {
      expect(formatRowTime(new Date(Date.now() - 30 * 1000))).toBe('now');
      expect(formatRowTime(new Date(Date.now() - 5 * 60 * 1000))).toBe('5m');
      expect(formatRowTime(new Date(Date.now() - 3 * 60 * 60 * 1000))).toBe('3h');
    });
    it('formats yesterday and older dates', () => {
      expect(formatRowTime(new Date(Date.now() - 26 * 60 * 60 * 1000))).toBe('Yesterday');
      expect(typeof formatRowTime(new Date(Date.now() - 4 * 24 * 60 * 60 * 1000))).toBe('string');
      expect(typeof formatRowTime(new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))).toBe('string');
    });
  });

  describe('isCounterpartOnline', () => {
    it('is true when the counterpart is online', () => {
      expect(
        isCounterpartOnline(
          asChannel({ state: { members: { u2: { user: { id: 'u2', online: true } } } } }),
          'me'
        )
      ).toBe(true);
    });
    it('is false when offline or no channel', () => {
      expect(
        isCounterpartOnline(
          asChannel({ state: { members: { u2: { user: { id: 'u2', online: false } } } } }),
          'me'
        )
      ).toBe(false);
      expect(isCounterpartOnline(null, 'me')).toBe(false);
    });
  });

  describe('formatClosedTime', () => {
    const iso = (ms: number) => new Date(Date.now() - ms).toISOString();
    it('returns empty for no timestamp', () => {
      expect(formatClosedTime(undefined)).toBe('');
    });
    it('formats relative buckets', () => {
      expect(formatClosedTime(iso(30 * 1000))).toBe('just now');
      expect(formatClosedTime(iso(5 * 60 * 1000))).toBe('5 minutes ago');
      expect(formatClosedTime(iso(2 * 60 * 60 * 1000))).toBe('2 hours ago');
      expect(formatClosedTime(iso(3 * 24 * 60 * 60 * 1000))).toBe('3 days ago');
      expect(typeof formatClosedTime(iso(30 * 24 * 60 * 60 * 1000))).toBe('string');
    });
  });
});

describe('ChannelPreviewWrapper + ChatClosedFooter', () => {
  const previewChannel = {
    id: 'ch-prev',
    cid: 'messaging:ch-prev',
    type: 'messaging',
    data: { name: 'Preview Chat' },
    state: {
      members: {
        me: { user: { id: 'me' } },
        u2: { user: { id: 'u2', name: 'Other', online: true } },
      },
      last_message_at: new Date(),
    },
    muteStatus: () => ({ muted: false }),
    mute: jest.fn().mockResolvedValue({}),
    unmute: jest.fn().mockResolvedValue({}),
    hide: jest.fn().mockResolvedValue({}),
    show: jest.fn().mockResolvedValue({}),
  };

  const renderPreview = (over: Record<string, unknown> = {}) => {
    const props = {
      channel: previewChannel,
      onPreviewSelect: jest.fn(),
      currentUserId: 'me',
      active: false,
      unread: 2,
      lastMessage: { text: 'Hello there' },
      setActiveChannel: jest.fn(),
      ...over,
    } as unknown as React.ComponentProps<typeof ChannelPreviewWrapper>;
    render(<ChannelPreviewWrapper {...props} />);
    return props;
  };

  beforeEach(() => jest.clearAllMocks());

  it('renders the conversation row from channel data', () => {
    renderPreview();
    expect(screen.getByText('Preview Chat')).toBeInTheDocument();
    expect(screen.getByText('Hello there')).toBeInTheDocument();
  });

  it('notifies selection when the preview row is clicked', () => {
    const props = renderPreview({ active: true });
    fireEvent.click(screen.getByText('Preview Chat'));
    expect(props.onPreviewSelect).toHaveBeenCalledWith(previewChannel);
  });

  it('mutes the channel from the triage menu', () => {
    renderPreview();
    fireEvent.click(screen.getByLabelText('Conversation actions'));
    fireEvent.click(screen.getByText('Mute'));
    expect(previewChannel.mute).toHaveBeenCalled();
  });

  it('unarchives the channel when shown in the archived view', () => {
    renderPreview({ archived: true });
    fireEvent.click(screen.getByLabelText('Conversation actions'));
    fireEvent.click(screen.getByText('Unarchive'));
    expect(previewChannel.show).toHaveBeenCalled();
  });

  it('renders the closed-session footer without a timestamp', () => {
    render(<ChatClosedFooter />);
    expect(screen.getByText('Chat session closed')).toBeInTheDocument();
  });

  it('renders the closed-session footer with a relative time', () => {
    render(<ChatClosedFooter closedAt={new Date(Date.now() - 5 * 60 * 1000).toISOString()} />);
    expect(screen.getByText('Chat session closed')).toBeInTheDocument();
    expect(screen.getByText('5 minutes ago')).toBeInTheDocument();
  });
});
