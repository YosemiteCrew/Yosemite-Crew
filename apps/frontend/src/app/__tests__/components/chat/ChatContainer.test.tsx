'use client';

import React from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom";

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
      channel: { id: "preview-channel", state: { members: {} } },
    }),
  };
});

jest.mock("@/app/services/streamChatService", () => ({
  getChatClient: jest.fn(),
  connectStreamUser: jest.fn(),
}));

jest.mock("@/app/utils/mockStreamBackend", () => ({
  getMockVetUser: jest.fn(),
}));

import { ChatContainer } from "@/app/components/chat/ChatContainer";
import {
  connectStreamUser,
  getChatClient,
} from "@/app/services/streamChatService";
import { getMockVetUser } from "@/app/utils/mockStreamBackend";

const mockClient = {
  userID: "vet-1",
  channel: jest.fn(() => ({ id: "chan" })),
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
    const consoleErrorSpy = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});

    render(<ChatContainer />);

    await waitFor(() =>
      expect(screen.getByText("init failed")).toBeInTheDocument()
    );
    expect(consoleErrorSpy).toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  test("renders appointment channel when appointmentId exists", async () => {
    (connectStreamUser as jest.Mock).mockResolvedValue(undefined);
    mockClient.channel.mockReturnValue({ id: "appointment-24" });

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
