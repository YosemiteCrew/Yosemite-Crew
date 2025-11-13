'use client';

import React, {useEffect, useState} from 'react';
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
import type {ChannelPreviewUIComponentProps} from 'stream-chat-react';

import 'stream-chat-react/dist/css/v2/index.css';
import './ChatContainer.css';

import {getChatClient, connectStreamUser} from '@/app/services/streamChatService';
import {getMockVetUser} from '@/app/utils/mockStreamBackend';

interface ChatContainerProps {
  appointmentId?: string;
  onChannelSelect?: (channel: StreamChannel | null) => void;
  className?: string;
}

export const ChatContainer: React.FC<ChatContainerProps> = ({
  appointmentId,
  onChannelSelect,
  className = '',
}) => {
  const [client, setClient] = useState<StreamChat | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedChannel, setSelectedChannel] = useState(false);
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

  const CustomPreview = (previewProps: ChannelPreviewUIComponentProps) => {
    return (
      <div
        onClick={(e) => {
          previewProps.onSelect?.(e as any);
          setSelectedChannel(true);
          onChannelSelect?.(previewProps.channel);
        }}
      >
        <ChannelPreviewMessenger {...previewProps} />
      </div>
    );
  };

  return (
    <Chat client={client} theme="str-chat__theme-light">
      {!appointmentId ? (
        <div className="str-chat__container">
          {/* Channel List */}
          <div
            className="str-chat__channel-list-wrapper"
            style={{display: isMobile && selectedChannel ? 'none' : 'flex'}}
          >
            <ChannelList filters={filters} sort={sort} options={options} Preview={CustomPreview} />
          </div>

          {/* Chat Area */}
          <div
            className="str-chat__main-panel"
            style={{
              display: isMobile && !selectedChannel ? 'none' : 'flex',
              flex: 1,
              minHeight: 0,
            }}
          >
            {isMobile && selectedChannel && (
              <div
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid #e5e7eb',
                  cursor: 'pointer',
                  color: '#3b82f6',
                  fontWeight: 500,
                  flexShrink: 0,
                }}
                onClick={() => setSelectedChannel(false)}
              >
                ← Back
              </div>
            )}
            <Channel>
              <Window className="str-chat__window">
                <ChannelHeader />
                <MessageList />
                <MessageInput />
              </Window>
              <Thread />
            </Channel>
          </div>
        </div>
      ) : (
        <Channel channel={client.channel('messaging', `appointment-${appointmentId}`)}>
          <Window className="str-chat__window">
            <ChannelHeader />
            <MessageList />
            <MessageInput />
          </Window>
          <Thread />
        </Channel>
      )}
    </Chat>
  );
};

export default ChatContainer;
