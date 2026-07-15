import type { Request, Response } from "express";

const mockShareEntity = jest.fn();
const mockListForChannel = jest.fn();
const mockRevoke = jest.fn();

jest.mock("src/services/sharedChatEntity.service", () => ({
  SharedChatEntityService: {
    shareEntity: mockShareEntity,
    listForChannel: mockListForChannel,
    revoke: mockRevoke,
  },
}));

jest.mock("src/services/chat.service", () => ({
  ChatService: {},
  ChatServiceError: class ChatServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
      this.name = "ChatServiceError";
    }
  },
}));

import { ChatController } from "src/controllers/app/chat.controller";
import { ChatServiceError } from "src/services/chat.service";

const makeRes = () => ({
  status: jest.fn().mockReturnThis(),
  json: jest.fn().mockReturnThis(),
});

const makeReq = (over: Record<string, unknown> = {}) =>
  ({
    userId: "u1",
    body: {},
    params: {},
    headers: {},
    ...over,
  }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe("ChatController.shareEntityToChannel", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = makeRes();
    await ChatController.shareEntityToChannel(
      makeReq({ userId: undefined }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(401);
    expect(mockShareEntity).not.toHaveBeenCalled();
  });

  it("returns 400 on an invalid payload", async () => {
    const res = makeRes();
    await ChatController.shareEntityToChannel(
      makeReq({ body: { channelId: "" } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(mockShareEntity).not.toHaveBeenCalled();
  });

  it("returns 201 and the record on success", async () => {
    mockShareEntity.mockResolvedValue({ id: "share1" });
    const res = makeRes();
    await ChatController.shareEntityToChannel(
      makeReq({
        body: {
          channelId: "ch1",
          entityType: "APPOINTMENT",
          entityId: "a1",
          title: "Checkup",
        },
      }),
      res as unknown as Response,
    );
    expect(mockShareEntity).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: "u1",
        channelId: "ch1",
        entityType: "APPOINTMENT",
        entityId: "a1",
        title: "Checkup",
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
    expect(res.json).toHaveBeenCalledWith({ id: "share1" });
  });

  it("maps a ChatServiceError to its status code", async () => {
    mockShareEntity.mockRejectedValue(
      new ChatServiceError("Not a member", 403),
    );
    const res = makeRes();
    await ChatController.shareEntityToChannel(
      makeReq({
        body: { channelId: "ch1", entityType: "FORM", entityId: "f1" },
      }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ message: "Not a member" });
  });

  it("returns 500 on an unexpected error", async () => {
    mockShareEntity.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.shareEntityToChannel(
      makeReq({
        body: { channelId: "ch1", entityType: "FORM", entityId: "f1" },
      }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.listSharedEntities", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = makeRes();
    await ChatController.listSharedEntities(
      makeReq({ userId: undefined }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when channelId is missing", async () => {
    const res = makeRes();
    await ChatController.listSharedEntities(
      makeReq({ params: {} }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with the items", async () => {
    mockListForChannel.mockResolvedValue([{ id: "s1" }]);
    const res = makeRes();
    await ChatController.listSharedEntities(
      makeReq({ params: { channelId: "ch1" } }),
      res as unknown as Response,
    );
    expect(mockListForChannel).toHaveBeenCalledWith("ch1", "u1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "s1" }]);
  });

  it("maps a ChatServiceError", async () => {
    mockListForChannel.mockRejectedValue(new ChatServiceError("Closed", 403));
    const res = makeRes();
    await ChatController.listSharedEntities(
      makeReq({ params: { channelId: "ch1" } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 on an unexpected error", async () => {
    mockListForChannel.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.listSharedEntities(
      makeReq({ params: { channelId: "ch1" } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.revokeSharedEntity", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = makeRes();
    await ChatController.revokeSharedEntity(
      makeReq({ userId: undefined }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when id is missing", async () => {
    const res = makeRes();
    await ChatController.revokeSharedEntity(
      makeReq({ params: {} }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on success", async () => {
    mockRevoke.mockResolvedValue({ id: "s1", revokedById: "u1" });
    const res = makeRes();
    await ChatController.revokeSharedEntity(
      makeReq({ params: { id: "s1" } }),
      res as unknown as Response,
    );
    expect(mockRevoke).toHaveBeenCalledWith("s1", "u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps a ChatServiceError", async () => {
    mockRevoke.mockRejectedValue(new ChatServiceError("Not found", 404));
    const res = makeRes();
    await ChatController.revokeSharedEntity(
      makeReq({ params: { id: "x" } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 on an unexpected error", async () => {
    mockRevoke.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.revokeSharedEntity(
      makeReq({ params: { id: "x" } }),
      res as unknown as Response,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
