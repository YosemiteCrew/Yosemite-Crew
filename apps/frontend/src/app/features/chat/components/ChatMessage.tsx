'use client';

/**
 * Custom Stream message UI for the redesigned chat. Driven by stream-chat-react
 * context hooks so all behaviour is real Stream behaviour:
 *   - reactions via handleReaction (emoji used as the reaction type)
 *   - quote-reply via handleOpenThread
 *   - edit via editMessage, delete via deleteMessage (ChannelActionContext)
 *   - read-receipt status from readBy + message.status
 * Registered on <Channel Message={ChatMessage}> in ChatContainer.
 */

import { useState, type MouseEvent, type SyntheticEvent } from 'react';
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
}: Readonly<{ label: string; onClick?: (e: MouseEvent) => void; children: React.ReactNode }>) {
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

export function ChatMessage() {
  const { message, isMyMessage, handleReaction, handleOpenThread, readBy } = useMessageContext();
  const { editMessage, deleteMessage } = useChannelActionContext();
  const mine = isMyMessage();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(message.text ?? '');

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

  const counts = (message.reaction_counts ?? {}) as Record<string, number>;
  const ownTypes = new Set(
    ((message.own_reactions ?? []) as { type?: string }[]).map((r) => r.type)
  );
  const reactions = Object.entries(counts)
    .filter(([, c]) => c > 0)
    .map(([emoji, count]) => ({ emoji, count, mine: ownTypes.has(emoji) }));

  const time = message.created_at
    ? new Date(message.created_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
    : '';
  const seen = mine && (readBy?.length ?? 0) > 0;
  const sending = message.status === 'sending';
  const counterpartName = message.user?.name || message.user?.id || 'User';
  const hasText = Boolean(message.text);
  const hasAttachments = Boolean(message.attachments?.length);
  const sharedEntity = (message as unknown as { sharedEntity?: SharedEntityData }).sharedEntity;

  const saveEdit = async () => {
    const text = editText.trim();
    if (text && text !== message.text) await editMessage({ ...message, text });
    setEditing(false);
  };

  const closeMenus = () => {
    setPickerOpen(false);
    setMenuOpen(false);
  };

  const actions = (
    <span className="relative flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
      <MsgIconButton
        label="React"
        onClick={() => {
          closeMenus();
          setPickerOpen(true);
        }}
      >
        <LuSmile className="h-4 w-4" />
      </MsgIconButton>
      <MsgIconButton
        label="Reply"
        onClick={(e) => handleOpenThread(e as unknown as SyntheticEvent)}
      >
        <LuCornerUpLeft className="h-4 w-4" />
      </MsgIconButton>
      {mine && (
        <MsgIconButton
          label="More"
          onClick={() => {
            closeMenus();
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
              mine ? 'right-0' : 'left-0'
            )}
          >
            {REACTION_EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                onClick={(ev) => {
                  handleReaction(emoji, ev);
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
              mine ? 'right-0' : 'left-0'
            )}
          >
            <button
              type="button"
              onClick={() => {
                setEditText(message.text ?? '');
                setEditing(true);
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
                void deleteMessage(message);
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

  return (
    <div
      className={clsx(
        'group flex w-full items-end gap-2 px-1 py-1',
        mine ? 'justify-end' : 'justify-start'
      )}
    >
      {!mine && <ChatAvatar name={counterpartName} size="sm" />}
      <div
        className={clsx(
          'flex max-w-[80%] flex-col gap-1 sm:max-w-md',
          mine ? 'items-end' : 'items-start'
        )}
      >
        <div className="flex items-center gap-1">
          {mine && actions}
          {editing ? (
            <div className="flex items-center gap-2 rounded-2xl border border-input-border-active bg-neutral-0 px-2 py-1">
              <input
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void saveEdit();
                  }
                  if (e.key === 'Escape') setEditing(false);
                }}
                autoFocus
                aria-label="Edit message"
                className="w-48 bg-transparent font-satoshi text-sm text-neutral-900 outline-none"
              />
              <MsgIconButton label="Save edit" onClick={() => void saveEdit()}>
                <LuCheck className="h-4 w-4 text-primary-600" />
              </MsgIconButton>
              <MsgIconButton label="Cancel edit" onClick={() => setEditing(false)}>
                <LuX className="h-4 w-4" />
              </MsgIconButton>
            </div>
          ) : sharedEntity ? (
            <SharedEntityCard entity={sharedEntity} mine={mine} />
          ) : (
            <div className={clsx('flex flex-col gap-1', mine ? 'items-end' : 'items-start')}>
              {hasAttachments && (
                <div className="max-w-full overflow-hidden rounded-2xl">
                  <Attachment attachments={message.attachments ?? []} />
                </div>
              )}
              {hasText && (
                <div
                  className={clsx(
                    'px-4 py-2.5',
                    mine
                      ? 'rounded-2xl rounded-br-md bg-primary-500 text-neutral-0'
                      : 'rounded-2xl rounded-bl-md bg-neutral-100 text-neutral-900'
                  )}
                >
                  <Text
                    as="p"
                    variant="body-4"
                    className={mine ? 'text-neutral-0' : 'text-neutral-900'}
                  >
                    {renderText(message.text ?? '', mine)}
                  </Text>
                </div>
              )}
            </div>
          )}
          {!mine && actions}
        </div>
        <span className="flex items-center gap-2 px-1">
          {reactions.length > 0 && (
            <span className="flex items-center gap-1">
              {reactions.map((r) => (
                <button
                  key={r.emoji}
                  type="button"
                  onClick={(e) => handleReaction(r.emoji, e)}
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
          )}
          <Text as="span" variant="caption-2" className="text-neutral-500">
            {time}
          </Text>
          {mine &&
            (sending ? (
              <LuClock aria-label="Sending" className="h-3.5 w-3.5 text-neutral-400" />
            ) : seen ? (
              <LuCheckCheck aria-label="Seen" className="h-3.5 w-3.5 text-primary-500" />
            ) : (
              <LuCheck aria-label="Sent" className="h-3.5 w-3.5 text-neutral-400" />
            ))}
        </span>
      </div>
    </div>
  );
}

export default ChatMessage;
