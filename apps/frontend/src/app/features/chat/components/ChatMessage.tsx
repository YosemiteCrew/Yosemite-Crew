'use client';

/**
 * Custom Stream message UI for the redesigned chat. Driven by stream-chat-react
 * context hooks so all behaviour is real Stream behaviour:
 *   - reactions via handleReaction (emoji used as the reaction type)
 *   - quote-reply via handleOpenThread
 *   - edit via editMessage, delete via deleteMessage (ChannelActionContext)
 *   - read-receipt status from readBy + message.status
 * Registered on <Channel Message={ChatMessage}> in ChatContainer. The bubble,
 * actions, editor, reactions and status icon are split into small components so
 * the top-level component stays simple to read and test.
 */

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
  type ReactNode,
  type Ref,
  type RefObject,
  type SyntheticEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { useMessageContext, useChannelActionContext, Attachment } from 'stream-chat-react';
import {
  IoCheckmarkDone,
  IoCheckmarkOutline,
  IoClose,
  IoCreateOutline,
  IoEllipsisVertical,
  IoHappyOutline,
  IoReturnUpBackOutline,
  IoTimeOutline,
  IoTrashOutline,
} from 'react-icons/io5';
import clsx from 'clsx';
import Text from '@/app/ui/Text';
import { ChatAvatar } from './ChatAvatar';
import { SharedEntityCard, type SharedEntityData } from './SharedEntityCard';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '✅'];

type ReactionChip = Readonly<{ emoji: string; count: number; mine: boolean }>;
type MentionTextPart = Readonly<{ key: string; value: string }>;

type ReactionSource = {
  reaction_groups?: Record<string, { count?: number }> | null;
  reaction_counts?: Record<string, number> | null;
  own_reactions?: { type?: string }[] | null;
};

/**
 * Aggregate reactions for display. Stream v13 reports them in `reaction_groups`;
 * older payloads use `reaction_counts`. Groups are read first so reactions render.
 */
function getReactionChips(message: ReactionSource): ReactionChip[] {
  const groups = message.reaction_groups;
  const counts = (message.reaction_counts ?? {}) as Record<string, number>;
  const ownTypes = new Set((message.own_reactions ?? []).map((r) => r.type));
  const entries: Array<[string, number]> =
    groups && Object.keys(groups).length > 0
      ? Object.entries(groups).map(([emoji, g]) => [emoji, g.count ?? 0])
      : Object.entries(counts);
  const chips: ReactionChip[] = [];
  for (const [emoji, count] of entries) {
    if (count > 0) {
      chips.push({ emoji, count, mine: ownTypes.has(emoji) });
    }
  }
  return chips;
}

function splitMentionAwareText(body: string): MentionTextPart[] {
  let offset = 0;
  return body.split(/(@\w[\w-]*)/g).map((value) => {
    const key = `${offset}-${value}`;
    offset += value.length;
    return { key, value };
  });
}

function MentionAwareText({ body, mine }: Readonly<{ body: string; mine: boolean }>) {
  return (
    <>
      {splitMentionAwareText(body).map((part) =>
        part.value.startsWith('@') ? (
          <span
            key={part.key}
            className={clsx(
              'font-semibold',
              mine ? 'text-[var(--cta-text)] underline' : 'text-[var(--blue-text)]'
            )}
          >
            {part.value}
          </span>
        ) : (
          part.value
        )
      )}
    </>
  );
}

// React 19 passes `ref` as a normal prop, so no forwardRef wrapper is needed.
function MsgIconButton({
  label,
  onClick,
  children,
  ref,
}: Readonly<{
  label: string;
  onClick?: (e: MouseEvent) => void;
  children: ReactNode;
  ref?: Ref<HTMLButtonElement>;
}>) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex size-7 items-center justify-center rounded-full text-[var(--ink-soft)] transition-colors hover:bg-[var(--screen-2)] hover:text-[var(--ink)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
    >
      {children}
    </button>
  );
}

const POPOVER_MEASURE_STYLE: CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  visibility: 'hidden',
  zIndex: 5000,
};

/**
 * Popover anchored to a trigger button and rendered through a portal to
 * document.body, so Stream's overflow:auto message list never clips it. It opens
 * below the trigger (matching the design) and flips above only when there is no
 * room before the viewport bottom — the last-message case that used to crop the
 * reaction picker. Dismisses on outside click, scroll, resize, or Escape.
 */
function AnchoredPopover({
  anchorRef,
  open,
  onClose,
  align,
  className,
  children,
}: Readonly<{
  anchorRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
  align: 'left' | 'right';
  className: string;
  children: ReactNode;
}>) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<CSSProperties | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setStyle(null);
      return;
    }
    const anchor = anchorRef.current?.getBoundingClientRect();
    const panel = panelRef.current;
    if (!anchor || !panel) return;
    const panelH = panel.offsetHeight;
    const panelW = panel.offsetWidth;
    const vw = globalThis.window.innerWidth;
    const vh = globalThis.window.innerHeight;
    const below = anchor.bottom + 6;
    const flipUp = below + panelH + 8 > vh;
    const top = flipUp ? Math.max(8, anchor.top - panelH - 6) : below;
    const rawLeft = align === 'right' ? anchor.right - panelW : anchor.left;
    const left = Math.min(Math.max(8, rawLeft), Math.max(8, vw - panelW - 8));
    setStyle({ position: 'fixed', top, left, zIndex: 5000 });
  }, [open, anchorRef, align]);

  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const handlePointer = (event: Event) => {
      const target = event.target as Node;
      if (panelRef.current?.contains(target) || anchorRef.current?.contains(target)) return;
      onCloseRef.current();
    };
    const dismiss = () => onCloseRef.current();
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('mousedown', handlePointer);
    globalThis.window.addEventListener('scroll', dismiss, { passive: true, capture: true });
    globalThis.window.addEventListener('resize', dismiss);
    document.addEventListener('keydown', handleKey);
    return () => {
      document.removeEventListener('mousedown', handlePointer);
      globalThis.window.removeEventListener('scroll', dismiss, {
        capture: true,
      } as EventListenerOptions);
      globalThis.window.removeEventListener('resize', dismiss);
      document.removeEventListener('keydown', handleKey);
    };
  }, [open, anchorRef]);

  if (!open || typeof document === 'undefined') return null;
  return createPortal(
    <div ref={panelRef} style={style ?? POPOVER_MEASURE_STYLE} className={className}>
      {children}
    </div>,
    document.body
  );
}

/** Read-receipt indicator for an outgoing message. */
function MessageStatusIcon({ sending, seen }: Readonly<{ sending: boolean; seen: boolean }>) {
  if (sending)
    return (
      <IoTimeOutline aria-label="Sending" className="h-[11px] w-[11px] text-[var(--ink-faint)]" />
    );
  if (seen)
    return <IoCheckmarkDone aria-label="Seen" className="h-3.5 w-3.5 text-[var(--blue-text)]" />;
  return <IoCheckmarkOutline aria-label="Sent" className="h-3.5 w-3.5 text-[var(--ink-faint)]" />;
}

/** Hover actions: react and reply, plus edit/delete for the user's own messages. */
function MessageActions({
  mine,
  onReact,
  onReply,
  onEdit,
  onDelete,
}: Readonly<{
  mine: boolean;
  onReact: (emoji: string, e: MouseEvent) => void;
  onReply: (e: SyntheticEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
}>) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const reactBtnRef = useRef<HTMLButtonElement>(null);
  const moreBtnRef = useRef<HTMLButtonElement>(null);
  const closeAll = () => {
    setPickerOpen(false);
    setMenuOpen(false);
  };
  const align = mine ? 'right' : 'left';
  return (
    <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <MsgIconButton
        ref={reactBtnRef}
        label="React"
        onClick={() => {
          closeAll();
          setPickerOpen(true);
        }}
      >
        <IoHappyOutline className="h-4 w-4" />
      </MsgIconButton>
      <MsgIconButton label="Reply" onClick={(e) => onReply(e as unknown as SyntheticEvent)}>
        <IoReturnUpBackOutline className="h-4 w-4" />
      </MsgIconButton>
      {mine && (
        <MsgIconButton
          ref={moreBtnRef}
          label="More"
          onClick={() => {
            closeAll();
            setMenuOpen(true);
          }}
        >
          <IoEllipsisVertical className="h-4 w-4" />
        </MsgIconButton>
      )}
      <AnchoredPopover
        anchorRef={reactBtnRef}
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        align={align}
        className="flex items-center gap-0.5 rounded-full border border-[var(--hairline)] bg-[var(--screen)] p-1 shadow-[0_6px_16px_var(--sh10),0_20px_48px_var(--sh12)]"
      >
        {REACTION_EMOJIS.map((emoji) => (
          <button
            key={emoji}
            type="button"
            onClick={(ev) => {
              onReact(emoji, ev);
              setPickerOpen(false);
            }}
            className="flex size-8 items-center justify-center rounded-full text-lg leading-none hover:bg-[var(--inset)]"
          >
            {emoji}
          </button>
        ))}
      </AnchoredPopover>
      <AnchoredPopover
        anchorRef={moreBtnRef}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        align={align}
        className="w-36 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-1.5 shadow-[0_6px_16px_var(--sh10),0_24px_56px_var(--sh12)]"
      >
        <button
          type="button"
          onClick={() => {
            onEdit();
            setMenuOpen(false);
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--screen-2)]"
        >
          <IoCreateOutline className="h-4 w-4 text-[var(--ink-faint)]" />
          <Text as="span" variant="body-4" className="text-[var(--ink-body)]">
            Edit
          </Text>
        </button>
        <button
          type="button"
          onClick={() => {
            onDelete();
            setMenuOpen(false);
          }}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--screen-2)]"
        >
          <IoTrashOutline className="h-4 w-4 text-[var(--danger-text)]" />
          <Text as="span" variant="body-4" className="text-[var(--danger-text)]">
            Delete
          </Text>
        </button>
      </AnchoredPopover>
    </span>
  );
}

/** Inline editor for the user's own message; commits only on a real change. */
function MessageEditor({
  initialText,
  onSave,
  onCancel,
}: Readonly<{ initialText: string; onSave: (text: string) => void; onCancel: () => void }>) {
  const [text, setText] = useState(initialText);
  const save = () => {
    const trimmed = text.trim();
    if (trimmed && trimmed !== initialText) onSave(trimmed);
    else onCancel();
  };
  return (
    <div className="flex items-center gap-2 rounded-2xl border border-[var(--blue)] bg-[var(--screen)] px-2 py-1">
      <input
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            save();
          }
          if (e.key === 'Escape') onCancel();
        }}
        aria-label="Edit message"
        className="w-48 bg-transparent font-satoshi text-sm text-[var(--ink-body)] outline-none"
      />
      <MsgIconButton label="Save edit" onClick={save}>
        <IoCheckmarkOutline className="h-4 w-4 text-[var(--blue-text)]" />
      </MsgIconButton>
      <MsgIconButton label="Cancel edit" onClick={onCancel}>
        <IoClose className="h-4 w-4" />
      </MsgIconButton>
    </div>
  );
}

/** Attachment(s) plus the text bubble for a normal message. */
function MessageBubble({
  mine,
  text,
  attachments,
}: Readonly<{ mine: boolean; text: string; attachments: unknown[] }>) {
  return (
    <div className={clsx('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
      {attachments.length > 0 && (
        <div className="max-w-full overflow-hidden rounded-2xl">
          <Attachment attachments={attachments as never} />
        </div>
      )}
      {text.length > 0 && (
        <div
          className={clsx(
            'px-[13px] py-[10px] xl:px-[15px] xl:py-[11px]',
            mine
              ? 'rounded-[15px_15px_4px_15px] bg-[var(--cta)] text-[var(--cta-text)] xl:rounded-[18px_18px_4px_18px]'
              : // Design (Chat extended / thread panel / conversation info): the
                // received bubble is --inset with a --divider edge.
                'rounded-[15px_15px_15px_4px] border border-[var(--divider)] bg-[var(--inset)] text-[var(--ink-body)] xl:rounded-[18px_18px_18px_4px]'
          )}
        >
          <Text
            as="p"
            variant="body-4"
            className={clsx(
              'text-[13px] leading-normal xl:text-[13.5px] xl:leading-[1.55]',
              mine ? 'text-[var(--cta-text)]' : 'text-[var(--ink-body)]'
            )}
          >
            <MentionAwareText body={text} mine={mine} />
          </Text>
        </div>
      )}
    </div>
  );
}

/**
 * Existing reactions as a single combined pill that overlaps the bubble's
 * bottom edge (design: "❤️ 👍 2"). Each emoji stays an individually toggleable
 * button (aria "N emoji reaction"); the trailing count is the running total.
 */
function MessageReactions({
  reactions,
  onToggle,
  mine,
}: Readonly<{
  reactions: ReactionChip[];
  onToggle: (emoji: string, e: MouseEvent) => void;
  mine: boolean;
}>) {
  if (reactions.length === 0) return null;
  const total = reactions.reduce((sum, r) => sum + r.count, 0);
  return (
    <span
      className={clsx(
        'absolute -bottom-3 z-[1] flex items-center gap-1 rounded-full border border-[var(--hairline)] bg-[var(--screen)] px-2 py-0.5 text-[10.5px] shadow-[0_2px_6px_var(--sh08)]',
        mine ? 'right-3' : 'left-3'
      )}
    >
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={(e) => onToggle(r.emoji, e)}
          aria-label={`${r.count} ${r.emoji} reaction`}
          className={clsx('leading-none', r.mine && 'saturate-150')}
        >
          {r.emoji}
        </button>
      ))}
      <span className="font-bold text-[var(--ink-faint)]">{total}</span>
    </span>
  );
}

/** Meta line label: outgoing messages append the staff sender name to the time. */
const formatMessageTimeLabel = (mine: boolean, time: string, senderName?: string): string =>
  mine && senderName ? `${time} · ${senderName}` : time;

/** Left avatar gutter for incoming messages; a spacer keeps grouped rows aligned. */
function MessageGutter({
  mine,
  firstOfGroup,
  name,
}: Readonly<{ mine: boolean; firstOfGroup?: boolean; name: string }>) {
  if (mine) return null;
  if (firstOfGroup === false) return <span className="w-[26px] shrink-0" aria-hidden="true" />;
  return <ChatAvatar name={name} size="xs" />;
}

export function ChatMessage({ firstOfGroup }: Readonly<{ firstOfGroup?: boolean }>) {
  const { message, isMyMessage, handleReaction, handleOpenThread, readBy } = useMessageContext();
  const { editMessage, deleteMessage } = useChannelActionContext();
  const mine = isMyMessage();
  const [editing, setEditing] = useState(false);

  if (message.deleted_at || message.type === 'deleted') {
    return (
      <div className={clsx('flex w-full px-1 py-0.5', mine ? 'justify-end' : 'justify-start')}>
        <Text
          as="span"
          variant="caption-1"
          className={clsx('italic text-[var(--ink-faint)]', mine ? '' : 'ml-11')}
        >
          This message was deleted
        </Text>
      </div>
    );
  }

  const reactions = getReactionChips(message as ReactionSource);
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString('en-US', {
        hour: 'numeric',
        minute: '2-digit',
        timeZone: 'UTC',
      })
    : '';
  const seen = mine && (readBy?.length ?? 0) > 0;
  const sending = message.status === 'sending';
  const counterpartName = message.user?.name || message.user?.id || 'User';
  const senderName = message.user?.name;
  const sharedEntity = (message as unknown as { sharedEntity?: SharedEntityData }).sharedEntity;

  const actions = (
    <MessageActions
      mine={mine}
      onReact={handleReaction}
      onReply={handleOpenThread}
      onEdit={() => setEditing(true)}
      onDelete={() => void deleteMessage(message)}
    />
  );

  let body: ReactNode;
  if (editing) {
    body = (
      <MessageEditor
        initialText={message.text ?? ''}
        onSave={(text) => {
          void editMessage({ ...message, text });
          setEditing(false);
        }}
        onCancel={() => setEditing(false)}
      />
    );
  } else if (sharedEntity) {
    body = <SharedEntityCard entity={sharedEntity} mine={mine} />;
  } else {
    body = (
      <MessageBubble
        mine={mine}
        text={message.text ?? ''}
        attachments={message.attachments ?? []}
      />
    );
  }

  return (
    <div
      className={clsx(
        'group flex w-full items-end gap-2 px-1 py-1',
        mine ? 'justify-end' : 'justify-start'
      )}
    >
      <MessageGutter mine={mine} firstOfGroup={firstOfGroup} name={counterpartName} />
      <div
        className={clsx(
          // Design: bubble column caps at 460px on the wide desktop frame.
          'flex max-w-[80%] flex-col gap-1 sm:max-w-md xl:max-w-[460px]',
          mine ? 'items-end' : 'items-start'
        )}
      >
        <div className="flex items-center gap-1">
          {mine && actions}
          <div className="relative">
            {body}
            <MessageReactions reactions={reactions} onToggle={handleReaction} mine={mine} />
          </div>
          {!mine && actions}
        </div>
        <span className={clsx('flex items-center gap-2 px-1', reactions.length > 0 && 'mt-2.5')}>
          {/* Design (message meta): 10.5px --ink-faint, e.g. "09:29 · Dr. Weber". */}
          <Text as="span" variant="caption-2" className="text-[10.5px] text-[var(--ink-faint)]">
            {formatMessageTimeLabel(mine, time, senderName)}
          </Text>
          {mine && <MessageStatusIcon sending={sending} seen={seen} />}
        </span>
      </div>
    </div>
  );
}

export default ChatMessage;
