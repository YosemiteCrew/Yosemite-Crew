'use client';

import { useEffect } from 'react';
import type { StreamChat, Event } from 'stream-chat';

/**
 * Shows a browser notification for incoming chat messages while the tab is not
 * focused, so clinic staff are alerted to new pet-parent / colleague messages
 * without watching the sidebar. No-ops where the Notification API is missing,
 * permission is not granted, the message is the user's own, or the tab is
 * visible. Permission is requested once on mount when still in the default state.
 */
export function useChatNotifications(client: StreamChat | null | undefined): void {
  useEffect(() => {
    if (!client || typeof Notification === 'undefined') return;

    if (Notification.permission === 'default') {
      void Notification.requestPermission();
    }

    const handleNewMessage = (event: Event) => {
      const message = event.message;
      if (!message || message.user?.id === client.userID) return;
      if (Notification.permission !== 'granted') return;
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') return;

      try {
        const notification = new Notification(message.user?.name || 'New message', {
          body: message.text || 'Sent an attachment',
          tag: event.cid,
        });
        globalThis.setTimeout(() => notification.close(), 6000);
      } catch {
        // Some browsers require a service worker for notifications; ignore.
      }
    };

    client.on('message.new', handleNewMessage);
    return () => {
      client.off('message.new', handleNewMessage);
    };
  }, [client]);
}

export default useChatNotifications;
