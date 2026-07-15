'use client';

import { createContext, useContext } from 'react';

/**
 * Lets the (deeply-nested) composer open the Share-from-PIMS picker for the
 * active channel. ChatContainer provides it and owns the modal state.
 */
export type ChatShareContextValue = {
  openShare: (channelId: string) => void;
};

export const ChatShareContext = createContext<ChatShareContextValue>({
  openShare: () => {},
});

export const useChatShare = () => useContext(ChatShareContext);
