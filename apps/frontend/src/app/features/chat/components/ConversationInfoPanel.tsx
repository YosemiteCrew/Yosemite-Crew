'use client';

/**
 * Conversation info drawer (design "Chat conversation info"): a 390px right-hand
 * panel opened from the client-chat header. Shows the counterpart header with a
 * deep link to the client record, a mute toggle, the member list, the shared
 * media / files / pinned digests derived from the already-loaded Stream channel
 * state, and an archive footer. Presentational — every mutation is delegated to
 * the callbacks ChatContainer passes in.
 */

import { useMemo, type ReactNode } from 'react';
import type { Channel as StreamChannel } from 'stream-chat';
import {
  IoArchiveOutline,
  IoArrowForward,
  IoDocumentTextOutline,
  IoImageOutline,
  IoNotificationsOffOutline,
  IoPin,
  IoPlayCircleOutline,
} from 'react-icons/io5';
import clsx from 'clsx';
import Text from '@/app/ui/Text';
import ModalHeader from '@/app/ui/overlays/Modal/ModalHeader';
import Secondary from '@/app/ui/primitives/Buttons/Secondary';
import { ChatAvatar } from './ChatAvatar';
import {
  deriveConversationAttachments,
  deriveConversationMembers,
  deriveConversationPinned,
} from './conversationInfoPanelUtils';
import type { ConversationInfoFile } from './conversationInfoPanelUtils';

const TITLE_ID = 'chat-conversation-info-title';

/** Design: 10.5px / 700 / 0.1em uppercase --ink-faint, with an optional action. */
function SectionHeading({ label, action }: Readonly<{ label: string; action?: ReactNode }>) {
  return (
    <span className="flex items-center justify-between">
      <Text
        as="span"
        variant="caption-2"
        className="text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--ink-faint)]"
      >
        {label}
      </Text>
      {action}
    </span>
  );
}

function Section({ children }: Readonly<{ children: ReactNode }>) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

/** Design: 36x22 track on --band / --divider with a 16px --screen knob. */
function MuteToggle({ muted, onToggle }: Readonly<{ muted: boolean; onToggle?: () => void }>) {
  return (
    <div className="flex items-center justify-between rounded-[13px] border border-[var(--hairline)] px-3.5 py-[11px]">
      <span className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-body)]">
        <IoNotificationsOffOutline className="h-[15px] w-[15px] text-[var(--ink-faint)]" />
        Mute notifications
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={muted}
        aria-label="Mute notifications"
        onClick={onToggle}
        className={clsx(
          'relative h-[22px] w-9 shrink-0 rounded-full border transition-colors',
          muted ? 'border-[var(--cta)] bg-[var(--cta)]' : 'border-[var(--divider)] bg-[var(--band)]'
        )}
      >
        <span
          className={clsx(
            'absolute top-[2px] h-4 w-4 rounded-full bg-[var(--screen)] shadow-[0_1px_2px_var(--sh08)] transition-[left]',
            muted ? 'left-[17px]' : 'left-[3px]'
          )}
        />
      </button>
    </div>
  );
}

function MediaTile({ kind }: Readonly<{ kind: 'image' | 'video' }>) {
  return (
    <span
      className="flex h-[74px] items-center justify-center rounded-[11px] border border-[var(--hairline)] text-[var(--ink-faint)]"
      style={{ background: 'linear-gradient(135deg, var(--inset), var(--screen-2))' }}
    >
      {kind === 'video' ? (
        <IoPlayCircleOutline className="h-[18px] w-[18px]" aria-label="Shared video" />
      ) : (
        <IoImageOutline className="h-[18px] w-[18px]" aria-label="Shared image" />
      )}
    </span>
  );
}

function FileRow({ file }: Readonly<{ file: ConversationInfoFile }>) {
  return (
    <span className="flex items-center gap-[9px]">
      <span className="flex size-[30px] shrink-0 items-center justify-center rounded-[9px] bg-[var(--blue-soft)] text-[var(--blue-text)]">
        <IoDocumentTextOutline className="h-3.5 w-3.5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <Text
          as="span"
          variant="caption-1"
          className="truncate text-[12.5px] font-semibold text-[var(--ink-body)]"
        >
          {file.name}
        </Text>
        {file.meta && (
          <Text as="span" variant="caption-2" className="text-[10.5px] text-[var(--ink-faint)]">
            {file.meta}
          </Text>
        )}
      </span>
    </span>
  );
}

export type ConversationInfoPanelProps = Readonly<{
  channel: StreamChannel | null;
  name: string;
  subtitle?: string;
  online?: boolean;
  /** Deep link to the counterpart's client record ("View client record"). */
  clientRecordHref?: string;
  muted: boolean;
  onToggleMute?: () => void;
  onArchive?: () => void;
  onClose: () => void;
}>;

export function ConversationInfoPanel({
  channel,
  name,
  subtitle,
  online,
  clientRecordHref,
  muted,
  onToggleMute,
  onArchive,
  onClose,
}: ConversationInfoPanelProps) {
  const members = useMemo(() => deriveConversationMembers(channel), [channel]);
  const { media, files } = useMemo(() => deriveConversationAttachments(channel), [channel]);
  const pinned = useMemo(() => deriveConversationPinned(channel), [channel]);

  return (
    <aside className="chat-conversation-info" aria-labelledby={TITLE_ID}>
      <div className="shrink-0 border-b border-[var(--hairline)] px-5 py-3.5">
        <ModalHeader title="Conversation info" onClose={onClose} titleId={TITLE_ID} />
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-5 py-4">
        <div className="flex items-center gap-3">
          <ChatAvatar name={name} online={online} size="xl" />
          <span className="flex min-w-0 flex-1 flex-col">
            <Text
              as="span"
              variant="body-3-emphasis"
              className="truncate text-[15px] font-bold text-[var(--ink)]"
            >
              {name}
            </Text>
            {subtitle && (
              <Text
                as="span"
                variant="caption-1"
                className="truncate text-[11.5px] text-[var(--ink-faint)]"
              >
                {subtitle}
              </Text>
            )}
            {clientRecordHref && (
              <a
                href={clientRecordHref}
                className="mt-0.5 flex items-center gap-1 text-[11.5px] font-semibold text-[var(--blue-text)]"
              >
                View client record
                <IoArrowForward className="h-[11px] w-[11px]" />
              </a>
            )}
          </span>
        </div>

        <MuteToggle muted={muted} onToggle={onToggleMute} />

        {members.length > 0 && (
          <Section>
            <SectionHeading label={`Members · ${members.length}`} />
            {members.map((member) => (
              <span key={member.id} className="flex items-center gap-[9px]">
                <ChatAvatar name={member.name} size="xxs" />
                <Text
                  as="span"
                  variant="caption-1"
                  className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-[var(--ink-body)]"
                >
                  {member.name}
                </Text>
                {member.role && (
                  <Text
                    as="span"
                    variant="caption-2"
                    className="shrink-0 text-[10.5px] text-[var(--ink-faint)]"
                  >
                    {member.role}
                  </Text>
                )}
              </span>
            ))}
          </Section>
        )}

        {media.length > 0 && (
          <Section>
            <SectionHeading label={`Shared media · ${media.length}`} />
            <div className="grid grid-cols-3 gap-[7px]">
              {media.slice(0, 6).map((item) => (
                <MediaTile key={item.id} kind={item.kind} />
              ))}
            </div>
          </Section>
        )}

        {files.length > 0 && (
          <Section>
            <SectionHeading label={`Files · ${files.length}`} />
            {files.slice(0, 4).map((file) => (
              <FileRow key={file.id} file={file} />
            ))}
          </Section>
        )}

        {pinned.length > 0 && (
          <Section>
            <SectionHeading label={`Pinned · ${pinned.length}`} />
            {pinned.slice(0, 3).map((item) => (
              <span
                key={item.id}
                className="flex items-start gap-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface-soft)] px-3 py-[9px]"
              >
                <IoPin className="mt-0.5 h-[11px] w-[11px] shrink-0 text-[var(--blue-text)]" />
                <Text
                  as="span"
                  variant="caption-1"
                  className="min-w-0 flex-1 truncate text-[11.5px] leading-[1.5] text-[var(--ink-body)]"
                >
                  {item.text}
                </Text>
              </span>
            ))}
          </Section>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-[var(--hairline)] bg-[var(--screen-2)] px-5 py-3">
        <Secondary
          size="compact"
          text="Archive conversation"
          icon={<IoArchiveOutline aria-hidden="true" />}
          onClick={onArchive}
        />
        <Text
          as="span"
          variant="caption-2"
          className="ml-auto text-[10.5px] text-[var(--ink-faint)]"
        >
          History retained per clinic policy
        </Text>
      </div>
    </aside>
  );
}

export default ConversationInfoPanel;
