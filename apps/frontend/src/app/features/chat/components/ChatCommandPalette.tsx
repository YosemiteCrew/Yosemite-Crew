'use client';

/**
 * ⌘K / Ctrl-K command palette for jumping between real Stream conversations.
 * Opens on the keyboard shortcut, queries channels for the current org via the
 * Stream client, and lets you fuzzy-filter by title and jump (channel.watch via
 * the parent's activateChannelById). Mounted once inside the chat shell.
 */

import { useEffect, useMemo, useState } from 'react';
import type { StreamChat, Channel, ChannelFilters, ChannelSort } from 'stream-chat';
import { LuSearch, LuCornerDownLeft, LuCommand } from 'react-icons/lu';
import Text from '@/app/ui/Text';
import { ChatAvatar } from './ChatAvatar';

const PALETTE_SORT: ChannelSort = { last_message_at: -1 };

function titleOf(channel: Channel, userId?: string | null) {
  const name = (channel.data as { name?: string } | undefined)?.name;
  if (name) return name;
  const members = Object.values(channel.state?.members ?? {});
  const other = members.find((m) => m.user?.id !== userId);
  return other?.user?.name || other?.user?.id || 'Conversation';
}

export function ChatCommandPalette({
  client,
  filters,
  onJump,
}: Readonly<{ client: StreamChat; filters: ChannelFilters; onJump: (id: string) => void }>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [channels, setChannels] = useState<Channel[]>([]);
  const userId = client.userID;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        // Win over the app-wide UniversalSearch Cmd+K while chat is mounted, so
        // Cmd+K here jumps between conversations (which the global palette can't
        // search). This capture-phase listener fires before the global one's
        // document-level bubble listener; stopping it prevents both opening.
        e.stopImmediatePropagation();
        setOpen((o) => !o);
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    };
    globalThis.addEventListener('keydown', onKey, true);
    return () => globalThis.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery('');
      return;
    }
    let active = true;
    client
      .queryChannels(filters, PALETTE_SORT, { limit: 30 })
      .then((res) => {
        if (active) setChannels(res);
      })
      .catch(() => {
        if (active) setChannels([]);
      });
    return () => {
      active = false;
    };
  }, [open, client, filters]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return channels;
    return channels.filter((c) => titleOf(c, userId).toLowerCase().includes(q));
  }, [channels, query, userId]);

  if (!open) return null;

  const jump = (id?: string) => {
    if (id) {
      onJump(id);
      setOpen(false);
    }
  };

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-start justify-center border-0 bg-neutral-900/30 p-4 pt-24"
      aria-label="Jump to conversation"
    >
      <button
        type="button"
        aria-label="Close palette"
        className="absolute inset-0 cursor-default"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 w-full max-w-lg overflow-hidden rounded-2xl border border-chat-divider bg-neutral-0 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-chat-divider px-4 py-3">
          <LuSearch className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') jump(results[0]?.id);
            }}
            placeholder="Jump to a conversation…"
            aria-label="Search conversations"
            className="w-full bg-transparent font-satoshi text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          <span className="flex shrink-0 items-center gap-0.5 rounded-md border border-chat-divider px-1.5 py-0.5 text-xs font-semibold text-neutral-400">
            <LuCommand className="h-3 w-3" />K
          </span>
        </div>
        <ul className="max-h-80 overflow-y-auto p-2">
          {results.length === 0 ? (
            <li className="px-3 py-6 text-center">
              <Text as="span" variant="body-4" className="text-neutral-400">
                No conversations found
              </Text>
            </li>
          ) : (
            results.map((c) => {
              const title = titleOf(c, userId);
              return (
                <li key={c.cid}>
                  <button
                    type="button"
                    onClick={() => jump(c.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft"
                  >
                    <ChatAvatar name={title} size="sm" />
                    <Text
                      as="span"
                      variant="body-4-emphasis"
                      className="flex-1 truncate text-neutral-900"
                    >
                      {title}
                    </Text>
                    <LuCornerDownLeft className="h-3.5 w-3.5 shrink-0 text-neutral-300" />
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </div>
    </dialog>
  );
}

export default ChatCommandPalette;
