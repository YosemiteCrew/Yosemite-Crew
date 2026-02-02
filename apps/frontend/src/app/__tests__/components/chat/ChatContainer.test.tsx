import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
} from "@testing-library/react";
import ProtectedChatContainer, {
  ChatContainer,
} from "@/app/features/chat/components/ChatContainer";
import * as streamChatService from "@/app/features/chat/services/streamChatService";
import * as chatService from "@/app/features/chat/services/chatService";
import { useAuthStore } from "@/app/stores/authStore";
import { useOrgStore } from "@/app/stores/orgStore";
import { useChannelStateContext } from "stream-chat-react";

// ----------------------------------------------------------------------------
// 1. Mocks & Setup
// ----------------------------------------------------------------------------

// Mock Stores
jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: jest.fn(),
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: jest.fn(),
}));

// Mock Services
jest.mock("@/app/features/chat/services/streamChatService", () => ({
  getChatClient: jest.fn(),
  connectStreamUser: jest.fn(),
  endChatChannel: jest.fn(),
}));

jest.mock("@/app/features/chat/services/chatService", () => ({
  createOrgDirectChat: jest.fn(),
  createOrgGroupChat: jest.fn(),
  fetchOrgUsers: jest.fn(),
  addGroupMembers: jest.fn(),
  removeGroupMembers: jest.fn(),
  updateGroup: jest.fn(),
  deleteGroup: jest.fn(),
  listOrgChatSessions: jest.fn(),
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
  id: "channel-1",
  cid: "messaging:channel-1",
  type: "messaging",
  data: { name: "Test Channel", member_count: 2 },
  state: {
    members: {
      "user-1": { user: { id: "user-1", name: "Me" }, role: "owner" },
      "user-2": { user: { id: "user-2", name: "Other" } },
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
jest.mock("stream-chat-react", () => {
  return {
    Chat: ({ children }: any) => (
      <div data-testid="stream-chat">{children}</div>
    ),
    Channel: ({ children }: any) => (
      <div data-testid="stream-channel">{children}</div>
    ),
    ChannelList: ({ filters, channelRenderFilterFn }: any) => {
      if (channelRenderFilterFn) {
        (window as any).__testChannelFilter = channelRenderFilterFn;
      }
      return <div data-testid="channel-list">Channel List</div>;
    },
    ChannelHeader: ({ title }: any) => (
      <div data-testid="channel-header">{title}</div>
    ),
    MessageList: () => <div data-testid="message-list" />,
    MessageInput: () => <div data-testid="message-input" />,
    Thread: () => <div data-testid="thread" />,
    Window: ({ children }: any) => (
      <div data-testid="chat-window">{children}</div>
    ),
    ChannelPreviewMessenger: ({ displayTitle }: any) => (
      <div>{displayTitle}</div>
    ),
    useChannelStateContext: jest.fn(),
  };
});

// Mock UI Components
jest.mock("@/app/ui/overlays/Loader", () => ({
  YosemiteLoader: () => <div data-testid="loader">Loading...</div>,
}));

jest.mock("@/app/ui/overlays/Modal", () => ({
  __esModule: true,
  default: ({ showModal, children }: any) =>
    showModal ? <div data-testid="group-modal">{children}</div> : null,
}));

jest.mock("@/app/ui/inputs/FormInput/FormInput", () => ({
  __esModule: true,
  default: ({ value, onChange, onFocus, onBlur, inlabel }: any) => (
    <input
      data-testid={`input-${inlabel || "search"}`}
      value={value}
      onChange={onChange}
      onFocus={onFocus}
      onBlur={onBlur}
      placeholder={inlabel}
    />
  ),
}));

jest.mock("@/app/ui/primitives/Icons/Close", () => ({
  __esModule: true,
  default: ({ onClick }: any) => (
    <button onClick={onClick} data-testid="close-icon">
      X
    </button>
  ),
}));

jest.mock("@/app/ui/layout/guards/ProtectedRoute", () => ({
  __esModule: true,
  default: ({ children }: any) => (
    <div data-testid="protected-route">{children}</div>
  ),
}));

jest.mock("@/app/ui/layout/guards/OrgGuard", () => ({
  __esModule: true,
  default: ({ children }: any) => <div data-testid="org-guard">{children}</div>,
}));

const mockClient = {
  userID: "user-1",
  channel: jest.fn(() => defaultMockChannel),
  queryChannels: jest.fn().mockResolvedValue([defaultMockChannel]),
};

describe("ChatContainer", () => {
  const mockUseAuthStore = useAuthStore as unknown as jest.Mock;
  const mockUseOrgStore = useOrgStore as unknown as jest.Mock;
  const mockUseChannelStateContext =
    useChannelStateContext as unknown as jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    (streamChatService.getChatClient as jest.Mock).mockReturnValue(mockClient);

    // Default mock context return
    mockUseChannelStateContext.mockReturnValue({ channel: defaultMockChannel });

    // Default Store State
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        attributes: { sub: "user-1", email: "test@test.com" },
        status: "authenticated",
        loading: false,
      }),
    );

    mockUseOrgStore.mockImplementation((selector: any) =>
      selector({
        primaryOrgId: "org-1",
        status: "loaded",
      }),
    );

    // Service Defaults
    (chatService.fetchOrgUsers as jest.Mock).mockResolvedValue([
      { id: "u2", userId: "user-2", name: "User Two", email: "u2@test.com" },
      { id: "u3", userId: "user-3", name: "User Three", email: "u3@test.com" },
    ]);
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([]);

    // Mock Create Group response
    (chatService.createOrgGroupChat as jest.Mock).mockResolvedValue({
      _id: "group-1",
      channelId: "channel-1",
      title: "New Team",
      organisationId: "org-1",
      createdBy: "user-1",
      type: "ORG_GROUP",
    });

    // Mock Create Direct Chat response
    (chatService.createOrgDirectChat as jest.Mock).mockResolvedValue({
      _id: "direct-1",
      channelId: "channel-direct-1",
      title: "User Two",
      organisationId: "org-1",
      createdBy: "user-1",
      type: "ORG_DIRECT",
    });
  });

  // --------------------------------------------------------------------------
  // Tests
  // --------------------------------------------------------------------------

  it("renders loader while initializing", () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        status: "checking",
        loading: true,
      }),
    );
    render(<ChatContainer />);
    expect(screen.getByTestId("loader")).toBeInTheDocument();
  });

  it("renders error state if auth fails", () => {
    mockUseAuthStore.mockImplementation((selector: any) =>
      selector({
        status: "unauthenticated",
      }),
    );
    render(<ChatContainer />);
    expect(screen.getByText(/User not authenticated/)).toBeInTheDocument();
  });

  it("renders chat layout when initialized", async () => {
    await act(async () => {
      render(<ChatContainer />);
    });
    await waitFor(() =>
      expect(screen.getByTestId("stream-chat")).toBeInTheDocument(),
    );
    expect(screen.getByTestId("channel-list")).toBeInTheDocument();
  });

  it("renders empty state placeholder when scope changes", async () => {
    const { rerender } = render(<ChatContainer scope="colleagues" />);

    await act(async () => {
      rerender(<ChatContainer scope="clients" />);
    });

    await waitFor(() =>
      expect(
        screen.getByText("Select a conversation to start chatting"),
      ).toBeInTheDocument(),
    );
  });

  it("searches and starts direct chat (creates new)", async () => {
    // Force queryChannels to return empty so it doesn't find existing chat
    mockClient.queryChannels.mockResolvedValue([]);

    await act(async () => {
      render(<ChatContainer scope="colleagues" />);
    });
    await waitFor(() => expect(chatService.fetchOrgUsers).toHaveBeenCalled());

    const input = screen.getByPlaceholderText("Search teammate to chat");
    fireEvent.change(input, { target: { value: "User Two" } });
    fireEvent.focus(input);

    const userButton = await screen.findByText("User Two");

    await act(async () => {
      fireEvent.click(userButton.closest("button")!);
    });

    await waitFor(() => {
      expect(chatService.createOrgDirectChat).toHaveBeenCalledWith(
        expect.objectContaining({
          otherUserId: "user-2",
        }),
      );
    });
  });

  it("creates a group via modal", async () => {
    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    // The "Create Group" button in the header
    await waitFor(() =>
      expect(screen.getAllByText("Create Group")[0]).toBeInTheDocument(),
    );
    fireEvent.click(screen.getAllByText("Create Group")[0]);

    // Modal opens
    expect(screen.getByTestId("group-modal")).toBeInTheDocument();

    const titleInput = screen.getByPlaceholderText("Group Title");
    fireEvent.change(titleInput, { target: { value: "New Team" } });

    const searchInput = screen.getByPlaceholderText("Search teammates");
    fireEvent.change(searchInput, { target: { value: "Two" } });
    const addButton = await screen.findAllByTitle("Add member");
    fireEvent.click(addButton[0]);

    // Click "Create Group" inside modal (last one)
    const createBtns = screen.getAllByText("Create Group");
    await act(async () => {
      fireEvent.click(createBtns.at(-1)!);
    });

    await waitFor(() => {
      expect(chatService.createOrgGroupChat).toHaveBeenCalled();
    });
  });

  it("handles delete group", async () => {
    // 1. Force the current channel context to be a group so "Group Info" appears
    const groupChannel = {
      ...defaultMockChannel,
      data: { chatCategory: "group", name: "Group Chat" },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: groupChannel });

    // 2. Render with group scope
    await act(async () => {
      render(<ChatContainer scope="groups" />);
    });

    await waitFor(() =>
      expect(screen.getByTestId("channel-list")).toBeInTheDocument(),
    );

    // 3. Find Group Info button (might need wait if render is async)
    const groupInfoBtn = await screen.findByText("Group Info");

    // 4. Click Group Info to open modal in EDIT mode
    await act(async () => {
      fireEvent.click(groupInfoBtn);
    });

    // 5. Mock backend finding the session so delete is enabled.
    // This needs to resolve BEFORE we check for the delete button,
    // but after the modal logic fires listOrgChatSessions.
    (chatService.listOrgChatSessions as jest.Mock).mockResolvedValue([
      {
        _id: "backend-group-id",
        channelId: groupChannel.id,
        type: "ORG_GROUP",
      },
    ]);

    // Wait for the modal content to fully render (async backend ID fetch)
    await waitFor(() =>
      expect(screen.getByTestId("group-modal")).toBeInTheDocument(),
    );

    // Wait a tick for the async session ID resolution inside the component
    await waitFor(() => {}, { timeout: 100 });

    const deleteBtn = screen.getByText("Delete Group");

    await act(async () => {
      fireEvent.click(deleteBtn);
    });
  });

  it("filters channels correctly based on scope", async () => {
    await act(async () => {
      render(<ChatContainer scope="clients" />);
    });
    await waitFor(() =>
      expect(screen.getByTestId("channel-list")).toBeInTheDocument(),
    );

    const filterFn = (globalThis as any).__testChannelFilter;

    const clientChannel = {
      ...defaultMockChannel,
      data: { chatCategory: "clients" },
    };
    expect(filterFn([clientChannel])).toHaveLength(1);

    const colleagueChannel = {
      ...defaultMockChannel,
      data: { chatCategory: "colleagues" },
    };
    expect(filterFn([colleagueChannel])).toHaveLength(0);
  });

  it("renders specific appointment channel if ID provided", async () => {
    // Inject appointment context
    mockUseChannelStateContext.mockReturnValue({
      channel: { ...defaultMockChannel, data: { appointmentId: "123" } },
    });

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    await waitFor(() => {
      expect(mockClient.channel).toHaveBeenCalledWith(
        "messaging",
        "appointment-123",
      );
    });

    expect(screen.queryByTestId("channel-list")).not.toBeInTheDocument();
  });

  it("handles closing session", async () => {
    // Force context to be client chat so "Close Session" appears
    const clientChannel = {
      ...defaultMockChannel,
      data: { appointmentId: "123", chatCategory: "clients" },
    };
    mockUseChannelStateContext.mockReturnValue({ channel: clientChannel });

    await act(async () => {
      render(<ChatContainer appointmentId="123" />);
    });

    await waitFor(() =>
      expect(screen.getByText("Close Session")).toBeInTheDocument(),
    );

    await act(async () => {
      fireEvent.click(screen.getByText("Close Session"));
    });

    await waitFor(() => {
      expect(streamChatService.endChatChannel).toHaveBeenCalledWith("123");
    });
  });

  it("ProtectedChatContainer wraps with guards", async () => {
    await act(async () => {
      render(<ProtectedChatContainer />);
    });
    expect(screen.getByTestId("protected-route")).toBeInTheDocument();
    expect(screen.getByTestId("org-guard")).toBeInTheDocument();
  });
});
