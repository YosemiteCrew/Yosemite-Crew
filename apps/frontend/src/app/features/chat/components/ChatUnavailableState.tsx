import React from 'react';
import { IoChatbubblesOutline } from 'react-icons/io5';
import '@/app/ui/layout/states/states.css';

/**
 * What /chat shows when the build has no Stream API key: a self-hosted install
 * without Stream, or a build that leaves the key out. Chat cannot run at all
 * then, so this is a settled state rather than an error, and the chat
 * workspace is never loaded or connected behind it.
 */
const ChatUnavailableState = () => (
  <div className="yc-state-wrap">
    <div className="yc-state-card">
      <span className="yc-state-icon yc-state-icon--blue" aria-hidden>
        <IoChatbubblesOutline size={25} />
      </span>
      <div className="yc-state-title">Chat isn&apos;t set up for this workspace</div>
      <p className="yc-state-text">
        Messaging runs on Stream, and this installation has no Stream API key. Whoever manages your
        Yosemite Crew installation can add one to turn chat on.
      </p>
    </div>
  </div>
);

export default ChatUnavailableState;
