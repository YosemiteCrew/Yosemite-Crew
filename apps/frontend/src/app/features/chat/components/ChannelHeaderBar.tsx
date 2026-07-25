import type { FC } from 'react';
import { IoArrowBack, IoInformationCircleOutline } from 'react-icons/io5';
import Primary from '@/app/ui/primitives/Buttons/Primary';
import Text from '@/app/ui/Text';
import { Badge } from '@/app/ui';
import { ChatAvatar } from './ChatAvatar';
import MessageSearch from './MessageSearch';

/**
 * What kind of conversation the bar is describing — grouped into one descriptor
 * so the header takes a single "shape of this chat" value rather than a row of
 * independent flags whose combinations are hard to reason about.
 */
export type ChannelHeaderChat = {
  isClientChat: boolean;
  isGroupChat: boolean;
  sessionClosed: boolean;
  /** Live 1:1 presence: drives both the avatar halo and the green status line. */
  showPresence: boolean;
};

export interface ChannelHeaderBarProps {
  title: string;
  statusText: string;
  chat: ChannelHeaderChat;
  /** Phone-only back control; omitted entirely on desktop. */
  back?: { onBack: () => void };
  info: { open: boolean; onToggle: () => void };
  session: { closing: boolean; onClose: () => void };
  onOpenGroupInfo: () => void;
}

/**
 * Presentational thread header bar (design: one unified compact row — optional
 * round back control, avatar, name + status subtitle, then the trailing
 * search / info / group / close-session actions).
 */
const ChannelHeaderBar: FC<ChannelHeaderBarProps> = ({
  title,
  statusText,
  chat,
  back,
  info,
  session,
  onOpenGroupInfo,
}) => (
  <header className="flex shrink-0 items-center gap-2.5 border-b border-[var(--hairline)] bg-[var(--screen)] px-3.5 py-2.5 sm:gap-3 sm:px-4 sm:py-3 xl:px-[22px]">
    {back && (
      <button
        type="button"
        aria-label="Back to conversations"
        onClick={back.onBack}
        className="inline-flex size-[34px] shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-soft)] transition-colors hover:bg-[var(--screen-2)]"
      >
        <IoArrowBack className="h-[15px] w-[15px]" />
      </button>
    )}
    <ChatAvatar name={title} online={chat.showPresence} group={chat.isGroupChat} size="sm" />
    <div className="flex min-w-0 flex-1 flex-col">
      {/* Design (thread header): name + status subtitle only — the pet-parent
          relationship is carried by the subtitle, never by a header pill. */}
      <span className="flex min-w-0 items-center gap-2">
        <Text
          as="span"
          variant="body-3-emphasis"
          className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-[var(--ink)] xl:text-[14.5px]"
        >
          {title}
        </Text>
      </span>
      {chat.showPresence ? (
        /* Design (thread header, online): 11.5px --success with a 6px pulsing dot. */
        <span className="flex min-w-0 items-center gap-1.5 text-[11.5px] text-[var(--success)]">
          <span className="chat-presence-dot h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--success)]" />
          <span className="truncate">{statusText}</span>
        </span>
      ) : (
        /* Design (thread header, offline): 11px --ink-faint. */
        <Text
          as="span"
          variant="caption-2"
          className="truncate text-[11px] text-[var(--ink-faint)]"
        >
          {statusText}
        </Text>
      )}
    </div>
    {/* No phone/video calling in chat. */}
    <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
      <MessageSearch />
      {chat.isClientChat && (
        <button
          type="button"
          aria-label="Conversation info"
          aria-expanded={info.open}
          onClick={info.onToggle}
          className="inline-flex size-[30px] items-center justify-center rounded-full border border-[var(--hairline)] text-[var(--ink-faint)] transition-colors hover:bg-[var(--screen-2)] hover:text-[var(--ink)]"
        >
          <IoInformationCircleOutline className="h-3.5 w-3.5" />
        </button>
      )}
      {chat.isGroupChat && <Primary text="Group Info" onClick={onOpenGroupInfo} />}
      {chat.isClientChat && chat.sessionClosed && <Badge tone="neutral">Session closed</Badge>}
      {chat.isClientChat && !chat.sessionClosed && (
        <Primary
          text={session.closing ? 'Closing…' : 'Close session'}
          onClick={session.onClose}
          isDisabled={session.closing}
        />
      )}
    </div>
  </header>
);

export default ChannelHeaderBar;
