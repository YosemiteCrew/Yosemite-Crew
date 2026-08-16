'use client';

import { useState } from 'react';
import type { Channel as StreamChannel } from 'stream-chat';
import { isChannelMuted } from '../components/chatContainerUtils';

export type ChannelInfoDrawer = {
  infoOpen: boolean;
  openInfo: () => void;
  closeInfo: () => void;
  toggleInfo: () => void;
  infoMuted: boolean;
  handleToggleMute: () => void;
  handleArchiveConversation: () => void;
};

/**
 * Conversation info drawer state for the chat thread header: whether the drawer
 * is open, plus the mute/archive actions it exposes.
 */
export const useChannelInfoDrawer = (
  channel: StreamChannel | null | undefined
): ChannelInfoDrawer => {
  const [infoOpen, setInfoOpen] = useState(false);
  // Optimistic mirror of the channel's mute state so the info drawer's toggle
  // flips immediately (Stream's muteStatus only settles after the round-trip).
  // Tagged with the channel it belongs to: the <Channel> wrapper is unkeyed, so
  // this header instance is reused when another conversation is selected and an
  // untagged override would leak the previous channel's mute state (and make the
  // next toggle call the opposite API on the new channel).
  const [muteOverride, setMuteOverride] = useState<{ cid: string | null; muted: boolean } | null>(
    null
  );

  // Derived during render (never effect-synced): the override only applies to the
  // channel it was recorded for, so selecting another conversation falls straight
  // back to that channel's real mute status.
  const channelCid = channel?.cid ?? null;
  const infoMuted = muteOverride?.cid === channelCid ? muteOverride.muted : isChannelMuted(channel);

  const handleToggleMute = () => {
    if (!channel) return;
    const next = !infoMuted;
    setMuteOverride({ cid: channelCid, muted: next });
    if (next) {
      void channel.mute();
    } else {
      void channel.unmute();
    }
  };

  const handleArchiveConversation = () => {
    if (!channel) return;
    void channel.hide();
    setInfoOpen(false);
  };

  return {
    infoOpen,
    openInfo: () => setInfoOpen(true),
    closeInfo: () => setInfoOpen(false),
    toggleInfo: () => setInfoOpen((open) => !open),
    infoMuted,
    handleToggleMute,
    handleArchiveConversation,
  };
};

export default useChannelInfoDrawer;
