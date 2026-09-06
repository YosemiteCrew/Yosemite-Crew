'use client';

/**
 * Cross-clinic ("network") colleague directory. Lets staff search colleagues at
 * other organisations they're allowed to message and start a direct chat with
 * them. Each row surfaces the colleague's clinic (organisationName) so it's
 * clear which practice they belong to. Search is debounced 300ms, mirroring the
 * in-conversation MessageSearch.
 */

import { useEffect, useState } from 'react';
import { IoClose, IoLockClosedOutline, IoSearchOutline } from 'react-icons/io5';
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

  const [prevSearchDeps, setPrevSearchDeps] = useState({ query, organisationId });
  if (query !== prevSearchDeps.query || organisationId !== prevSearchDeps.organisationId) {
    setPrevSearchDeps({ query, organisationId });
    if (query.trim()) {
      setSearching(true);
    } else {
      setResults([]);
      setSearching(false);
    }
  }

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) return;
    let active = true;
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
      className="fixed inset-0 z-50 m-0 flex h-full max-h-none w-full max-w-none items-start justify-center border-0 bg-[var(--sh55)] p-4 pt-24"
      aria-label="Message a colleague at another clinic"
    >
      <button
        type="button"
        aria-label="Close directory"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />
      <div className="relative z-10 flex w-full max-w-[470px] flex-col overflow-hidden rounded-[20px] border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_2px_6px_var(--sh05),0_22px_56px_var(--sh10)]">
        <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4">
          <span className="flex flex-col gap-0.5">
            <Text as="span" variant="body-3-emphasis" className="text-[var(--ink)]">
              Message across the network
            </Text>
            <Text as="span" variant="caption-1" className="text-[var(--ink-faint)]">
              Clinics and specialists on Yosemite Crew
            </Text>
          </span>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="inline-flex size-[30px] items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-faint)] hover:bg-[var(--screen-2)]"
          >
            <IoClose className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Design (network directory): the search is a 38px --field-bg pill, not
            an underlined row — focus swaps the hairline for a --blue edge + ring. */}
        <div className="px-5 py-3.5">
          <div className="flex min-h-[38px] items-center gap-2 rounded-full border border-[var(--hairline)] bg-[var(--field-bg)] px-[13px] transition-shadow focus-within:border-[var(--blue)] focus-within:shadow-[0_0_0_3px_rgba(37,123,237,0.12)]">
            <IoSearchOutline className="h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search colleagues…"
              aria-label="Search colleagues"
              className="w-full bg-transparent font-satoshi text-[12.5px] font-semibold text-[var(--ink)] outline-none placeholder:font-normal placeholder:text-[var(--ink-faint)]"
            />
            {hasQuery && (
              <button type="button" aria-label="Clear search" onClick={() => setQuery('')}>
                <IoClose className="h-3.5 w-3.5 text-[var(--ink-faint)]" />
              </button>
            )}
          </div>
        </div>

        {error && (
          <div role="alert" className="border-b border-[var(--hairline)] px-5 py-2">
            <Text as="span" variant="caption-1" className="text-[var(--danger-text)]">
              {error}
            </Text>
          </div>
        )}

        <ul className="max-h-80 overflow-y-auto p-2">
          {searching && (
            <li className="px-3 py-6 text-center">
              <Text as="span" variant="caption-1" className="text-[var(--ink-faint)]">
                Searching…
              </Text>
            </li>
          )}
          {!searching && !hasQuery && (
            <li className="px-3 py-6 text-center">
              <Text as="span" variant="caption-1" className="text-[var(--ink-faint)]">
                Search for a colleague at another clinic
              </Text>
            </li>
          )}
          {!searching && hasQuery && results.length === 0 && (
            <li className="px-3 py-6 text-center">
              <Text as="span" variant="caption-1" className="text-[var(--ink-faint)]">
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
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left hover:bg-[var(--screen-2)] disabled:opacity-60"
                >
                  <ChatAvatar name={colleague.name} size="sm" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <Text
                      as="span"
                      variant="body-4-emphasis"
                      className="truncate text-[var(--ink)]"
                    >
                      {colleague.name}
                    </Text>
                    <Text
                      as="span"
                      variant="caption-1"
                      className="truncate text-[var(--ink-faint)]"
                    >
                      {colleague.role} · {colleague.organisationName}
                    </Text>
                  </span>
                  <span className="inline-flex shrink-0 items-center rounded-full bg-[var(--cta)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--cta-text)]">
                    {starting === colleague.userId ? 'Starting…' : 'Message'}
                  </span>
                </button>
              </li>
            ))}
        </ul>

        <div className="border-t border-[var(--hairline)] px-5 py-3.5">
          <div className="flex items-start gap-2 rounded-xl border border-[var(--divider)] bg-[var(--inset)] px-3 py-2.5">
            <IoLockClosedOutline className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[var(--ink-faint)]" />
            <Text as="span" variant="caption-1" className="text-[var(--ink-muted)]">
              Network messages share only what you attach. Patient records stay in your
              organization.
            </Text>
          </div>
        </div>
      </div>
    </dialog>
  );
}

export default NetworkDirectoryModal;
