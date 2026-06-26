import type { Request, Response } from "express";

jest.mock("src/services/chat.service", () => ({
  ChatService: {
    generateToken: jest.fn(),
    ensureAppointmentChat: jest.fn(),
    createOrgDirectChat: jest.fn(),
    createOrgGroupChat: jest.fn(),
    openChatBySessionId: jest.fn(),
    closeSession: jest.fn(),
    addMembersToGroup: jest.fn(),
    removeMembersFromGroup: jest.fn(),
    updateGroup: jest.fn(),
    deleteGroup: jest.fn(),
  },
  ChatServiceError: class ChatServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
      this.name = "ChatServiceError";
    }
  },
}));

jest.mock("src/services/sharedChatEntity.service", () => ({
  SharedChatEntityService: {},
}));

jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: { getByProviderUserId: jest.fn() },
}));

jest.mock("src/config/read-switch", () => ({ isReadFromPostgres: jest.fn() }));

jest.mock("src/config/prisma", () => ({
  prisma: { chatSession: { findMany: jest.fn() } },
}));

jest.mock("src/models/chatSession", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

import { ChatController } from "src/controllers/app/chat.controller";
import { ChatService, ChatServiceError } from "src/services/chat.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { isReadFromPostgres } from "src/config/read-switch";
import { prisma } from "src/config/prisma";
import ChatSessionModel from "src/models/chatSession";

const svc = ChatService as unknown as Record<string, jest.Mock>;
const getByProviderUserId =
  AuthUserMobileService.getByProviderUserId as jest.Mock;
const readPg = isReadFromPostgres as jest.Mock;
const findMany = prisma.chatSession.findMany as jest.Mock;
const mongoFind = ChatSessionModel.find as unknown as jest.Mock;

const makeRes = () =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as unknown as Response & { status: jest.Mock; json: jest.Mock };

const makeReq = (over: Record<string, unknown> = {}) =>
  ({
    userId: "u1",
    body: {},
    params: {},
    headers: {},
    ...over,
  }) as unknown as Request;

beforeEach(() => jest.clearAllMocks());

describe("ChatController.generateToken", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = makeRes();
    await ChatController.generateToken(makeReq({ userId: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 404 when the user is not linked to a parent", async () => {
    getByProviderUserId.mockResolvedValue({ parentId: undefined });
    const res = makeRes();
    await ChatController.generateToken(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 200 with the token on success", async () => {
    getByProviderUserId.mockResolvedValue({ parentId: "p1" });
    svc.generateToken.mockReturnValue({ token: "tok" });
    const res = makeRes();
    await ChatController.generateToken(makeReq(), res);
    expect(svc.generateToken).toHaveBeenCalledWith("p1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ token: "tok" });
  });

  it("returns 500 on an unexpected error", async () => {
    getByProviderUserId.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.generateToken(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.generateTokenForPMS", () => {
  it("returns 401 when unauthenticated", () => {
    const res = makeRes();
    ChatController.generateTokenForPMS(makeReq({ userId: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 200 with the token", () => {
    svc.generateToken.mockReturnValue({ token: "pms" });
    const res = makeRes();
    ChatController.generateTokenForPMS(makeReq(), res);
    expect(svc.generateToken).toHaveBeenCalledWith("u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 500 on error", () => {
    svc.generateToken.mockImplementation(() => {
      throw new Error("boom");
    });
    const res = makeRes();
    ChatController.generateTokenForPMS(makeReq(), res);
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.ensureAppointmentSession", () => {
  it("returns 400 when appointmentId is missing", async () => {
    const res = makeRes();
    await ChatController.ensureAppointmentSession(makeReq({ params: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with the session", async () => {
    svc.ensureAppointmentChat.mockResolvedValue({ id: "s1" });
    const res = makeRes();
    await ChatController.ensureAppointmentSession(
      makeReq({ params: { appointmentId: "a1" } }),
      res,
    );
    expect(svc.ensureAppointmentChat).toHaveBeenCalledWith("a1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps a ChatServiceError", async () => {
    svc.ensureAppointmentChat.mockRejectedValue(
      new ChatServiceError("Nope", 403),
    );
    const res = makeRes();
    await ChatController.ensureAppointmentSession(
      makeReq({ params: { appointmentId: "a1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 on an unexpected error", async () => {
    svc.ensureAppointmentChat.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.ensureAppointmentSession(
      makeReq({ params: { appointmentId: "a1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.createOrgDirectChat", () => {
  it("returns 400 on an invalid payload", async () => {
    const res = makeRes();
    await ChatController.createOrgDirectChat(
      makeReq({ body: { organisationId: "o1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("treats a non-object body as empty", async () => {
    const res = makeRes();
    await ChatController.createOrgDirectChat(makeReq({ body: null }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 201 with the session", async () => {
    svc.createOrgDirectChat.mockResolvedValue({ id: "d1" });
    const res = makeRes();
    await ChatController.createOrgDirectChat(
      makeReq({ body: { organisationId: "o1", otherUserId: "u2" } }),
      res,
    );
    expect(svc.createOrgDirectChat).toHaveBeenCalledWith("o1", "u1", "u2");
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("maps a ChatServiceError", async () => {
    svc.createOrgDirectChat.mockRejectedValue(new ChatServiceError("No", 409));
    const res = makeRes();
    await ChatController.createOrgDirectChat(
      makeReq({ body: { organisationId: "o1", otherUserId: "u2" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(409);
  });

  it("returns 500 on an unexpected error", async () => {
    svc.createOrgDirectChat.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.createOrgDirectChat(
      makeReq({ body: { organisationId: "o1", otherUserId: "u2" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.createOrgGroupChat", () => {
  it("returns 400 on an invalid payload", async () => {
    const res = makeRes();
    await ChatController.createOrgGroupChat(
      makeReq({ body: { organisationId: "o1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("ignores non-string organisation and title fields", async () => {
    const res = makeRes();
    await ChatController.createOrgGroupChat(
      makeReq({ body: { organisationId: 123, title: 456, memberIds: [] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 201 with the session", async () => {
    svc.createOrgGroupChat.mockResolvedValue({ id: "g1" });
    const res = makeRes();
    await ChatController.createOrgGroupChat(
      makeReq({
        body: {
          organisationId: "o1",
          title: "Team",
          memberIds: ["u2"],
          isPrivate: true,
        },
      }),
      res,
    );
    expect(svc.createOrgGroupChat).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "o1",
        createdBy: "u1",
        title: "Team",
        memberIds: ["u2"],
      }),
    );
    expect(res.status).toHaveBeenCalledWith(201);
  });

  it("maps a ChatServiceError", async () => {
    svc.createOrgGroupChat.mockRejectedValue(new ChatServiceError("No", 403));
    const res = makeRes();
    await ChatController.createOrgGroupChat(
      makeReq({ body: { organisationId: "o1", title: "Team", memberIds: [] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 on an unexpected error", async () => {
    svc.createOrgGroupChat.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.createOrgGroupChat(
      makeReq({ body: { organisationId: "o1", title: "Team", memberIds: [] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.openChat", () => {
  it("returns 400 when sessionId is missing", async () => {
    const res = makeRes();
    await ChatController.openChat(makeReq({ params: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with the chat data", async () => {
    svc.openChatBySessionId.mockResolvedValue({ id: "c1" });
    const res = makeRes();
    await ChatController.openChat(
      makeReq({ params: { sessionId: "s1" } }),
      res,
    );
    expect(svc.openChatBySessionId).toHaveBeenCalledWith("s1", "u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps a ChatServiceError", async () => {
    svc.openChatBySessionId.mockRejectedValue(
      new ChatServiceError("Gone", 404),
    );
    const res = makeRes();
    await ChatController.openChat(
      makeReq({ params: { sessionId: "s1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(404);
  });

  it("returns 500 on an unexpected error", async () => {
    svc.openChatBySessionId.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.openChat(
      makeReq({ params: { sessionId: "s1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.listMySessions", () => {
  it("returns 401 when unauthenticated", async () => {
    const res = makeRes();
    await ChatController.listMySessions(makeReq({ userId: undefined }), res);
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it("returns 400 when organisationId is missing", async () => {
    const res = makeRes();
    await ChatController.listMySessions(makeReq({ params: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("reads from postgres when the read switch is on", async () => {
    readPg.mockReturnValue(true);
    findMany.mockResolvedValue([{ id: "s1" }]);
    const res = makeRes();
    await ChatController.listMySessions(
      makeReq({ params: { organisationId: "o1" } }),
      res,
    );
    expect(findMany).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "s1" }]);
  });

  it("reads from mongo when the read switch is off", async () => {
    readPg.mockReturnValue(false);
    mongoFind.mockReturnValue({
      sort: () => ({ lean: () => Promise.resolve([{ id: "s2" }]) }),
    });
    const res = makeRes();
    await ChatController.listMySessions(
      makeReq({ params: { organisationId: "o1" } }),
      res,
    );
    expect(mongoFind).toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith([{ id: "s2" }]);
  });

  it("returns 500 on an unexpected error", async () => {
    readPg.mockReturnValue(true);
    findMany.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.listMySessions(
      makeReq({ params: { organisationId: "o1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.closeSession", () => {
  it("returns 400 when sessionId is missing", async () => {
    const res = makeRes();
    await ChatController.closeSession(makeReq({ params: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 on success", async () => {
    svc.closeSession.mockResolvedValue(undefined);
    const res = makeRes();
    await ChatController.closeSession(
      makeReq({ params: { sessionId: "s1" } }),
      res,
    );
    expect(svc.closeSession).toHaveBeenCalledWith("s1", "u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("returns 400 when the actor is not authenticated", async () => {
    const res = makeRes();
    await ChatController.closeSession(
      makeReq({ params: { sessionId: "s1" }, userId: undefined }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
    expect(svc.closeSession).not.toHaveBeenCalled();
  });

  it("maps a ChatServiceError", async () => {
    svc.closeSession.mockRejectedValue(new ChatServiceError("Nope", 403));
    const res = makeRes();
    await ChatController.closeSession(
      makeReq({ params: { sessionId: "s1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 on an unexpected error", async () => {
    svc.closeSession.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.closeSession(
      makeReq({ params: { sessionId: "s1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.addGroupMembers", () => {
  it("returns 400 on an invalid payload", async () => {
    const res = makeRes();
    await ChatController.addGroupMembers(
      makeReq({ params: { sessionId: "s1" }, body: {} }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with the session", async () => {
    svc.addMembersToGroup.mockResolvedValue({ id: "s1" });
    const res = makeRes();
    await ChatController.addGroupMembers(
      makeReq({ params: { sessionId: "s1" }, body: { memberIds: ["u2"] } }),
      res,
    );
    expect(svc.addMembersToGroup).toHaveBeenCalledWith("s1", "u1", ["u2"]);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps a ChatServiceError", async () => {
    svc.addMembersToGroup.mockRejectedValue(new ChatServiceError("No", 403));
    const res = makeRes();
    await ChatController.addGroupMembers(
      makeReq({ params: { sessionId: "s1" }, body: { memberIds: ["u2"] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 on an unexpected error", async () => {
    svc.addMembersToGroup.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.addGroupMembers(
      makeReq({ params: { sessionId: "s1" }, body: { memberIds: ["u2"] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.removeGroupMembers", () => {
  it("returns 400 on an invalid payload", async () => {
    const res = makeRes();
    await ChatController.removeGroupMembers(
      makeReq({ params: { sessionId: "s1" }, body: {} }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with the session", async () => {
    svc.removeMembersFromGroup.mockResolvedValue({ id: "s1" });
    const res = makeRes();
    await ChatController.removeGroupMembers(
      makeReq({ params: { sessionId: "s1" }, body: { memberIds: ["u2"] } }),
      res,
    );
    expect(svc.removeMembersFromGroup).toHaveBeenCalledWith("s1", "u1", ["u2"]);
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps a ChatServiceError", async () => {
    svc.removeMembersFromGroup.mockRejectedValue(
      new ChatServiceError("No", 403),
    );
    const res = makeRes();
    await ChatController.removeGroupMembers(
      makeReq({ params: { sessionId: "s1" }, body: { memberIds: ["u2"] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 on an unexpected error", async () => {
    svc.removeMembersFromGroup.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.removeGroupMembers(
      makeReq({ params: { sessionId: "s1" }, body: { memberIds: ["u2"] } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.updateGroup", () => {
  it("returns 400 when sessionId is missing", async () => {
    const res = makeRes();
    await ChatController.updateGroup(makeReq({ params: {} }), res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  it("returns 200 with the updated session", async () => {
    svc.updateGroup.mockResolvedValue({ id: "s1", title: "New" });
    const res = makeRes();
    await ChatController.updateGroup(
      makeReq({
        params: { sessionId: "s1" },
        body: { title: "New", isPrivate: false },
      }),
      res,
    );
    expect(svc.updateGroup).toHaveBeenCalledWith("s1", "u1", {
      title: "New",
      isPrivate: false,
    });
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps a ChatServiceError", async () => {
    svc.updateGroup.mockRejectedValue(new ChatServiceError("No", 403));
    const res = makeRes();
    await ChatController.updateGroup(
      makeReq({ params: { sessionId: "s1" }, body: {} }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 on an unexpected error", async () => {
    svc.updateGroup.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.updateGroup(
      makeReq({ params: { sessionId: "s1" }, body: {} }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});

describe("ChatController.deleteGroup", () => {
  it("returns 200 on success", async () => {
    svc.deleteGroup.mockResolvedValue(undefined);
    const res = makeRes();
    await ChatController.deleteGroup(
      makeReq({ params: { sessionId: "s1" } }),
      res,
    );
    expect(svc.deleteGroup).toHaveBeenCalledWith("s1", "u1");
    expect(res.status).toHaveBeenCalledWith(200);
  });

  it("maps a ChatServiceError", async () => {
    svc.deleteGroup.mockRejectedValue(new ChatServiceError("No", 403));
    const res = makeRes();
    await ChatController.deleteGroup(
      makeReq({ params: { sessionId: "s1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("returns 500 on an unexpected error", async () => {
    svc.deleteGroup.mockRejectedValue(new Error("boom"));
    const res = makeRes();
    await ChatController.deleteGroup(
      makeReq({ params: { sessionId: "s1" } }),
      res,
    );
    expect(res.status).toHaveBeenCalledWith(500);
  });
});
