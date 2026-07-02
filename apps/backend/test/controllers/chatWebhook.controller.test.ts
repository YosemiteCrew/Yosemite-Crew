const mockVerifyWebhook = jest.fn();
const mockDeleteMessage = jest.fn();

jest.mock("stream-chat", () => ({
  StreamChat: {
    getInstance: jest.fn(() => ({
      verifyWebhook: mockVerifyWebhook,
      deleteMessage: mockDeleteMessage,
    })),
  },
}));

jest.mock("src/services/attachmentScanner.service", () => ({
  scanAttachmentUrl: jest.fn(),
}));

import {
  ChatWebhookController,
  scanMessageAttachments,
} from "src/controllers/app/chatWebhook.controller";
import { scanAttachmentUrl } from "src/services/attachmentScanner.service";
import type { Request, Response } from "express";

const mockScan = scanAttachmentUrl as unknown as jest.Mock;

const makeRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as unknown as Response & { status: jest.Mock; json: jest.Mock };

const makeReq = (over: Record<string, unknown> = {}) =>
  ({ headers: {}, body: Buffer.from("{}"), ...over }) as unknown as Request;

beforeEach(() => {
  jest.clearAllMocks();
  mockVerifyWebhook.mockReturnValue(true);
  mockDeleteMessage.mockResolvedValue({});
  mockScan.mockResolvedValue({ clean: true });
});

describe("ChatWebhookController.handleStreamEvent", () => {
  it("rejects a request with no signature", async () => {
    const res = makeRes();
    await ChatWebhookController.handleStreamEvent(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockVerifyWebhook).not.toHaveBeenCalled();
  });

  it("rejects an invalid signature", async () => {
    mockVerifyWebhook.mockReturnValue(false);
    const res = makeRes();
    await ChatWebhookController.handleStreamEvent(
      makeReq({ headers: { "x-signature": "bad" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("rejects an invalid JSON body", async () => {
    const res = makeRes();
    await ChatWebhookController.handleStreamEvent(
      makeReq({ headers: { "x-signature": "ok" }, body: Buffer.from("nope") }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("acknowledges a verified event with 200", async () => {
    const res = makeRes();
    const body = Buffer.from(
      JSON.stringify({
        type: "message.new",
        message: { id: "m1", attachments: [] },
      }),
    );
    await ChatWebhookController.handleStreamEvent(
      makeReq({ headers: { "x-signature": "ok" }, body }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(200);
  });
});

describe("scanMessageAttachments", () => {
  it("ignores non-message events", async () => {
    await scanMessageAttachments({ type: "user.updated" });
    expect(mockScan).not.toHaveBeenCalled();
  });

  it("ignores messages without attachments", async () => {
    await scanMessageAttachments({
      type: "message.new",
      message: { id: "m1", attachments: [] },
    });
    expect(mockScan).not.toHaveBeenCalled();
  });

  it("skips attachments with no url", async () => {
    await scanMessageAttachments({
      type: "message.new",
      message: { id: "m1", attachments: [{}] },
    });
    expect(mockScan).not.toHaveBeenCalled();
  });

  it("leaves a clean attachment in place", async () => {
    await scanMessageAttachments({
      type: "message.new",
      message: { id: "m1", attachments: [{ asset_url: "u" }] },
    });
    expect(mockScan).toHaveBeenCalledWith("u");
    expect(mockDeleteMessage).not.toHaveBeenCalled();
  });

  it("hard-deletes a message with a malicious attachment", async () => {
    mockScan.mockResolvedValue({ clean: false, threat: "bad" });
    await scanMessageAttachments({
      type: "message.updated",
      message: { id: "m1", attachments: [{ image_url: "u" }] },
    });
    expect(mockDeleteMessage).toHaveBeenCalledWith("m1", true);
  });

  it("swallows a delete failure", async () => {
    mockScan.mockResolvedValue({ clean: false, threat: "bad" });
    mockDeleteMessage.mockRejectedValue(new Error("boom"));
    await expect(
      scanMessageAttachments({
        type: "message.new",
        message: { id: "m1", attachments: [{ asset_url: "u" }] },
      }),
    ).resolves.toBeUndefined();
  });
});
