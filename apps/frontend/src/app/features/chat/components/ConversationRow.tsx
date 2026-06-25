'use client';

import { useState, type MouseEvent, type ReactNode } from 'react';
import {
  LuGlobe,
  LuSmartphone,
  LuBellOff,
  LuBell,
  LuMoreVertical,
  LuAlarmClock,
  LuArchive,
} from 'react-icons/lu';
import clsx from 'clsx';
import Text from '@/app/ui/Text';
import { Badge } from '@/app/ui';
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
}>;

const HOUR_MS = 60 * 60 * 1000;

function MenuItem({
  icon,
  label,
  onClick,
}: Readonly<{ icon: ReactNode; label: string; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft"
    >
      {icon}
      <Text as="span" variant="body-4" className="text-neutral-900">
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
}: ConversationRowProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const hasActions = Boolean(onMute || onUnmute || onSnooze || onArchive);
  const close = () => setMenuOpen(false);

  return (
    <div
      className={clsx(
        'group relative flex items-center rounded-2xl pr-1',
        active ? 'bg-chat-panel' : 'hover:bg-chat-surface-soft'
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-current={active}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3 py-2.5 text-left"
      >
        <ChatAvatar name={name} online={online} group={group} />
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <Text
              as="span"
              variant="body-4-emphasis"
              className="min-w-0 flex-1 truncate text-neutral-900"
            >
              {name}
            </Text>
            {viaApp && (
              <LuSmartphone
                aria-label="Messages via pet parent app"
                className="h-3.5 w-3.5 shrink-0 text-neutral-400"
              />
            )}
            {network && (
              <LuGlobe
                aria-label="Across the network"
                className="h-3.5 w-3.5 shrink-0 text-neutral-500"
              />
            )}
            {time && (
              <Text as="span" variant="caption-2" className="shrink-0 text-neutral-500">
                {time}
              </Text>
            )}
          </span>
          <span className="flex items-center gap-2">
            <Text
              as="span"
              variant="caption-1"
              className={clsx(
                'min-w-0 flex-1 truncate',
                unread ? 'font-semibold text-neutral-700' : 'text-neutral-500'
              )}
            >
              {preview}
            </Text>
            {muted && (
              <LuBellOff aria-label="Muted" className="h-3.5 w-3.5 shrink-0 text-neutral-500" />
            )}
            {unread ? <Badge tone="brand">{unread}</Badge> : null}
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
              'inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-neutral-0 hover:text-neutral-900',
              menuOpen
                ? 'opacity-100'
                : 'opacity-0 focus-visible:opacity-100 group-hover:opacity-100'
            )}
          >
            <LuMoreVertical className="h-4 w-4" />
          </button>
          {menuOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={close}
              />
              <div className="absolute right-0 top-9 z-20 w-44 rounded-2xl border border-chat-divider bg-neutral-0 p-1.5 shadow-lg">
                {muted
                  ? onUnmute && (
                      <MenuItem
                        icon={<LuBell className="h-4 w-4 text-neutral-500" />}
                        label="Unmute"
                        onClick={() => {
                          onUnmute();
                          close();
                        }}
                      />
                    )
                  : onMute && (
                      <MenuItem
                        icon={<LuBellOff className="h-4 w-4 text-neutral-500" />}
                        label="Mute"
                        onClick={() => {
                          onMute();
                          close();
                        }}
                      />
                    )}
                {onSnooze && (
                  <MenuItem
                    icon={<LuAlarmClock className="h-4 w-4 text-neutral-500" />}
                    label="Snooze 1 hour"
                    onClick={() => {
                      onSnooze(HOUR_MS);
                      close();
                    }}
                  />
                )}
                {onSnooze && (
                  <MenuItem
                    icon={<LuAlarmClock className="h-4 w-4 text-neutral-500" />}
                    label="Snooze 1 day"
                    onClick={() => {
                      onSnooze(24 * HOUR_MS);
                      close();
                    }}
                  />
                )}
                {onArchive && (
                  <MenuItem
                    icon={<LuArchive className="h-4 w-4 text-neutral-500" />}
                    label="Archive"
                    onClick={() => {
                      onArchive();
                      close();
                    }}
                  />
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
