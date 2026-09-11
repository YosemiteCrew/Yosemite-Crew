import { StreamChat } from "stream-chat";

export const getStreamServer = (): StreamChat => {
  const key = process.env.STREAM_API_KEY;
  const secret = process.env.STREAM_API_SECRET;
  if (!key || !secret) {
    throw new Error("Stream Chat credentials missing in env");
  }
  return StreamChat.getInstance(key, secret);
};
