'use client';

/**
 * Cross-clinic ("network") colleague directory. Lets staff search colleagues at
 * other organisations they're allowed to message and start a direct chat with
 * them. Each row surfaces the colleague's clinic (organisationName) so it's
 * clear which practice they belong to. Search is debounced 300ms, mirroring the
 * in-conversation MessageSearch.
 */

import { useEffect, useState } from 'react';
import { LuSearch, LuX, LuUsers } from 'react-icons/lu';
import Text from '@/app/ui/Text';
import {
  searchNetworkColleagues,
  createNetworkDirectChat,
  type NetworkColleague,
} from '../services/chatService';
import { ChatAvatar } from './ChatAvatar';

export function NetworkDirectoryModal({
  organisationId,
  onClose,
  onStarted,
}: Readonly<{
  organisationId: string;
  onClose: () => void;
  onStarted: (channelId: string) => void;
}>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NetworkColleague[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      return;
    }
    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchNetworkColleagues(organisationId, trimmed)
        .then((colleagues) => {
          if (active) setResults(colleagues);
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
  }, [query, organisationId]);

  const start = async (colleague: NetworkColleague) => {
    setStarting(colleague.userId);
    setError(null);
    try {
      const session = await createNetworkDirectChat({
        organisationId,
        otherUserId: colleague.userId,
        otherOrganisationId: colleague.organisationId,
      });
      onStarted(session.channelId);
      onClose();
    } catch {
      setError('Could not start the conversation. Please try again.');
    } finally {
      setStarting(null);
    }
  };

  const hasQuery = query.trim().length > 0;

  return (
    <dialog
      open
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-start justify-center border-0 bg-neutral-900/30 p-4 pt-24"
      aria-label="Message a colleague at another clinic"
    >
      <button
        type="button"
        aria-label="Close directory"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-chat-divider bg-neutral-0 shadow-2xl">
        <div className="flex items-center justify-between border-b border-chat-divider px-4 py-3">
          <span className="flex items-center gap-2">
            <LuUsers className="h-4 w-4 text-primary-600" />
            <Text as="span" variant="body-3-emphasis" className="text-neutral-900">
              Message a colleague at another clinic
            </Text>
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 hover:bg-chat-surface-soft"
          >
            <LuX className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2 border-b border-chat-divider px-4 py-2">
          <LuSearch className="h-4 w-4 shrink-0 text-neutral-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search colleagues…"
            aria-label="Search colleagues"
            className="w-full bg-transparent font-satoshi text-sm text-neutral-900 outline-none placeholder:text-neutral-400"
          />
          {hasQuery && (
            <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
              <LuX className="h-4 w-4 text-neutral-400" />
            </button>
          )}
        </div>

        {error && (
          <div role="alert" className="border-b border-chat-divider px-4 py-2">
            <Text as="span" variant="caption-1" className="text-danger-600">
              {error}
            </Text>
          </div>
        )}

        <ul className="max-h-80 overflow-y-auto p-2">
          {searching && (
            <li className="px-3 py-6 text-center">
              <Text as="span" variant="caption-1" className="text-neutral-400">
                Searching…
              </Text>
            </li>
          )}
          {!searching && !hasQuery && (
            <li className="px-3 py-6 text-center">
              <Text as="span" variant="caption-1" className="text-neutral-400">
                Search for a colleague at another clinic
              </Text>
            </li>
          )}
          {!searching && hasQuery && results.length === 0 && (
            <li className="px-3 py-6 text-center">
              <Text as="span" variant="caption-1" className="text-neutral-400">
                No colleagues found
              </Text>
            </li>
          )}
          {!searching &&
            results.map((colleague) => (
              <li key={`${colleague.organisationId}-${colleague.userId}`}>
                <button
                  type="button"
                  disabled={starting === colleague.userId}
                  onClick={() => void start(colleague)}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft disabled:opacity-60"
                >
                  <ChatAvatar name={colleague.name} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Text as="span" variant="body-4-emphasis" className="truncate text-neutral-900">
                      {colleague.name}
                    </Text>
                    <Text as="span" variant="caption-1" className="truncate text-neutral-500">
                      {colleague.role} · {colleague.organisationName}
                    </Text>
                  </span>
                  <Text
                    as="span"
                    variant="caption-2"
                    className="shrink-0 font-semibold text-primary-600"
                  >
                    {starting === colleague.userId ? 'Starting…' : 'Message'}
                  </Text>
                </button>
              </li>
            ))}
        </ul>
      </div>
    </dialog>
  );
}

export default NetworkDirectoryModal;
