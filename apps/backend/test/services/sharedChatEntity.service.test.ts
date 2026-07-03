const mockSendMessage = jest.fn();
const mockDeleteMessage = jest.fn();
const mockChannel = jest.fn(() => ({ sendMessage: mockSendMessage }));

jest.mock("stream-chat", () => ({
  StreamChat: {
    getInstance: () => ({
      channel: mockChannel,
      deleteMessage: mockDeleteMessage,
    }),
  },
}));

jest.mock("src/config/prisma", () => ({
  prisma: {
    chatSession: { findFirst: jest.fn() },
    appointment: { findFirst: jest.fn() },
    invoice: { findFirst: jest.fn() },
    patientOrganisation: { findFirst: jest.fn() },
    sharedChatEntity: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/chat.service", () => ({
  ChatServiceError: class ChatServiceError extends Error {
    statusCode: number;
    constructor(message: string, statusCode = 400) {
      super(message);
      this.statusCode = statusCode;
      this.name = "ChatServiceError";
    }
  },
}));

import {
  SharedChatEntityService,
  SharedChatEntityType,
} from "src/services/sharedChatEntity.service";
import { ChatServiceError } from "src/services/chat.service";
import { prisma } from "src/config/prisma";

const mockedPrisma = prisma as unknown as {
  chatSession: { findFirst: jest.Mock };
  appointment: { findFirst: jest.Mock };
  invoice: { findFirst: jest.Mock };
  patientOrganisation: { findFirst: jest.Mock };
  sharedChatEntity: {
    create: jest.Mock;
    findMany: jest.Mock;
    findUnique: jest.Mock;
    update: jest.Mock;
  };
};

const openSession = {
  id: "s1",
  channelId: "ch1",
  organisationId: "org1",
  type: "APPOINTMENT",
  status: "ACTIVE",
  members: ["u1", "u2"],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockSendMessage.mockResolvedValue({ message: { id: "msg1" } });
});

describe("SharedChatEntityService.shareEntity", () => {
  it("posts a Stream card and records the share for a member", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: "a1" });
    mockedPrisma.sharedChatEntity.create.mockResolvedValue({ id: "share1" });

    const res = await SharedChatEntityService.shareEntity({
      channelId: "ch1",
      userId: "u1",
      entityType: SharedChatEntityType.APPOINTMENT,
      entityId: "a1",
      title: "Checkup",
    });

    expect(mockChannel).toHaveBeenCalledWith("messaging", "ch1");
    expect(mockSendMessage).toHaveBeenCalledTimes(1);
    expect(mockedPrisma.sharedChatEntity.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organisationId: "org1",
          channelId: "ch1",
          sharedById: "u1",
          messageId: "msg1",
          entityType: "APPOINTMENT",
          entityId: "a1",
          title: "Checkup",
        }),
      }),
    );
    expect(res).toEqual({ id: "share1" });
  });

  it("uses the team channel type for group chats", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      ...openSession,
      type: "ORG_GROUP",
    });
    mockedPrisma.invoice.findFirst.mockResolvedValue({ id: "i1" });
    mockedPrisma.sharedChatEntity.create.mockResolvedValue({ id: "share2" });

    await SharedChatEntityService.shareEntity({
      channelId: "ch1",
      userId: "u1",
      entityType: SharedChatEntityType.INVOICE,
      entityId: "i1",
    });

    expect(mockChannel).toHaveBeenCalledWith("team", "ch1");
  });

  it("rejects with 404 when the chat does not exist", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(null);

    await expect(
      SharedChatEntityService.shareEntity({
        channelId: "missing",
        userId: "u1",
        entityType: SharedChatEntityType.FORM,
        entityId: "f1",
      }),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the chat is closed", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      ...openSession,
      status: "CLOSED",
    });

    await expect(
      SharedChatEntityService.shareEntity({
        channelId: "ch1",
        userId: "u1",
        entityType: SharedChatEntityType.FORM,
        entityId: "f1",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects with a ChatServiceError when the user is not a member", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      ...openSession,
      members: ["u2"],
    });

    await expect(
      SharedChatEntityService.shareEntity({
        channelId: "ch1",
        userId: "u1",
        entityType: SharedChatEntityType.FORM,
        entityId: "f1",
      }),
    ).rejects.toBeInstanceOf(ChatServiceError);
  });

  it("surfaces a 502 and does not record when Stream posting fails", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);
    mockedPrisma.appointment.findFirst.mockResolvedValue({ id: "a1" });
    mockSendMessage.mockRejectedValue(new Error("stream down"));

    await expect(
      SharedChatEntityService.shareEntity({
        channelId: "ch1",
        userId: "u1",
        entityType: SharedChatEntityType.APPOINTMENT,
        entityId: "a1",
      }),
    ).rejects.toMatchObject({ statusCode: 502 });
    expect(mockedPrisma.sharedChatEntity.create).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the appointment belongs to another org", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);
    mockedPrisma.appointment.findFirst.mockResolvedValue(null);

    await expect(
      SharedChatEntityService.shareEntity({
        channelId: "ch1",
        userId: "u1",
        entityType: SharedChatEntityType.APPOINTMENT,
        entityId: "foreign-appt",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockSendMessage).not.toHaveBeenCalled();
    expect(mockedPrisma.appointment.findFirst).toHaveBeenCalledWith({
      where: { id: "foreign-appt", organisationId: "org1" },
      select: { id: true },
    });
  });

  it("shares a companion that is linked to the organisation", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);
    mockedPrisma.patientOrganisation.findFirst.mockResolvedValue({
      id: "link1",
    });
    mockedPrisma.sharedChatEntity.create.mockResolvedValue({ id: "share3" });

    await SharedChatEntityService.shareEntity({
      channelId: "ch1",
      userId: "u1",
      entityType: SharedChatEntityType.COMPANION,
      entityId: "pet1",
    });

    expect(mockedPrisma.patientOrganisation.findFirst).toHaveBeenCalledWith({
      where: {
        organisationId: "org1",
        patientId: "pet1",
        status: { in: ["ACTIVE", "PENDING"] },
      },
      select: { id: true },
    });
    expect(mockedPrisma.sharedChatEntity.create).toHaveBeenCalled();
  });

  it("rejects with 403 when the companion is not linked to the organisation", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);
    mockedPrisma.patientOrganisation.findFirst.mockResolvedValue(null);

    await expect(
      SharedChatEntityService.shareEntity({
        channelId: "ch1",
        userId: "u1",
        entityType: SharedChatEntityType.COMPANION,
        entityId: "foreign-pet",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("rejects with 403 when the invoice belongs to another org", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);
    mockedPrisma.invoice.findFirst.mockResolvedValue(null);

    await expect(
      SharedChatEntityService.shareEntity({
        channelId: "ch1",
        userId: "u1",
        entityType: SharedChatEntityType.INVOICE,
        entityId: "foreign-invoice",
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("rejects with 400 for entity types not supported for sharing", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);

    await expect(
      SharedChatEntityService.shareEntity({
        channelId: "ch1",
        userId: "u1",
        entityType: SharedChatEntityType.DOCUMENT,
        entityId: "d1",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(mockSendMessage).not.toHaveBeenCalled();
  });

  it("rejects with 400 when the entity id is blank", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);

    await expect(
      SharedChatEntityService.shareEntity({
        channelId: "ch1",
        userId: "u1",
        entityType: SharedChatEntityType.APPOINTMENT,
        entityId: "   ",
      }),
    ).rejects.toMatchObject({ statusCode: 400 });
  });
});

describe("SharedChatEntityService.listForChannel", () => {
  it("returns active shares for a member", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);
    mockedPrisma.sharedChatEntity.findMany.mockResolvedValue([
      { id: "share1" },
    ]);

    const res = await SharedChatEntityService.listForChannel("ch1", "u1");

    expect(mockedPrisma.sharedChatEntity.findMany).toHaveBeenCalledWith({
      where: { channelId: "ch1", revokedAt: null },
      orderBy: { createdAt: "desc" },
    });
    expect(res).toEqual([{ id: "share1" }]);
  });

  it("rejects a non-member", async () => {
    mockedPrisma.chatSession.findFirst.mockResolvedValue({
      ...openSession,
      members: ["u2"],
    });

    await expect(
      SharedChatEntityService.listForChannel("ch1", "u1"),
    ).rejects.toMatchObject({ statusCode: 403 });
  });
});

describe("SharedChatEntityService.revoke", () => {
  it("soft-revokes and deletes the Stream message", async () => {
    mockedPrisma.sharedChatEntity.findUnique.mockResolvedValue({
      id: "share1",
      channelId: "ch1",
      messageId: "msg1",
      revokedAt: null,
    });
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);
    mockedPrisma.sharedChatEntity.update.mockResolvedValue({
      id: "share1",
      revokedById: "u1",
    });

    const res = await SharedChatEntityService.revoke("share1", "u1");

    expect(mockedPrisma.sharedChatEntity.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "share1" },
        data: expect.objectContaining({ revokedById: "u1" }),
      }),
    );
    expect(mockDeleteMessage).toHaveBeenCalledWith("msg1", true);
    expect(res).toMatchObject({ id: "share1" });
  });

  it("still resolves when deleting the Stream message fails", async () => {
    mockedPrisma.sharedChatEntity.findUnique.mockResolvedValue({
      id: "share1",
      channelId: "ch1",
      messageId: "msg1",
      revokedAt: null,
    });
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);
    mockedPrisma.sharedChatEntity.update.mockResolvedValue({
      id: "share1",
      revokedById: "u1",
    });
    mockDeleteMessage.mockRejectedValueOnce(new Error("stream down"));

    const res = await SharedChatEntityService.revoke("share1", "u1");

    expect(mockDeleteMessage).toHaveBeenCalledWith("msg1", true);
    expect(res).toMatchObject({ id: "share1" });
  });

  it("is idempotent when already revoked", async () => {
    const already = {
      id: "share1",
      channelId: "ch1",
      messageId: "msg1",
      revokedAt: new Date(),
    };
    mockedPrisma.sharedChatEntity.findUnique.mockResolvedValue(already);
    mockedPrisma.chatSession.findFirst.mockResolvedValue(openSession);

    const res = await SharedChatEntityService.revoke("share1", "u1");

    expect(mockedPrisma.sharedChatEntity.update).not.toHaveBeenCalled();
    expect(mockDeleteMessage).not.toHaveBeenCalled();
    expect(res).toBe(already);
  });

  it("rejects with 404 when the share is not found", async () => {
    mockedPrisma.sharedChatEntity.findUnique.mockResolvedValue(null);

    await expect(
      SharedChatEntityService.revoke("nope", "u1"),
    ).rejects.toMatchObject({ statusCode: 404 });
  });
});
