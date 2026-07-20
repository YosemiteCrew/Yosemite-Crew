import type { Channel as StreamChannel } from 'stream-chat';

export type ConversationInfoMember = { id: string; name: string; role?: string };
export type ConversationInfoMedia = { id: string; kind: 'image' | 'video' };
export type ConversationInfoFile = { id: string; name: string; meta?: string };
export type ConversationInfoPinned = { id: string; text: string };

const KB = 1024;
const MB = KB * KB;

/** "180 KB" / "1.4 MB" — omitted entirely when the size is missing or bogus. */
const formatFileSize = (bytes: unknown): string | undefined => {
  if (typeof bytes !== 'number' || !Number.isFinite(bytes) || bytes <= 0) return undefined;
  if (bytes < KB) return `${bytes} B`;
  if (bytes < MB) return `${Math.round(bytes / KB)} KB`;
  return `${(bytes / MB).toFixed(1)} MB`;
};

/** Splits the channel's message attachments into the media grid and file list. */
export const deriveConversationAttachments = (
  channel: StreamChannel | null | undefined
): { media: ConversationInfoMedia[]; files: ConversationInfoFile[] } => {
  const media: ConversationInfoMedia[] = [];
  const files: ConversationInfoFile[] = [];
  const messages = (channel?.state?.messages ?? []) as unknown as ReadonlyArray<
    Record<string, any>
  >;
  messages.forEach((message, messageIndex) => {
    const attachments = (message?.attachments ?? []) as ReadonlyArray<Record<string, any>>;
    attachments.forEach((attachment, attachmentIndex) => {
      const id = `${message?.id ?? messageIndex}-${attachmentIndex}`;
      const type = attachment?.type;
      if (type === 'image' || type === 'video') {
        media.push({ id, kind: type });
        return;
      }
      files.push({
        id,
        name: attachment?.title || attachment?.fallback || 'Attachment',
        meta: formatFileSize(attachment?.file_size),
      });
    });
  });
  return { media, files };
};

/** Channel members as { id, name, role } — the creator is labelled "Owner". */
export const deriveConversationMembers = (
  channel: StreamChannel | null | undefined
): ConversationInfoMember[] => {
  const members = (channel?.state?.members ?? {}) as unknown as Record<string, Record<string, any>>;
  return Object.entries(members).map(([key, member]) => ({
    id: member?.user_id ?? member?.user?.id ?? key,
    name: member?.user?.name ?? member?.user?.id ?? key,
    role: member?.role === 'owner' ? 'Owner' : undefined,
  }));
};

/** Pinned messages that actually carry text (attachment-only pins are dropped). */
export const deriveConversationPinned = (
  channel: StreamChannel | null | undefined
): ConversationInfoPinned[] => {
  const pinned = (channel?.state?.pinnedMessages ?? []) as unknown as ReadonlyArray<
    Record<string, any>
  >;
  const result: ConversationInfoPinned[] = [];
  pinned.forEach((message, index) => {
    const text = typeof message?.text === 'string' ? message.text.trim() : '';
    if (!text) return;
    result.push({ id: message?.id ?? `pinned-${index}`, text });
  });
  return result;
};
