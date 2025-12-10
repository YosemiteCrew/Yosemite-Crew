"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chat,
  Channel,
  ChannelHeader,
  ChannelList,
  LoadingIndicator,
  MessageInput,
  MessageList,
  Thread,
  Window,
  ChannelPreviewMessenger,
  useChannelStateContext,
} from "stream-chat-react";
import { StreamChat } from "stream-chat";
import type { Channel as StreamChannel } from "stream-chat";
import type {
  ChannelPreviewUIComponentProps,
  ChannelListProps,
} from "stream-chat-react";

import "stream-chat-react/dist/css/v2/index.css";
import "./ChatContainer.css";

import {
  getChatClient,
  connectStreamUser,
} from "@/app/services/streamChatService";
import { getMockVetUser } from "@/app/utils/mockStreamBackend";

interface ChatContainerProps {
  appointmentId?: string;
  onChannelSelect?: (channel: StreamChannel | null) => void;
  className?: string;
}

interface ChannelPreviewWrapperProps extends ChannelPreviewUIComponentProps {
  onPreviewSelect?: (channel: StreamChannel | null) => void;
  currentUserId?: string | null;
}

interface ChatLayoutProps {
  filters: ChannelListProps["filters"];
  sort: ChannelListProps["sort"];
  options: ChannelListProps["options"];
  isMobile: boolean;
  isChannelSelected: boolean;
  previewComponent: React.ComponentType<ChannelPreviewUIComponentProps>;
  onBack: () => void;
  currentUserId?: string | null;
}

interface ChatMainPanelProps {
  isMobile: boolean;
  isChannelSelected: boolean;
  showBackButton: boolean;
  onBack: () => void;
  currentUserId?: string | null;
}

interface ChatWindowProps {
  showBackButton: boolean;
  onBack: () => void;
  currentUserId?: string | null;
}

interface ChannelDisplayInfo {
  title: string;
  image?: string;
}

const getChannelDisplayInfo = (
  channel: StreamChannel | null | undefined,
  currentUserId?: string | null
): ChannelDisplayInfo => {
  if (!channel) {
    return { title: "Chat" };
  }

  const channelData = (channel.data || {}) as Record<string, unknown>;
  const membersArray = channel.state?.members
    ? Object.values(channel.state.members)
    : [];
  const counterpart =
    membersArray.find((member) => member.user?.id !== currentUserId) ??
    membersArray[0];

  const petOwnerName =
    typeof channelData.petOwnerName === "string"
      ? channelData.petOwnerName
      : undefined;
  const petName =
    typeof channelData.petName === "string" ? channelData.petName : undefined;

  const counterpartName = counterpart?.user?.name || counterpart?.user_id;
  const counterpartImage = counterpart?.user?.image;

  const title =
    (petName && petOwnerName ? `${petName} (${petOwnerName})` : undefined) ||
    petOwnerName ||
    petName ||
    counterpartName ||
    (typeof channelData.name === "string" ? channelData.name : undefined) ||
    channel.id ||
    "Chat";

  const image =
    (typeof channelData.image === "string" ? channelData.image : undefined) ||
    counterpartImage;

  return { title, image };
};

const ChannelHeaderWithCounterpart: React.FC<{
  currentUserId?: string | null;
}> = ({ currentUserId }) => {
  const { channel } = useChannelStateContext();
  const { title } = getChannelDisplayInfo(
    channel as StreamChannel | null,
    currentUserId
  );

  return <ChannelHeader title={title} />;
};

const ChannelPreviewWrapper: React.FC<ChannelPreviewWrapperProps> = ({
  onPreviewSelect,
  currentUserId,
  ...previewProps
}) => {
  const handlePreviewSelect: React.MouseEventHandler<HTMLButtonElement> = (
    event
  ) => {
    previewProps.onSelect?.(
      event as unknown as React.MouseEvent<HTMLDivElement>
    );
    onPreviewSelect?.(previewProps.channel ?? null);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (
    event
  ) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      handlePreviewSelect(
        event as unknown as React.MouseEvent<HTMLButtonElement>
      );
    }
  };

  const { title, image } = getChannelDisplayInfo(
    previewProps.channel ?? null,
    currentUserId
  );

  return (
    <button
      type="button"
      className="chat-preview-trigger"
      onClick={handlePreviewSelect}
      onKeyDown={handleKeyDown}
    >
      <ChannelPreviewMessenger
        {...previewProps}
        displayTitle={title}
        displayImage={image}
      />
    </button>
  );
};

const createPreviewComponent = (
  onPreviewSelect: (channel: StreamChannel | null) => void,
  currentUserId?: string | null
): React.ComponentType<ChannelPreviewUIComponentProps> => {
  const PreviewComponent: React.FC<ChannelPreviewUIComponentProps> = (
    props
  ) => (
    <ChannelPreviewWrapper
      {...props}
      onPreviewSelect={onPreviewSelect}
      currentUserId={currentUserId}
    />
  );

  PreviewComponent.displayName = "ChatChannelPreview";
  return PreviewComponent;
};

const ChatWindow: React.FC<ChatWindowProps> = ({
  showBackButton,
  onBack,
  currentUserId,
}) => (
  <>
    {showBackButton && (
      <button type="button" className="chat-back-button" onClick={onBack}>
        ← Back
      </button>
    )}
    <Channel>
      <div className="str-chat__window">
        <Window>
          <ChannelHeaderWithCounterpart currentUserId={currentUserId} />
          <MessageList />
          <MessageInput />
        </Window>
      </div>
      <Thread />
    </Channel>
  </>
);

const ChatMainPanel: React.FC<ChatMainPanelProps> = ({
  isMobile,
  isChannelSelected,
  showBackButton,
  onBack,
  currentUserId,
}) => (
  <div
    className="str-chat__main-panel"
    style={{
      display: isMobile && !isChannelSelected ? "none" : "flex",
      flex: 1,
      minHeight: 0,
    }}
  >
    <ChatWindow
      showBackButton={showBackButton && isMobile && isChannelSelected}
      onBack={onBack}
      currentUserId={currentUserId}
    />
  </div>
);

const ChatLayout: React.FC<ChatLayoutProps> = ({
  filters,
  sort,
  options,
  isMobile,
  isChannelSelected,
  previewComponent,
  onBack,
  currentUserId,
}) => (
  <div className="str-chat__container">
    <div
      className="str-chat__channel-list-wrapper"
      style={{ display: isMobile && isChannelSelected ? "none" : "flex" }}
    >
      <ChannelList
        filters={filters}
        sort={sort}
        options={options}
        Preview={previewComponent}
      />
    </div>

    <ChatMainPanel
      isMobile={isMobile}
      isChannelSelected={isChannelSelected}
      showBackButton
      onBack={onBack}
      currentUserId={currentUserId}
    />
  </div>
);

export const ChatContainer: React.FC<ChatContainerProps> = ({
  appointmentId,
  onChannelSelect,
  className = "",
}) => {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isChannelSelected, setIsChannelSelected] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Detect mobile
  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Initialize chat
  useEffect(() => {
    const init = async () => {
      try {
        const vetUser = getMockVetUser();
        const chatClient = getChatClient();
        await connectStreamUser(vetUser.id, vetUser.name, vetUser.image);
        setClient(chatClient);
        setLoading(false);
      } catch (err: any) {
        console.error("Chat init error:", err);
        setError(err.message || "Failed to load chat");
        setLoading(false);
      }
    };

    init();
  }, []);

  const handlePreviewSelect = useCallback(
    (channel: StreamChannel | null) => {
      setIsChannelSelected(true);
      onChannelSelect?.(channel);
    },
    [onChannelSelect]
  );

  const previewComponent = useMemo(
    () => createPreviewComponent(handlePreviewSelect, client?.userID),
    [handlePreviewSelect, client?.userID]
  );

  if (loading) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "400px",
        }}
      >
        <LoadingIndicator size={50} />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "400px",
        }}
      >
        <p style={{ color: "#d32f2f" }}>{error || "Unable to load chat"}</p>
      </div>
    );
  }

  const filters = {
    type: "messaging",
    members: { $in: [client.userID!] },
  };

  const sort = [{ last_message_at: -1 as const }];

  const options = {
    state: true,
    watch: true,
    presence: true,
  };

  const renderAppointmentChannel = appointmentId ? (
    <Channel
      channel={client.channel("messaging", `appointment-${appointmentId}`)}
    >
      <div className="str-chat__window">
        <Window>
          <ChannelHeaderWithCounterpart currentUserId={client.userID} />
          <MessageList />
          <MessageInput />
        </Window>
      </div>
      <Thread />
    </Channel>
  ) : null;

  return (
    <div className={className}>
      <Chat client={client} theme="str-chat__theme-light">
        {appointmentId ? (
          renderAppointmentChannel
        ) : (
          <ChatLayout
            filters={filters}
            sort={sort}
            options={options}
            isMobile={isMobile}
            isChannelSelected={isChannelSelected}
            previewComponent={previewComponent}
            onBack={() => setIsChannelSelected(false)}
            currentUserId={client.userID}
          />
        )}
      </Chat>
    </div>
  );
};

export default ChatContainer;
