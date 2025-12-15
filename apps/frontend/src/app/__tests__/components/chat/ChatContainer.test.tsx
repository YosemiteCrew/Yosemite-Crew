'use client';

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

// Define createMockChannel early so it can be used in mocks
const createMockChannel = (id: string = "chan") => {
  const listeners: Record<string, Array<(data: unknown) => void>> = {};
  return {
    id,
    on: jest.fn((event: string, listener: (data: unknown) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(listener);
      return listeners; // Stream SDK returns the listeners object
    }),
    off: jest.fn((event: string, listener: (data: unknown) => void) => {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(l => l !== listener);
      }
      return listeners;
    }),
    state: { members: {} },
    watch: jest.fn().mockResolvedValue(undefined),
  };
};

const mockChannelList = jest.fn();

jest.mock("stream-chat-react", () => {
  const ChannelList = ({ Preview, ...props }: any) => {
    mockChannelList(props);
    return (
      <div data-testid="channel-list">
        {Preview ? (
          <Preview
            {...props}
            channel={{ id: "preview-channel" }}
            onSelect={jest.fn()}
          />
        ) : null}
      </div>
    );
  };

  const createPlaceholder =
    (testId: string) =>
    ({ children }: { children?: React.ReactNode }) =>
      <div data-testid={testId}>{children}</div>;

  return {
    Chat: createPlaceholder("stream-chat"),
    Channel: createPlaceholder("stream-channel"),
    ChannelHeader: () => <div data-testid="channel-header" />,
    ChannelList,
    ChannelPreviewMessenger: ({ channel }: any) => (
      <div data-testid="preview-messenger">{channel?.id ?? "no-channel"}</div>
    ),
    LoadingIndicator: ({ size }: { size?: number }) => (
      <div data-testid="chat-loading">loading-{size}</div>
    ),
    MessageInput: () => <div data-testid="message-input" />,
    MessageList: () => <div data-testid="message-list" />,
    Thread: () => <div data-testid="thread" />,
    Window: createPlaceholder("chat-window"),
    useChannelStateContext: () => ({
      channel: createMockChannel("preview-channel"),
    }),
  };
});

jest.mock("@/app/services/streamChatService", () => ({
  getChatClient: jest.fn(),
  connectStreamUser: jest.fn(),
  getAppointmentChannel: jest.fn().mockImplementation(async (appointmentId) => 
    createMockChannel(`appointment-${appointmentId}`)
  ),
  markChannelAsRead: jest.fn(),
  getUnreadCount: jest.fn(async () => 0),
  sendMessage: jest.fn(),
  endChatChannel: jest.fn(),
  isClientConnected: jest.fn(() => true),
  getCurrentUserId: jest.fn(() => "vet-1"),
}));

jest.mock("@/app/utils/mockStreamBackend", () => ({
  getMockVetUser: jest.fn(),
}));

jest.mock("@/app/stores/authStore", () => ({
  useAuthStore: {
    getState: jest.fn(() => ({
      attributes: {
        sub: "user-123",
        email: "test@example.com",
        given_name: "John",
        family_name: "Doe",
        picture: "pic.jpg",
      },
    })),
  },
}));

jest.mock("@/app/stores/orgStore", () => ({
  useOrgStore: {
    getState: jest.fn(() => ({
      primaryOrgId: "org-1",
    })),
  },
}));

import { ChatContainer } from "@/app/components/chat/ChatContainer";
import {
  connectStreamUser,
  getChatClient,
} from "@/app/services/streamChatService";
import { getMockVetUser } from "@/app/utils/mockStreamBackend";

const mockClient = {
  userID: "vet-1",
  channel: jest.fn().mockImplementation((type, id) => createMockChannel(id)),
};

const createDeferred = () => {
  let resolve!: (value?: unknown) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};

describe("<ChatContainer />", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getMockVetUser as jest.Mock).mockReturnValue({
      id: "vet-1",
      name: "Vet User",
      image: "img.png",
    });
    (getChatClient as jest.Mock).mockReturnValue(mockClient);
    mockClient.channel.mockClear();
    window.innerWidth = 1024;
  });

  test("shows loader while connecting and renders layout afterwards", async () => {
    const deferred = createDeferred();
    (connectStreamUser as jest.Mock).mockReturnValue(deferred.promise);
    render(<ChatContainer />);

    expect(screen.getByTestId("chat-loading")).toBeInTheDocument();

    await act(async () => {
      deferred.resolve(undefined);
    });

    await waitFor(() =>
      expect(screen.getByTestId("channel-list")).toBeInTheDocument()
    );
    expect(mockChannelList).toHaveBeenCalledWith(
      expect.objectContaining({
        filters: expect.objectContaining({
          members: expect.objectContaining({ $in: ["vet-1"] }),
        }),
      })
    );
  });

  test("reports initialization error state", async () => {
    const error = new Error("init failed");
    (connectStreamUser as jest.Mock).mockRejectedValue(error);

    render(<ChatContainer />);

    await waitFor(() =>
      expect(screen.getByText("init failed")).toBeInTheDocument()
    );
  });

  test("renders appointment channel when appointmentId exists", async () => {
    (connectStreamUser as jest.Mock).mockResolvedValue(undefined);
    mockClient.channel.mockReturnValue(createMockChannel("appointment-24"));

    render(<ChatContainer appointmentId="24" />);

    await waitFor(() =>
      expect(screen.getByTestId("stream-channel")).toBeInTheDocument()
    );
    expect(mockClient.channel).toHaveBeenCalledWith(
      "messaging",
      "appointment-24"
    );
    expect(screen.queryByTestId("channel-list")).not.toBeInTheDocument();
  });

  test("notifies selection and allows going back on mobile", async () => {
    window.innerWidth = 480;
    (connectStreamUser as jest.Mock).mockResolvedValue(undefined);
    const selectSpy = jest.fn();

    render(<ChatContainer onChannelSelect={selectSpy} />);

    await waitFor(() =>
      expect(document.querySelector(".chat-preview-trigger")).not.toBeNull()
    );

    const trigger = document.querySelector(
      ".chat-preview-trigger"
    ) as HTMLElement;
    fireEvent.click(trigger);
    expect(selectSpy).toHaveBeenCalledWith(
      expect.objectContaining({ id: "preview-channel" })
    );

    const backButton = await screen.findByRole("button", { name: "← Back" });
    fireEvent.click(backButton);
    await waitFor(() =>
      expect(screen.queryByRole("button", { name: "← Back" })).not.toBeInTheDocument()
    );
  });
});
