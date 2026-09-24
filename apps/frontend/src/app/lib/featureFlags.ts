export const isCompanionRevampEnabled = (): boolean =>
  process.env.NEXT_PUBLIC_COMPANION_REVAMP === 'true';

/** Chat runs on Stream, so a build without a Stream API key has no chat to offer. */
export const isStreamChatConfigured = (): boolean =>
  Boolean(process.env.NEXT_PUBLIC_STREAM_API_KEY);
