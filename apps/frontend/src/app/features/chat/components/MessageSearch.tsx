'use client';

/**
 * In-conversation message search. A search icon in the channel header opens a
 * panel that full-text searches the current channel's messages via Stream's
 * channel.search, lists matches (sender + snippet), and jumps to the selected
 * message with the channel action context's jumpToMessage. Debounced 300ms.
 */

import { useEffect, useState } from 'react';
import { useChannelStateContext, useChannelActionContext } from 'stream-chat-react';
import type { MessageResponse } from 'stream-chat';
import { LuSearch, LuX } from 'react-icons/lu';
import clsx from 'clsx';
import Text from '@/app/ui/Text';

export function MessageSearch() {
  const { channel } = useChannelStateContext();
  const { jumpToMessage } = useChannelActionContext();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MessageResponse[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const trimmed = query.trim();
    if (!open || !trimmed || !channel) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      channel
        .search(trimmed)
        .then((res) => {
          if (active) setResults(res.results.map((r) => r.message as MessageResponse));
        })
        .catch(() => {
          if (active) setResults([]);
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, open, channel]);

  const hasQuery = query.trim().length > 0;

  return (
    <div className="relative">
      <button
        type="button"
        aria-label="Search messages"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className={clsx(
          'inline-flex h-9 w-9 items-center justify-center rounded-full transition-colors',
          open
            ? 'bg-chat-panel text-primary-600'
            : 'text-neutral-500 hover:bg-chat-panel hover:text-neutral-900'
        )}
      >
        <LuSearch className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close search"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-20 w-80 rounded-2xl border border-chat-divider bg-neutral-0 p-2 shadow-lg">
            <div className="flex items-center gap-2 rounded-full border border-input-border bg-chat-surface px-3 py-2 focus-within:border-input-border-active">
              <LuSearch className="h-4 w-4 shrink-0 text-neutral-400" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in conversation…"
                aria-label="Search in conversation"
                className="w-full bg-transparent font-satoshi text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
              />
              {hasQuery && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                  <LuX className="h-4 w-4 text-neutral-400" />
                </button>
              )}
            </div>
            <ul className="mt-2 max-h-72 overflow-y-auto">
              {searching && (
                <li className="px-3 py-4 text-center">
                  <Text as="span" variant="caption-1" className="text-neutral-400">
                    Searching…
                  </Text>
                </li>
              )}
              {!searching && hasQuery && results.length === 0 && (
                <li className="px-3 py-4 text-center">
                  <Text as="span" variant="caption-1" className="text-neutral-400">
                    No messages found
                  </Text>
                </li>
              )}
              {results.map((message) => (
                <li key={message.id}>
                  <button
                    type="button"
                    onClick={() => {
                      void jumpToMessage(message.id);
                      setOpen(false);
                    }}
                    className="flex w-full flex-col gap-0.5 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft"
                  >
                    <Text as="span" variant="body-4-emphasis" className="truncate text-neutral-900">
                      {message.user?.name || message.user?.id || 'User'}
                    </Text>
                    <Text as="span" variant="caption-1" className="truncate text-neutral-500">
                      {message.text || 'Attachment'}
                    </Text>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default MessageSearch;
