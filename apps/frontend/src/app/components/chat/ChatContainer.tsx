'use client';

import React, {useCallback, useEffect, useMemo, useState} from 'react';
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
} from 'stream-chat-react';
import {StreamChat} from 'stream-chat';
import type {Channel as StreamChannel} from 'stream-chat';
import type {ChannelPreviewUIComponentProps, ChannelListProps} from 'stream-chat-react';

import 'stream-chat-react/dist/css/v2/index.css';
import './ChatContainer.css';

import {getChatClient, connectStreamUser} from '@/app/services/streamChatService';
import {getMockVetUser} from '@/app/utils/mockStreamBackend';

interface ChatContainerProps {
  appointmentId?: string;
  onChannelSelect?: (channel: StreamChannel | null) => void;
  className?: string;
}

interface ChannelPreviewWrapperProps extends ChannelPreviewUIComponentProps {
  onPreviewSelect?: (channel: StreamChannel | null) => void;
}

interface ChatLayoutProps {
  filters: ChannelListProps['filters'];
  sort: ChannelListProps['sort'];
  options: ChannelListProps['options'];
  isMobile: boolean;
  isChannelSelected: boolean;
  previewComponent: React.ComponentType<ChannelPreviewUIComponentProps>;
  onBack: () => void;
}

interface ChatMainPanelProps {
  isMobile: boolean;
  isChannelSelected: boolean;
  showBackButton: boolean;
  onBack: () => void;
}

interface ChatWindowProps {
  showBackButton: boolean;
  onBack: () => void;
}

const ChannelPreviewWrapper: React.FC<ChannelPreviewWrapperProps> = ({
  onPreviewSelect,
  ...previewProps
}) => {
  const handlePreviewSelect: React.MouseEventHandler<HTMLButtonElement> = (event) => {
    previewProps.onSelect?.(event as unknown as React.MouseEvent<HTMLDivElement>);
    onPreviewSelect?.(previewProps.channel ?? null);
  };

  const handleKeyDown: React.KeyboardEventHandler<HTMLButtonElement> = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      handlePreviewSelect(event as unknown as React.MouseEvent<HTMLButtonElement>);
    }
  };

  return (
    <button
      type="button"
      className="chat-preview-trigger"
      onClick={handlePreviewSelect}
      onKeyDown={handleKeyDown}
    >
      <ChannelPreviewMessenger {...previewProps} />
    </button>
  );
};

const createPreviewComponent = (
  onPreviewSelect: (channel: StreamChannel | null) => void,
): React.ComponentType<ChannelPreviewUIComponentProps> => {
  const PreviewComponent: React.FC<ChannelPreviewUIComponentProps> = (props) => (
    <ChannelPreviewWrapper {...props} onPreviewSelect={onPreviewSelect} />
  );

  PreviewComponent.displayName = 'ChatChannelPreview';
  return PreviewComponent;
};

const ChatWindow: React.FC<ChatWindowProps> = ({showBackButton, onBack}) => (
  <>
    {showBackButton && (
      <button type="button" className="chat-back-button" onClick={onBack}>
        ← Back
      </button>
    )}
    <Channel>
      <div className="str-chat__window">
        <Window>
          <ChannelHeader />
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
}) => (
  <div
    className="str-chat__main-panel"
    style={{
      display: isMobile && !isChannelSelected ? 'none' : 'flex',
      flex: 1,
      minHeight: 0,
    }}
  >
    <ChatWindow showBackButton={showBackButton && isMobile && isChannelSelected} onBack={onBack} />
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
}) => (
  <div className="str-chat__container">
    <div
      className="str-chat__channel-list-wrapper"
      style={{display: isMobile && isChannelSelected ? 'none' : 'flex'}}
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
    />
  </div>
);

export const ChatContainer: React.FC<ChatContainerProps> = ({
  appointmentId,
  onChannelSelect,
  className = '',
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
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
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
        console.error('Chat init error:', err);
        setError(err.message || 'Failed to load chat');
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
    [onChannelSelect],
  );

  const previewComponent = useMemo(
    () => createPreviewComponent(handlePreviewSelect),
    [handlePreviewSelect],
  );

  if (loading) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px'}}>
        <LoadingIndicator size={50} />
      </div>
    );
  }

  if (error || !client) {
    return (
      <div style={{display: 'flex', alignItems: 'center', justifyContent: 'center', height: '400px'}}>
        <p style={{color: '#d32f2f'}}>{error || 'Unable to load chat'}</p>
      </div>
    );
  }

  const filters = {
    type: 'messaging',
    members: {$in: [client.userID!]},
  };

  const sort = [{last_message_at: -1 as const}];

  const options = {
    state: true,
    watch: true,
    presence: true,
  };

  const renderAppointmentChannel = appointmentId ? (
    <Channel channel={client.channel('messaging', `appointment-${appointmentId}`)}>
      <div className="str-chat__window">
        <Window>
          <ChannelHeader />
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
        />
      )}
      </Chat>
    </div>
  );
};

export default ChatContainer;
