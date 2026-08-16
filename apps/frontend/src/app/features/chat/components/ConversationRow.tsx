'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  IoArchiveOutline,
  IoEllipsisVertical,
  IoGlobeOutline,
  IoMoonOutline,
  IoNotificationsOffOutline,
  IoNotificationsOutline,
  IoPhonePortraitOutline,
} from 'react-icons/io5';
import clsx from 'clsx';
import Text from '@/app/ui/Text';
import { ChatAvatar } from './ChatAvatar';

/**
 * Presentational conversation row for the chat sidebar. Maps cleanly from a
 * Stream channel preview (see ChannelPreviewWrapper). Avatar, presence dot,
 * unread badge, network glyph, muted state, and a triage kebab (mute / snooze /
 * archive) that the wrapper wires to Stream-native channel.mute/unmute/hide.
 * The kebab is a sibling of the row button, never nested inside it.
 */

export type ConversationRowProps = Readonly<{
  name: string;
  preview: string;
  time?: string;
  unread?: number;
  online?: boolean;
  group?: boolean;
  network?: boolean;
  viaApp?: boolean;
  muted?: boolean;
  active?: boolean;
  onClick?: (event: MouseEvent) => void;
  onMute?: () => void;
  onUnmute?: () => void;
  onSnooze?: (durationMs: number) => void;
  onArchive?: () => void;
  onUnarchive?: () => void;
}>;

const HOUR_MS = 60 * 60 * 1000;

/**
 * Unread count pill. Design (Chat workspace conversation list): a 17px blue
 * pill with white 10px/800 text — not the deeper solid brand badge.
 *
 * The fill is `--blue-strong`, not `--blue`: white on #257bed is 4.09:1, under
 * AA for 10px text. `--blue-strong` is the same hue family at 6.48:1, so the
 * pill still reads as the design's blue rather than the brand badge it was
 * distinguishing itself from.
 */
function UnreadBadge({ count }: Readonly<{ count: number }>) {
  return (
    <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-full bg-[var(--blue-strong)] px-1.5 py-0.5 text-[10px] font-extrabold leading-none text-white">
      {count}
    </span>
  );
}

function MenuItem({
  icon,
  label,
  active,
  onClick,
}: Readonly<{ icon: ReactNode; label: string; active?: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--screen-2)]',
        active && 'bg-chat-surface-soft'
      )}
    >
      {icon}
      <Text as="span" variant="caption-1" className="text-[13px] text-[var(--ink)]">
        {label}
      </Text>
    </button>
  );
}

export function ConversationRow({
  name,
  preview,
  time,
  unread,
  online,
  group,
  network,
  viaApp,
  muted,
  active,
  onClick,
  onMute,
  onUnmute,
  onSnooze,
  onArchive,
  onUnarchive,
}: ConversationRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasActions = Boolean(onMute || onUnmute || onSnooze || onArchive || onUnarchive);
  const close = () => setMenuOpen(false);

  return (
    <div
      className={clsx(
        // Tablet keeps the raised-white card for the active row; the wide desktop
        // frame (xl) uses the design's surface-soft fill with an inset pink
        // left-stripe (see design "Chat extended", conversation list).
        'group relative flex items-center pr-1 rounded-[13px] xl:rounded-[14px]',
        active
          ? 'border border-[var(--hairline)] bg-[var(--screen)] shadow-[0_1px_3px_var(--sh05)] xl:border-transparent xl:bg-[var(--surface-soft)] xl:shadow-[inset_3px_0_0_var(--blue)]'
          : 'hover:bg-[var(--screen)] xl:hover:bg-[var(--surface-soft)]',
        muted && !active && 'opacity-[0.62]'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={active}
        className="flex min-w-0 flex-1 items-center gap-[9px] rounded-2xl px-2.5 py-2.5 text-left xl:px-3 xl:py-[11px]"
      >
        <ChatAvatar
          name={name}
          online={online}
          group={group}
          business={network && !group}
          size="row"
        />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <Text
              as="span"
              variant="body-4-emphasis"
              className={clsx(
                'min-w-0 flex-1 truncate text-[12.5px] xl:text-[13.5px]',
                active ? 'font-bold text-[var(--ink)]' : 'font-semibold text-[var(--ink-body)]'
              )}
            >
              {name}
            </Text>
            {muted && (
              <IoNotificationsOffOutline
                aria-label="Muted"
                className="h-3 w-3 shrink-0 text-[var(--ink-faint)]"
              />
            )}
            {viaApp && (
              <IoPhonePortraitOutline
                aria-label="Messages via pet parent app"
                className="size-3.5 shrink-0 text-[var(--ink-faint)]"
              />
            )}
            {network && (
              <IoGlobeOutline
                aria-label="Across the network"
                className="size-3.5 shrink-0 text-[var(--ink-faint)]"
              />
            )}
            {time && (
              <Text
                as="span"
                variant="caption-2"
                className="shrink-0 text-[9.5px] text-[var(--ink-faint)] xl:text-[10.5px]"
              >
                {time}
              </Text>
            )}
          </span>
          <span className="flex items-center gap-2">
            <Text
              as="span"
              variant="caption-1"
              className={clsx(
                'min-w-0 flex-1 truncate text-[11px] xl:text-[11.5px]',
                unread ? 'text-[var(--ink-muted)]' : 'text-[var(--ink-faint)]'
              )}
            >
              {preview}
            </Text>
            {unread ? <UnreadBadge count={unread} /> : null}
          </span>
        </span>
      </button>

      {hasActions && (
        <div className="relative shrink-0">
          <button
            type="button"
            aria-label="Conversation actions"
            onClick={() => setMenuOpen((o) => !o)}
            className={clsx(
              // On the wide desktop frame the kebab is a persistent filled inset
              // circle; on tablet it stays a hover-revealed action.
              'inline-flex size-8 items-center justify-center rounded-full text-[var(--ink-faint)] transition-colors hover:bg-[var(--screen-2)] hover:text-[var(--ink)] xl:size-7 xl:bg-[var(--inset)] xl:text-[var(--ink-body)]',
              menuOpen
                ? 'opacity-100'
                : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100 xl:opacity-100'
            )}
          >
            <IoEllipsisVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={close}
              />
              <div className="absolute right-0 top-9 z-20 w-[190px] rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-1.5 shadow-lg">
                {onArchive && (
                  <MenuItem
                    icon={<IoArchiveOutline className="h-3.5 w-3.5 text-[var(--ink-muted)]" />}
                    label="Archive"
                    onClick={() => {
                      onArchive();
                      close();
                    }}
                  />
                )}
                {onUnarchive && (
                  <MenuItem
                    icon={<IoArchiveOutline className="h-3.5 w-3.5 text-[var(--ink-muted)]" />}
                    label="Unarchive"
                    onClick={() => {
                      onUnarchive();
                      close();
                    }}
                  />
                )}
                {muted
                  ? onUnmute && (
                      <MenuItem
                        active
                        icon={
                          <IoNotificationsOutline className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                        }
                        label="Unmute"
                        onClick={() => {
                          onUnmute();
                          close();
                        }}
                      />
                    )
                  : onMute && (
                      <MenuItem
                        active
                        icon={
                          <IoNotificationsOffOutline className="h-3.5 w-3.5 text-[var(--ink-muted)]" />
                        }
                        label="Mute"
                        onClick={() => {
                          onMute();
                          close();
                        }}
                      />
                    )}
                {onSnooze && (
                  <>
                    <hr className="my-1 h-px border-0 bg-[var(--hairline)]" />
                    <MenuItem
                      icon={<IoMoonOutline className="h-3.5 w-3.5 text-[var(--ink-muted)]" />}
                      label="Snooze · 1 hour"
                      onClick={() => {
                        onSnooze(HOUR_MS);
                        close();
                      }}
                    />
                    <MenuItem
                      icon={<IoMoonOutline className="h-3.5 w-3.5 text-[var(--ink-muted)]" />}
                      label="Snooze · 1 day"
                      onClick={() => {
                        onSnooze(24 * HOUR_MS);
                        close();
                      }}
                    />
                  </>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default ConversationRow;
