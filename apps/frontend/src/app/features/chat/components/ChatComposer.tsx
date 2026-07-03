'use client';

/**
 * Custom composer for the redesigned chat, used as the Input component of
 * Stream's <MessageInput Input={ChatComposer} />. It reuses Stream's
 * TextareaComposer (text state, mentions, typing events, Enter-to-send, drafts)
 * and handleSubmit (the React-aware send that keeps the message list in sync),
 * adding our own attach / emoji / quick-reply controls. Attachments are staged
 * through the MessageComposer's attachmentManager; emoji and templates insert
 * via the textComposer. Only mounted for open (non-frozen) channels.
 */

import { useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import {
  useMessageInputContext,
  useMessageComposer,
  useChannelStateContext,
  TextareaComposer,
  AttachmentPreviewList,
} from 'stream-chat-react';
import { LuPlus, LuImage, LuFileText, LuSmile, LuSendHorizonal, LuShare2 } from 'react-icons/lu';
import clsx from 'clsx';
import Text from '@/app/ui/Text';
import { useChatShare } from './chatShareContext';
import { partitionUploadFiles } from '../lib/uploadSafety';

const EMOJIS = ['👍', '🙏', '❤️', '😊', '🎉', '✅', '⏰', '🐾', '💊', '📎'];

const TEMPLATES = [
  { label: 'Appointment confirmed', text: 'Your appointment is confirmed.' },
  { label: 'Arrive 10 min early', text: 'Please arrive 10 minutes early for your visit.' },
  { label: 'Results ready', text: 'Your results are ready — let us discuss them.' },
  { label: 'Share a photo', text: 'Could you share a photo so we can take a look?' },
  {
    label: 'We will reply soon',
    text: 'Thanks for your message — we will get back to you shortly.',
  },
];

function ComposerIconButton({
  label,
  active,
  onClick,
  children,
}: Readonly<{ label: string; active?: boolean; onClick: () => void; children: ReactNode }>) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={clsx(
        'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-border-active',
        active
          ? 'bg-chat-panel text-primary-600'
          : 'text-neutral-500 hover:bg-chat-panel hover:text-neutral-900'
      )}
    >
      {children}
    </button>
  );
}

export function ChatComposer() {
  const { handleSubmit, cooldownRemaining } = useMessageInputContext();
  const composer = useMessageComposer();
  const { channel } = useChannelStateContext();
  const { openShare } = useChatShare();
  const [attachOpen, setAttachOpen] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const closeAll = () => {
    setAttachOpen(false);
    setEmojiOpen(false);
  };

  const insert = (text: string) => composer.textComposer.insertText({ text });

  const onFiles = (e: ChangeEvent<HTMLInputElement>) => {
    const { files } = e.target;
    if (files?.length) {
      const { allowed, rejected } = partitionUploadFiles(files);
      if (rejected.length > 0) {
        const plural = rejected.length > 1 ? 's' : '';
        setUploadError(
          `Couldn't attach ${rejected.length} file${plural}: unsupported type or over 25 MB.`
        );
      } else {
        setUploadError(null);
      }
      if (allowed.length) void composer.attachmentManager.uploadFiles(allowed);
    }
    e.target.value = '';
    setAttachOpen(false);
  };

  const send = () => {
    closeAll();
    handleSubmit();
  };

  return (
    <div className="border-t border-chat-divider bg-neutral-0 px-2 py-2.5 sm:px-3 sm:py-3">
      <AttachmentPreviewList />
      {uploadError && (
        <div role="alert" className="mb-2">
          <Text as="p" variant="caption-1" className="text-danger-600">
            {uploadError}
          </Text>
        </div>
      )}
      <div className="mb-2 flex gap-2 overflow-x-auto pb-1">
        {TEMPLATES.map((t) => (
          <button
            key={t.label}
            type="button"
            onClick={() => composer.textComposer.setText(t.text)}
            className="shrink-0 whitespace-nowrap rounded-full border border-chat-divider bg-chat-surface px-3 py-1.5 font-satoshi text-xs font-semibold text-neutral-600 transition-colors hover:border-primary-300 hover:bg-chat-panel hover:text-primary-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-input-border-active"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-1.5">
        <div className="relative">
          <ComposerIconButton
            label="Add attachment"
            active={attachOpen}
            onClick={() => {
              closeAll();
              setAttachOpen((o) => !o);
            }}
          >
            <LuPlus className="h-5 w-5" />
          </ComposerIconButton>
          {attachOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setAttachOpen(false)}
              />
              <div className="absolute bottom-11 left-0 z-20 w-44 rounded-2xl border border-chat-divider bg-neutral-0 p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft"
                >
                  <LuImage className="h-4 w-4 shrink-0 text-primary-600" />
                  <Text as="span" variant="body-4" className="text-neutral-900">
                    Photo
                  </Text>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft"
                >
                  <LuFileText className="h-4 w-4 shrink-0 text-primary-600" />
                  <Text as="span" variant="body-4" className="text-neutral-900">
                    Document
                  </Text>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (channel?.id) openShare(channel.id);
                    setAttachOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-chat-surface-soft"
                >
                  <LuShare2 className="h-4 w-4 shrink-0 text-primary-600" />
                  <Text as="span" variant="body-4" className="text-neutral-900">
                    Share from PIMS
                  </Text>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex min-h-10 flex-1 items-center rounded-2xl border border-input-border-default bg-(--whitebg) px-4 py-2 transition-colors focus-within:border-input-border-active">
          <TextareaComposer
            placeholder="Write a message…"
            minRows={1}
            maxRows={6}
            className="block w-full resize-none self-center bg-transparent font-satoshi text-body-4 leading-6 text-text-primary outline-none placeholder:text-input-text-placeholder"
            containerClassName="flex-1"
          />
        </div>

        <div className="relative">
          <ComposerIconButton
            label="Emoji"
            active={emojiOpen}
            onClick={() => {
              closeAll();
              setEmojiOpen((o) => !o);
            }}
          >
            <LuSmile className="h-5 w-5" />
          </ComposerIconButton>
          {emojiOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setEmojiOpen(false)}
              />
              <div className="absolute bottom-11 right-0 z-20 flex w-56 flex-wrap gap-1 rounded-2xl border border-chat-divider bg-neutral-0 p-2 shadow-lg">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insert(emoji);
                      setEmojiOpen(false);
                    }}
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-lg hover:bg-chat-surface-soft"
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>

        <button
          type="button"
          aria-label="Send message"
          onClick={send}
          disabled={Boolean(cooldownRemaining)}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-500 text-neutral-0 transition-colors hover:bg-primary-600 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <LuSendHorizonal className="h-5 w-5" />
        </button>
      </div>

      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        multiple
        hidden
        onChange={onFiles}
        aria-hidden="true"
        tabIndex={-1}
      />
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.rtf,.odt,.ods,application/pdf"
        multiple
        hidden
        onChange={onFiles}
        aria-hidden="true"
        tabIndex={-1}
      />
    </div>
  );
}

export default ChatComposer;
