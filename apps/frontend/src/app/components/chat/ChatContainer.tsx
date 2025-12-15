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
  endChatChannel,
} from "@/app/services/streamChatService";
import { useAuthStore } from "@/app/stores/authStore";
import { useOrgStore } from "@/app/stores/orgStore";
import ProtectedRoute from "../ProtectedRoute";
import OrgGuard from "../OrgGuard";

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

interface ChannelState {
  frozen: boolean;
  updatedAt?: string;
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
    (petName && petOwnerName ? `${petName}{' '}(${petOwnerName})` : undefined) ||
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

// Custom hook for channel state management
const useChannelState = () => {
  const { channel } = useChannelStateContext();
  const [state, setState] = useState<ChannelState>({
    frozen: false,
    updatedAt: undefined,
  });

  useEffect(() => {
    if (channel) {
      const channelData = channel.data as any;
      const isFrozen = channelData?.frozen === true;
      const updatedAt = channelData?.updated_at;

      setState({ frozen: isFrozen, updatedAt });

      // Listen for channel updates
      const handleChannelUpdate = () => {
        const updatedData = channel.data as any;
        const newFrozen = updatedData?.frozen === true;
        const newUpdatedAt = updatedData?.updated_at;
        setState({ frozen: newFrozen, updatedAt: newUpdatedAt });
      };

      channel.on('channel.updated', handleChannelUpdate);

      return () => {
        channel.off('channel.updated', handleChannelUpdate);
      };
    }
  }, [channel]);

  return state;
};

const ChannelHeaderWithCounterpart: React.FC<{
  currentUserId?: string | null;
}> = ({ currentUserId }) => {
  const { channel } = useChannelStateContext();
  const [closingSession, setClosingSession] = useState(false);
  const [sessionClosed, setSessionClosed] = useState(false);
  const { title } = getChannelDisplayInfo(
    channel as StreamChannel | null,
    currentUserId
  );

  // Check if session is already closed
  useEffect(() => {
    if (channel) {
      const status = (channel.data as any)?.status;
      const frozen = (channel.data as any)?.frozen;
      const isSessionClosed = status === 'ended' || frozen === true;
      setSessionClosed(isSessionClosed);
    }
  }, [channel]);

  const handleCloseSession = async () => {
    if (!channel) return;

    // Prevent duplicate calls if already closing or already closed
    if (closingSession || sessionClosed) return;

    const confirmed = confirm("Are you sure you want to close this chat session? The client will no longer be able to send messages.");
    if (!confirmed) {
      return;
    }

    setClosingSession(true);
    try {
      const appointmentId = (channel.data as any)?.appointmentId;
      if (appointmentId) {
        await endChatChannel(appointmentId);
        setSessionClosed(true);
        alert("Chat session closed successfully");
      }
    } catch (error) {
      console.error("Failed to close chat session:", error);
      alert("Failed to close chat session. Please try again.");
    } finally {
      setClosingSession(false);
    }
  };

  const hasSessionClosed = sessionClosed;

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', gap: '12px' }}>
      <ChannelHeader title={title} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {hasSessionClosed && (
          <div style={{
            padding: '6px 12px',
            backgroundColor: 'var(--grey-light)',
            border: '1px solid var(--grey-border)',
            borderRadius: '8px',
          }}>
            <p className="font-satoshi" style={{
              fontSize: '12px',
              fontWeight: 500,
              color: 'var(--grey-text)',
              margin: 0,
            }}>
              Session Closed
            </p>
          </div>
        )}
        {!hasSessionClosed && (
          <button
            onClick={handleCloseSession}
            disabled={closingSession}
            className="font-satoshi"
            style={{
              padding: '8px 16px',
              backgroundColor: 'var(--black-bg)',
              color: 'var(--white-text)',
              border: '1px solid var(--black-bg)',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 500,
              cursor: closingSession ? 'not-allowed' : 'pointer',
              opacity: closingSession ? 0.6 : 1,
              transition: 'all 0.3s ease',
            }}
            onMouseEnter={(e) => {
              if (!closingSession) {
                e.currentTarget.style.backgroundColor = 'var(--black-hover)';
                e.currentTarget.style.boxShadow = '0 0 16px 0 rgba(0, 0, 0, 0.16)';
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'var(--black-bg)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            {closingSession ? 'Closing...' : 'Close Session'}
          </button>
        )}
      </div>
    </div>
  );
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
      tabIndex={0}
      className="chat-preview-trigger"
      onClick={handlePreviewSelect}
      onKeyDown={handleKeyDown}
      style={{ 
        cursor: 'pointer',
        background: 'none',
        border: 'none',
        padding: 0,
        margin: 0,
        textAlign: 'left',
        width: '100%'
      }}
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

const ChatClosedFooter: React.FC<{ closedAt?: string }> = ({ closedAt }) => {
  const formatClosedTime = (timestamp?: string) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      // show year only when it's different from current year
      year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  };

  const formattedClosedTime = formatClosedTime(closedAt);

  return (
    <div style={{
      padding: '16px',
      backgroundColor: 'var(--grey-light)',
      borderTop: '1px solid var(--grey-border)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: '8px'
    }}>
      <p className="font-satoshi" style={{
        fontSize: '14px',
        fontWeight: 500,
        color: 'var(--grey-text)',
        margin: 0,
      }}>
        Chat session closed
      </p>
      {formattedClosedTime && (
        <p className="font-satoshi" style={{
          fontSize: '12px',
          color: 'var(--grey-noti)',
          margin: 0,
        }}>
          {formattedClosedTime}
        </p>
      )}
    </div>
  );
};

// Shared component for channel window content with different header components
interface ChannelWindowContentProps {
  currentUserId?: string | null;
  headerComponent: React.ComponentType<{ currentUserId?: string | null }>;
}

const ChannelWindowContent: React.FC<ChannelWindowContentProps> = ({ 
  currentUserId, 
  headerComponent: HeaderComponent 
}) => {
  const channelState = useChannelState();
  const HeaderComponentTyped = HeaderComponent;

  return (
    <div className="str-chat__window">
      <Window>
        <HeaderComponentTyped currentUserId={currentUserId} />
        <MessageList />
        {channelState.frozen ? (
          <ChatClosedFooter closedAt={channelState.updatedAt} />
        ) : (
          <MessageInput />
        )}
      </Window>
    </div>
  );
};


// Specialized components for different use cases with distinct implementations
// Reuse ChannelWindowContent for both appointment and regular channels
const AppointmentChannelWindow: React.FC<{ currentUserId?: string | null }> = ({ currentUserId }) => (
  <ChannelWindowContent headerComponent={ChannelHeaderWithCounterpart} currentUserId={currentUserId} />
);

const RegularChannelWindow: React.FC<{ currentUserId?: string | null }> = ({ currentUserId }) => (
  <ChannelWindowContent headerComponent={ChannelHeaderWithCounterpart} currentUserId={currentUserId} />
);

const ChatWindow: React.FC<ChatWindowProps> = ({
  showBackButton,
  onBack,
  currentUserId,
}) => {
  const shouldShowBackButton = showBackButton;

  return (
    <>
      {shouldShowBackButton && (
        <button type="button" className="chat-back-button" onClick={onBack}>
          ← Back
        </button>
      )}
      <Channel>
        <RegularChannelWindow currentUserId={currentUserId} />
        <Thread />
      </Channel>
    </>
  );
};

const ChatMainPanel: React.FC<ChatMainPanelProps> = ({
  isMobile,
  isChannelSelected,
  showBackButton,
  onBack,
  currentUserId,
}) => {
  const shouldShowChat = isMobile ? isChannelSelected : true;

  return (
    <div
      className="str-chat__main-panel"
      style={{
        display: shouldShowChat ? "flex" : "none",
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
};


const ChatLayout: React.FC<ChatLayoutProps> = ({
  filters,
  sort,
  options,
  isMobile,
  isChannelSelected,
  previewComponent,
  onBack,
  currentUserId,

}) => {
  const shouldShowChannelList = !isMobile || !isChannelSelected;

  return (
    <div className="str-chat__container">
      <div
        className="str-chat__channel-list-wrapper"
        style={{ display: shouldShowChannelList ? "flex" : "none" }}
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
};

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
    let cancelled = false;

    const init = async () => {
      try {
        const { attributes } = useAuthStore.getState();
        const { primaryOrgId } = useOrgStore.getState();

        if (!attributes || !primaryOrgId) {
          if (!cancelled) {
            setError("User profile not loaded");
            setLoading(false);
          }
          return;
        }

        const userId = attributes.sub || attributes.email;
        const userName = `${attributes.given_name || ''}{' '}${attributes.family_name || ''}`.trim() || attributes.email;
        const userImage = attributes.picture;

        const chatClient = getChatClient();

        // Only connect if not already connected to this user
        if (chatClient.userID !== userId) {
          await connectStreamUser(userId, userName, userImage);
        }

        if (!cancelled) {
          setClient(chatClient);
          setLoading(false);
        }
      } catch (err: any) {
        if (!cancelled) {
          setError(err.message || "Failed to load chat");
          setLoading(false);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
    };
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

  // Extract conditional rendering logic
  const isLoading = loading;
  const hasError = error || !client;

  if (isLoading) {
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

  if (hasError) {
    const errorMessage = error || "Unable to load chat";
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "400px",
        }}
      >
        <p style={{ color: "#d32f2f" }}>{errorMessage}</p>
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
      <AppointmentChannelWindow currentUserId={client.userID} />
      <Thread />
    </Channel>
  ) : null;

  const chatContent = appointmentId ? (
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
  );

  return (
    <div className={className}>
      <Chat client={client} theme="str-chat__theme-light">
        {chatContent}
      </Chat>
    </div>
  );
};

const ProtectedChatContainer = () => {
  return (
    <ProtectedRoute>
      <OrgGuard>
        <ChatContainer />
      </OrgGuard>
    </ProtectedRoute>
  );
};

export default ProtectedChatContainer;
