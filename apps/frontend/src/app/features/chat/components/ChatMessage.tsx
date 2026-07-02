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

import { useState, type MouseEvent, type ReactNode, type SyntheticEvent } from 'react';
import { useMessageContext, useChannelActionContext, Attachment } from 'stream-chat-react';
import {
  LuSmile,
  LuCornerUpLeft,
  LuMoreVertical,
  LuCheck,
  LuCheckCheck,
  LuClock,
  LuPencilLine,
  LuTrash2,
  LuX,
} from 'react-icons/lu';
import clsx from 'clsx';
import Text from '@/app/ui/Text';
import { ChatAvatar } from './ChatAvatar';
import { SharedEntityCard, type SharedEntityData } from './SharedEntityCard';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉', '🙏', '✅'];

type ReactionChip = Readonly<{ emoji: string; count: number; mine: boolean }>;

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
  return entries
    .filter(([, count]) => count > 0)
    .map(([emoji, count]) => ({ emoji, count, mine: ownTypes.has(emoji) }));
}

const renderText = (body: string, mine: boolean) =>
  body.split(/(@\w[\w-]*)/g).map((part, i) =>
    part.startsWith('@') ? (
      <span
        key={`${part}-${i}`}
        className={clsx('font-semibold', mine ? 'text-neutral-0 underline' : 'text-primary-700')}
      >
        {part}
      </span>
    ) : (
      part
    )
  );

function MsgIconButton({
  label,
  onClick,
  children,
}: Readonly<{ label: string; onClick?: (e: MouseEvent) => void; children: ReactNode }>) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-chat-panel hover:text-neutral-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-border-active"
    >
      {children}
    </button>
  );
}

/** Read-receipt indicator for an outgoing message. */
function MessageStatusIcon({ sending, seen }: Readonly<{ sending: boolean; seen: boolean }>) {
  if (sending) return <LuClock aria-label="Sending" className="h-3.5 w-3.5 text-neutral-400" />;
  if (seen) return <LuCheckCheck aria-label="Seen" className="h-3.5 w-3.5 text-primary-500" />;
  return <LuCheck aria-label="Sent" className="h-3.5 w-3.5 text-neutral-400" />;
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
  const closeAll = () => {
    setPickerOpen(false);
    setMenuOpen(false);
  };
  const side = mine ? 'right-0' : 'left-0';
  return (
    <span className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <MsgIconButton
        label="React"
        onClick={() => {
          closeAll();
          setPickerOpen(true);
        }}
      >
        <LuSmile className="h-4 w-4" />
      </MsgIconButton>
      <MsgIconButton label="Reply" onClick={(e) => onReply(e as unknown as SyntheticEvent)}>
        <LuCornerUpLeft className="h-4 w-4" />
      </MsgIconButton>
      {mine && (
        <MsgIconButton
          label="More"
          onClick={() => {
            closeAll();
            setMenuOpen(true);
          }}
        >
          <LuMoreVertical className="h-4 w-4" />
        </MsgIconButton>
      )}
      {pickerOpen && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setPickerOpen(false)}
          />
          <div
            className={clsx(
              'absolute top-9 z-20 flex items-center gap-0.5 rounded-2xl border border-chat-divider bg-neutral-0 p-1 shadow-lg',
              side
            )}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={(ev) => {
                  onReact(emoji, ev);
                  setPickerOpen(false);
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-lg hover:bg-chat-surface-soft"
              >
                {emoji}
              </button>
            ))}
          </div>
        </>
      )}
      {menuOpen && (
        <>
          <button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-10 cursor-default"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className={clsx(
              'absolute top-9 z-20 w-36 rounded-2xl border border-chat-divider bg-neutral-0 p-1.5 shadow-lg',
              side
            )}
          >
            <button
              type="button"
              onClick={() => {
                onEdit();
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft"
            >
              <LuPencilLine className="h-4 w-4 text-neutral-500" />
              <Text as="span" variant="body-4" className="text-neutral-900">
                Edit
              </Text>
            </button>
            <button
              type="button"
              onClick={() => {
                onDelete();
                setMenuOpen(false);
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft"
            >
              <LuTrash2 className="h-4 w-4 text-danger-600" />
              <Text as="span" variant="body-4" className="text-danger-600">
                Delete
              </Text>
            </button>
          </div>
        </>
      )}
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
    <div className="flex items-center gap-2 rounded-2xl border border-input-border-active bg-neutral-0 px-2 py-1">
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
        autoFocus
        aria-label="Edit message"
        className="w-48 bg-transparent font-satoshi text-sm text-neutral-900 outline-none"
      />
      <MsgIconButton label="Save edit" onClick={save}>
        <LuCheck className="h-4 w-4 text-primary-600" />
      </MsgIconButton>
      <MsgIconButton label="Cancel edit" onClick={onCancel}>
        <LuX className="h-4 w-4" />
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
            'px-4 py-2.5',
            mine
              ? 'rounded-2xl rounded-br-md bg-primary-500 text-neutral-0'
              : 'rounded-2xl rounded-bl-md bg-neutral-100 text-neutral-900'
          )}
        >
          <Text as="p" variant="body-4" className={mine ? 'text-neutral-0' : 'text-neutral-900'}>
            {renderText(text, mine)}
          </Text>
        </div>
      )}
    </div>
  );
}

/** Existing-reaction chips shown under a message. */
function MessageReactions({
  reactions,
  onToggle,
}: Readonly<{ reactions: ReactionChip[]; onToggle: (emoji: string, e: MouseEvent) => void }>) {
  if (reactions.length === 0) return null;
  return (
    <span className="flex items-center gap-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          type="button"
          onClick={(e) => onToggle(r.emoji, e)}
          aria-label={`${r.count} ${r.emoji} reaction`}
          className={clsx(
            'inline-flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs',
            r.mine
              ? 'border-primary-500 bg-chat-panel text-primary-700'
              : 'border-chat-divider bg-neutral-0 text-neutral-700'
          )}
        >
          <span>{r.emoji}</span>
          <span className="font-semibold">{r.count}</span>
        </button>
      ))}
    </span>
  );
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
          className={clsx('italic text-neutral-400', mine ? '' : 'ml-11')}
        >
          This message was deleted
        </Text>
      </div>
    );
  }

  const reactions = getReactionChips(message as ReactionSource);
  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  const seen = mine && (readBy?.length ?? 0) > 0;
  const sending = message.status === 'sending';
  const counterpartName = message.user?.name || message.user?.id || 'User';
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
      {!mine &&
        (firstOfGroup === false ? (
          <span className="w-9 shrink-0" aria-hidden="true" />
        ) : (
          <ChatAvatar name={counterpartName} size="sm" />
        ))}
      <div
        className={clsx(
          'flex max-w-[80%] flex-col gap-1 sm:max-w-md',
          mine ? 'items-end' : 'items-start'
        )}
      >
        <div className="flex items-center gap-1">
          {mine && actions}
          {body}
          {!mine && actions}
        </div>
        <span className="flex items-center gap-2 px-1">
          <MessageReactions reactions={reactions} onToggle={handleReaction} />
          <Text as="span" variant="caption-2" className="text-neutral-500">
            {time}
          </Text>
          {mine && <MessageStatusIcon sending={sending} seen={seen} />}
        </span>
      </div>
    </div>
  );
}

export default ChatMessage;
