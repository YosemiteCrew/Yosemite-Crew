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
import {
  IoArrowUp,
  IoAttachOutline,
  IoDocumentTextOutline,
  IoHappyOutline,
  IoImageOutline,
  IoMicOutline,
  IoShareSocialOutline,
} from 'react-icons/io5';
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
        'inline-flex size-10 shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)] sm:size-9',
        active
          ? 'bg-[var(--screen-2)] text-[var(--blue)]'
          : 'text-[var(--ink-soft)] hover:bg-[var(--screen-2)] hover:text-[var(--ink-body)]'
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
    <div className="border-t border-[var(--hairline)] bg-[var(--screen)] px-3.5 pb-2 pt-2.5 sm:px-4 sm:pb-4 sm:pt-3">
      <AttachmentPreviewList />
      {uploadError && (
        <div role="alert" className="mb-2">
          <Text as="p" variant="caption-1" className="text-[var(--danger-text)]">
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
            className="shrink-0 whitespace-nowrap rounded-full border border-[var(--hairline)] bg-[var(--screen-2)] px-3 py-1.5 font-satoshi text-xs font-semibold text-[var(--ink-soft)] transition-colors hover:border-[var(--blue)] hover:bg-[var(--blue-soft)] hover:text-[var(--blue)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--blue)]"
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="flex items-end gap-2">
        <div className="relative">
          <ComposerIconButton
            label="Add attachment"
            active={attachOpen}
            onClick={() => {
              closeAll();
              setAttachOpen((o) => !o);
            }}
          >
            <IoAttachOutline className="h-[17px] w-[17px] sm:h-4 sm:w-4" />
          </ComposerIconButton>
          {attachOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setAttachOpen(false)}
              />
              <div className="absolute bottom-11 left-0 z-20 w-44 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-1.5 shadow-lg">
                <button
                  type="button"
                  onClick={() => imageInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--screen-2)]"
                >
                  <IoImageOutline className="h-4 w-4 shrink-0 text-[var(--blue)]" />
                  <Text as="span" variant="body-4" className="text-[var(--ink-body)]">
                    Photo
                  </Text>
                </button>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--screen-2)]"
                >
                  <IoDocumentTextOutline className="h-4 w-4 shrink-0 text-[var(--blue)]" />
                  <Text as="span" variant="body-4" className="text-[var(--ink-body)]">
                    Document
                  </Text>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (channel?.id) openShare(channel.id);
                    setAttachOpen(false);
                  }}
                  className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left hover:bg-[var(--screen-2)]"
                >
                  <IoShareSocialOutline className="h-4 w-4 shrink-0 text-[var(--blue)]" />
                  <Text as="span" variant="body-4" className="text-[var(--ink-body)]">
                    Share from PIMS
                  </Text>
                </button>
              </div>
            </>
          )}
        </div>

        <div className="flex min-h-[42px] flex-1 items-center rounded-full border-[1.5px] border-[var(--hairline)] bg-[var(--field-bg)] px-[14px] transition-colors focus-within:border-[var(--blue)]">
          <TextareaComposer
            placeholder="Write a message…"
            minRows={1}
            maxRows={6}
            className="block w-full resize-none self-center bg-transparent font-satoshi text-[13px] leading-6 text-[var(--ink-body)] outline-none placeholder:text-[var(--ink-faint)]"
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
            <IoHappyOutline className="h-5 w-5" />
          </ComposerIconButton>
          {emojiOpen && (
            <>
              <button
                type="button"
                aria-label="Close menu"
                className="fixed inset-0 z-10 cursor-default"
                onClick={() => setEmojiOpen(false)}
              />
              <div className="absolute bottom-11 right-0 z-20 flex w-56 flex-wrap gap-1 rounded-2xl border border-[var(--hairline)] bg-[var(--screen)] p-2 shadow-lg">
                {EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      insert(emoji);
                      setEmojiOpen(false);
                    }}
                    className="flex size-9 items-center justify-center rounded-lg text-lg hover:bg-[var(--screen-2)]"
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
          aria-label="Voice message"
          title="Voice messages are coming soon"
          disabled
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-[var(--ink-faint)] disabled:cursor-not-allowed"
        >
          <IoMicOutline className="h-5 w-5" />
        </button>

        <button
          type="button"
          aria-label="Send message"
          onClick={send}
          disabled={Boolean(cooldownRemaining)}
          className="inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full bg-[var(--blue)] text-white shadow-[0_8px_20px_var(--glow-b26)] transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <IoArrowUp className="h-[17px] w-[17px]" />
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
