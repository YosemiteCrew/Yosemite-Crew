// src/controllers/app/chatWebhook.controller.ts
import type { Request, Response } from "express";
import { StreamChat } from "stream-chat";
import { scanAttachmentUrl } from "src/services/attachmentScanner.service";
import logger from "src/utils/logger";

const STREAM_KEY = process.env.STREAM_API_KEY!;
const STREAM_SECRET = process.env.STREAM_API_SECRET!;

type StreamAttachment = { asset_url?: string; image_url?: string };
type StreamWebhookEvent = {
  type?: string;
  message?: { id?: string; attachments?: StreamAttachment[] };
};

/**
 * Scan every attachment on a new/updated message and hard-delete the whole
 * message if any attachment is flagged as malware. Exported so it can be unit
 * tested and run after the webhook response is sent (Stream is never blocked on
 * the scan).
 */
export const scanMessageAttachments = async (
  event: StreamWebhookEvent,
): Promise<void> => {
  if (event.type !== "message.new" && event.type !== "message.updated") return;

  const message = event.message;
  const messageId = message?.id;
  const attachments = message?.attachments ?? [];
  if (!messageId || attachments.length === 0) return;

  for (const attachment of attachments) {
    const url = attachment.asset_url || attachment.image_url;
    if (!url) continue;

    const result = await scanAttachmentUrl(url);
    if (!result.clean) {
      logger.warn(
        `Malware in chat attachment on message ${messageId} (${result.threat}); deleting message`,
      );
      try {
        const client = StreamChat.getInstance(STREAM_KEY, STREAM_SECRET);
        await client.deleteMessage(messageId, true);
      } catch (err) {
        logger.error("Failed to delete malicious chat message", err);
      }
      return;
    }
  }
};

export const ChatWebhookController = {
  /**
   * Stream webhook receiver. Verifies the X-Signature against the API secret,
   * acknowledges immediately, then scans attachments out of band.
   */
  handleStreamEvent(req: Request, res: Response) {
    const signature = req.headers["x-signature"];
    if (typeof signature !== "string") {
      return res.status(401).json({ message: "Missing signature" });
    }

    const rawBody = req.body as Buffer | string;
    const bodyString = Buffer.isBuffer(rawBody)
      ? rawBody.toString("utf8")
      : typeof rawBody === "string"
        ? rawBody
        : JSON.stringify(rawBody);

    const client = StreamChat.getInstance(STREAM_KEY, STREAM_SECRET);
    if (!client.verifyWebhook(bodyString, signature)) {
      return res.status(401).json({ message: "Invalid signature" });
    }

    let event: StreamWebhookEvent;
    try {
      event = JSON.parse(bodyString) as StreamWebhookEvent;
    } catch {
      return res.status(400).json({ message: "Invalid payload" });
    }

    // Scan out of band, then acknowledge immediately so Stream isn't blocked.
    void scanMessageAttachments(event);
    return res.status(200).json({ received: true });
  },
};
