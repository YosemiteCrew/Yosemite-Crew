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
import { IoClose, IoSearchOutline } from 'react-icons/io5';
import clsx from 'clsx';
import Text from '@/app/ui/Text';

const toMessages = (results: Array<{ message: unknown }>): MessageResponse[] =>
  results.map((r) => r.message as MessageResponse);

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
      setSearching(false);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      channel
        .search(trimmed)
        .then((res) => {
          if (active) setResults(toMessages(res.results));
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
          'inline-flex size-9 items-center justify-center rounded-full border transition-colors',
          open
            ? 'border-[var(--blue)] bg-[var(--blue-soft)] text-[var(--blue-text)]'
            : 'border-[var(--hairline)] text-[var(--ink-soft)] hover:bg-[var(--screen-2)] hover:text-[var(--ink)]'
        )}
      >
        <IoSearchOutline className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="Close search"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-11 z-20 w-80 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-2 shadow-[0_6px_16px_var(--sh10),0_24px_56px_var(--sh12)]">
            <div className="flex min-h-12 items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--field-bg)] px-4 py-2.5 transition-colors focus-within:border-[var(--blue)]">
              <IoSearchOutline className="h-4 w-4 shrink-0 text-input-text-placeholder" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search in conversation…"
                aria-label="Search in conversation"
                className="w-full bg-transparent font-satoshi text-body-4 text-text-primary outline-none placeholder:text-input-text-placeholder"
              />
              {hasQuery && (
                <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                  <IoClose className="h-4 w-4 text-input-text-placeholder" />
                </button>
              )}
            </div>
            <ul className="mt-2 max-h-72 overflow-y-auto">
              {searching && (
                <li className="px-3 py-4 text-center">
                  <Text as="span" variant="caption-1" className="text-[var(--ink-faint)]">
                    Searching…
                  </Text>
                </li>
              )}
              {!searching && hasQuery && results.length === 0 && (
                <li className="px-3 py-4 text-center">
                  <Text as="span" variant="caption-1" className="text-[var(--ink-faint)]">
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
                    <Text
                      as="span"
                      variant="caption-1"
                      className="truncate text-[13px] text-neutral-900"
                    >
                      {message.user?.name || message.user?.id || 'User'}
                    </Text>
                    <Text
                      as="span"
                      variant="caption-1"
                      className="truncate text-[12px] text-neutral-500"
                    >
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
