/**
 * Chat Page
 *
 * Dedicated page for viewing and managing all active chats in the PMS.
 * Uses Stream Chat's default UI and responsive design.
 * Renders below the navbar and takes remaining viewport height.
 */

import React from 'react';
import {ChatContainer} from '@/app/components/chat/ChatContainer';
import './page.css';

export default function ChatPage() {
  return (
    <div className="chat-page">
      <ChatContainer />
    </div>
  );
}
