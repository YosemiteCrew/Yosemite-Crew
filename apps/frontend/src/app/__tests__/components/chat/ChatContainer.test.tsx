import React from "react";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  act,
  within,
} from "@testing-library/react";
import { ChatContainer } from "../../../components/chat/ChatContainer";
import * as streamChatService from "@/app/services/streamChatService";

// --- Mocks ---

// 1. Mock Stores
const mockAuthState: any = {
  attributes: null,
  status: "checking",
  loading: false,
};
const mockOrgState: any = {
  primaryOrgId: null,
  status: "idle",
};

jest.mock("@/app/stores/authStore", () => {
  const useAuthStore: any = jest.fn((selector?: any) =>
    selector ? selector(mockAuthState) : mockAuthState
  );
  useAuthStore.getState = jest.fn(() => mockAuthState);
  return { useAuthStore };
});

jest.mock("@/app/stores/orgStore", () => {
  const useOrgStore: any = jest.fn((selector?: any) =>
    selector ? selector(mockOrgState) : mockOrgState
  );
  useOrgStore.getState = jest.fn(() => mockOrgState);
  return { useOrgStore };
});

// 2. Mock Services
jest.mock("@/app/services/streamChatService", () => ({
  getChatClient: jest.fn(),
  connectStreamUser: jest.fn(),
  endChatChannel: jest.fn(),
}));

// 3. Mock Stream Chat Client
const mockChannelOn = jest.fn();
const mockChannelOff = jest.fn();
const mockChannelWatch = jest.fn().mockResolvedValue({});
const mockChannel = {
  id: "channel-1",
  data: {
    name: "Test Channel",
    petName: "Buddy",
    petOwnerName: "John Doe",
    status: "active",
    frozen: false,
    appointmentId: "appt-123",
  },
  state: { members: {} },
  on: mockChannelOn,
  off: mockChannelOff,
  watch: mockChannelWatch,
};

const mockClient = {
  userID: "user-123",
  channel: jest.fn(() => mockChannel),
  connectUser: jest.fn(),
  disconnectUser: jest.fn(),
};

// 4. Mock Stream Chat React Components
jest.mock("stream-chat-react", () => {
  // Removed 'require("react")' to fix lint error.
  // Modern JSX transform (React 17+) does not require React to be in scope.
  return {
    Chat: ({ children }: any) => (
      <div data-testid="stream-chat">{children}</div>
    ),
    Channel: ({ children }: any) => (
      <div data-testid="stream-channel">{children}</div>
    ),
    ChannelList: ({ Preview }: any) => (
      <div data-testid="stream-channel-list">
        {/* Render the Preview component passing the mock channel to simulate list items */}
        {Preview && <Preview channel={mockChannel} />}
      </div>
    ),
    Window: ({ children }: any) => (
      <div data-testid="stream-window">{children}</div>
    ),
    ChannelHeader: ({ title }: any) => (
      <div data-testid="stream-channel-header">{title}</div>
    ),
    MessageList: () => <div data-testid="stream-message-list">Messages</div>,
    MessageInput: () => <div data-testid="stream-message-input">Input</div>,
    Thread: () => <div data-testid="stream-thread">Thread</div>,
    LoadingIndicator: () => (
      <div data-testid="loading-indicator">Loading...</div>
    ),
    ChannelPreviewMessenger: ({ displayTitle }: any) => (
      <span data-testid="preview-messenger">{displayTitle}</span>
    ),
    useChannelStateContext: () => ({ channel: mockChannel }),
  };
});

// 5. Mock Guard Components
jest.mock("../../../components/ProtectedRoute", () => ({ children }: any) => (
  <div>{children}</div>
));
jest.mock("../../../components/OrgGuard", () => ({ children }: any) => (
  <div>{children}</div>
));

describe("ChatContainer Component", () => {
  const setupStoreSuccess = () => {
    mockAuthState.attributes = {
      sub: "user-123",
      email: "test@example.com",
      given_name: "Test",
      family_name: "User",
    };
    mockAuthState.status = "authenticated";
    mockAuthState.loading = false;

    mockOrgState.primaryOrgId = "org-1";
    mockOrgState.status = "loaded";

    (streamChatService.getChatClient as jest.Mock).mockReturnValue(mockClient);
    (streamChatService.connectStreamUser as jest.Mock).mockResolvedValue({});
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthState.attributes = null;
    mockAuthState.status = "checking";
    mockAuthState.loading = false;
    mockOrgState.primaryOrgId = null;
    mockOrgState.status = "idle";
    Object.defineProperty(globalThis, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1024,
    });
  });

  // --- Section 1: Initialization & Loading ---

  it("renders loading indicator initially (async connect)", async () => {
    setupStoreSuccess();
    // Force async connect: Client ID mismatch requires connectStreamUser call
    (streamChatService.getChatClient as jest.Mock).mockReturnValue({
      ...mockClient,
      userID: "different-id",
    });
    // Hold the promise to keep it loading
    (streamChatService.connectStreamUser as jest.Mock).mockReturnValue(
      new Promise(() => {})
    );

    render(<ChatContainer />);

    expect(await screen.findByTestId("chat-loader")).toBeInTheDocument();
  });

  it("keeps loading while user profile is not ready", async () => {
    mockAuthState.attributes = null;
    mockAuthState.status = "checking";
    mockOrgState.primaryOrgId = "org-1";
    mockOrgState.status = "loaded";

    render(<ChatContainer />);

    expect(await screen.findByTestId("chat-loader")).toBeInTheDocument();
  });

  it("renders error if connection fails", async () => {
    mockAuthState.attributes = { sub: "user-123", email: "test@example.com" };
    mockAuthState.status = "authenticated";
    mockOrgState.primaryOrgId = "org-1";
    mockOrgState.status = "loaded";
    (streamChatService.getChatClient as jest.Mock).mockReturnValue({
      ...mockClient,
      userID: "different-id",
    });
    (streamChatService.connectStreamUser as jest.Mock).mockRejectedValue(
      new Error("Connection failed")
    );

    render(<ChatContainer />);

    await waitFor(() => {
      expect(screen.getByText("Connection failed")).toBeInTheDocument();
    });
  });

  // --- Section 2: Rendering & Navigation (Desktop/Mobile) ---

  it("renders ChatLayout with ChannelList on desktop success", async () => {
    setupStoreSuccess();

    render(<ChatContainer />);

    await waitFor(() => {
      expect(screen.getByTestId("stream-chat")).toBeInTheDocument();
      expect(screen.getByTestId("stream-channel-list")).toBeVisible();
    });
  });

  it("handles mobile view switching", async () => {
    setupStoreSuccess();

    act(() => {
      window.innerWidth = 500;
      globalThis.dispatchEvent(new Event("resize"));
    });

    render(<ChatContainer />);

    await waitFor(() =>
      expect(screen.getByTestId("stream-channel-list")).toBeInTheDocument()
    );

    const channelList = screen.getByTestId("stream-channel-list");
    const previewSpan = within(channelList).getByTestId("preview-messenger");
    const previewButton = previewSpan.closest("[role='button']");

    expect(previewButton).toBeInTheDocument();
    fireEvent.click(previewButton!);

    const backBtn = screen.getByText("← Back");
    expect(backBtn).toBeInTheDocument();

    fireEvent.click(backBtn);
    expect(screen.queryByText("← Back")).not.toBeInTheDocument();
  });

  // --- Section 3: Custom Header & Session Management ---

  it("renders custom header and closes session", async () => {
    setupStoreSuccess();
    render(<ChatContainer />);
    await waitFor(() => screen.getByTestId("stream-chat"));

    const header = screen.getByTestId("stream-channel-header");
    expect(header).toHaveTextContent("Test Channel");

    const closeBtn = screen.getByText("Close Session");
    expect(closeBtn).toBeInTheDocument();

    globalThis.confirm = jest.fn(() => true);
    globalThis.alert = jest.fn();
    (streamChatService.endChatChannel as jest.Mock).mockResolvedValue({});

    fireEvent.click(closeBtn);

    expect(globalThis.confirm).toHaveBeenCalled();
    expect(streamChatService.endChatChannel).toHaveBeenCalledWith("appt-123");

    await waitFor(() => {
      expect(screen.getByText("Session Closed")).toBeInTheDocument();
      expect(screen.queryByText("Close Session")).not.toBeInTheDocument();
    });
  });

  it("handles close session cancellation", async () => {
    setupStoreSuccess();
    render(<ChatContainer />);
    await waitFor(() => screen.getByTestId("stream-chat"));

    const closeBtn = screen.getByText("Close Session");

    globalThis.confirm = jest.fn(() => false);
    fireEvent.click(closeBtn);

    expect(streamChatService.endChatChannel).not.toHaveBeenCalled();
  });

  it("renders closed footer when channel is frozen", async () => {
    setupStoreSuccess();

    mockChannel.data.frozen = true;
    mockChannel.data.status = "ended";

    render(<ChatContainer />);
    await waitFor(() => screen.getByTestId("stream-chat"));

    expect(screen.getByText("Session Closed")).toBeInTheDocument();
    expect(screen.getByText("Chat session closed")).toBeInTheDocument();
  });

  // --- Section 4: Specific Appointment Mode & Routing ---

  it("renders specific appointment channel when appointmentId prop is provided", async () => {
    setupStoreSuccess();
    const apptId = "specific-appt-1";

    render(<ChatContainer appointmentId={apptId} />);

    await waitFor(() => {
      expect(
        screen.queryByTestId("stream-channel-list")
      ).not.toBeInTheDocument();
      expect(screen.getByTestId("stream-channel")).toBeInTheDocument();
    });

    expect(mockClient.channel).toHaveBeenCalledWith(
      "messaging",
      `appointment-${apptId}`
    );
  });

  it("renders ProtectedChatContainer guard wrapper", async () => {
    setupStoreSuccess();
    (streamChatService.getChatClient as jest.Mock).mockReturnValue({
      ...mockClient,
      userID: "different-id",
    });
    (streamChatService.connectStreamUser as jest.Mock).mockReturnValue(
      new Promise(() => {})
    );

    // FIX: Renamed variable from 'module' to 'chatModule' to avoid lint error
    const chatModule = await import("../../../components/chat/ChatContainer");
    const ProtectedComponent = chatModule.default;

    render(<ProtectedComponent />);

    expect(await screen.findByTestId("chat-loader")).toBeInTheDocument();
  });
});
