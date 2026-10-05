import { beforeEach, describe, expect, it, jest } from "@jest/globals";
import { Prisma } from "@prisma/client";
import {
  AuthoringSessionError,
  createAuthoringSessionService,
  type AuthoringRenditionAdapter,
  type EditorSessionAdapter,
} from "../../src/services/authoring-session.service";

const baseVersion = {
  id: "version-1",
  documentId: "document-1",
  majorVersion: 1,
  minorVersion: 0,
  status: "DRAFT",
  content: { blocks: [{ text: "Original" }] },
  renditionUrl: "https://files.example/version-1.pdf",
  renditionContentType: "application/pdf",
  contributorIds: ["author-1"],
  createdBy: "author-1",
  supersedesVersionId: null,
  createdAt: new Date("2026-10-05T12:00:00Z"),
};

const openSession = {
  id: "session-1",
  organisationId: "org-1",
  documentId: "document-1",
  baseVersionId: "version-1",
  status: "OPEN",
  editorProvider: "test-editor",
  providerSessionId: "provider-session-1",
  workingState: { blocks: [{ text: "Original" }] },
  revision: 0,
  invitedMemberIds: ["author-1", "author-2"],
  contributorIds: ["author-1"],
  openedBy: "author-1",
  closedBy: null,
  producedVersionId: null,
  openedAt: new Date("2026-10-05T12:00:00Z"),
  closedAt: null,
  updatedAt: new Date("2026-10-05T12:00:00Z"),
};

const createDatabase = () => {
  const database: any = {
    controlledDocument: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    controlledDocumentVersion: {
      create: jest.fn(),
      update: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    authoringSession: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUniqueOrThrow: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
    },
    authoringSessionMember: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    documentAuthoringLock: {
      create: jest.fn(),
      delete: jest.fn(),
    },
  };
  database.$transaction = jest.fn(async (callback: (tx: any) => unknown) =>
    callback(database),
  );
  return database;
};

const editor: jest.Mocked<EditorSessionAdapter> = {
  provider: "test-editor",
  createWorkingState: jest.fn(),
  applyUpdate: jest.fn(),
  snapshot: jest.fn(),
};

const rendition: jest.Mocked<AuthoringRenditionAdapter> = {
  render: jest.fn(),
};

describe("authoring session service", () => {
  let database: ReturnType<typeof createDatabase>;
  let service: ReturnType<typeof createAuthoringSessionService>;

  beforeEach(() => {
    jest.clearAllMocks();
    database = createDatabase();
    service = createAuthoringSessionService({ database, editor, rendition });
    editor.createWorkingState.mockResolvedValue({
      providerSessionId: "provider-session-1",
      workingState: baseVersion.content,
    });
    editor.applyUpdate.mockImplementation(
      async ({ workingState, update }) =>
        ({
          ...(workingState as Record<string, unknown>),
          ...(update as Record<string, unknown>),
        }) as Prisma.InputJsonValue,
    );
    editor.snapshot.mockImplementation(
      async ({ workingState }) => workingState as Prisma.InputJsonValue,
    );
    rendition.render.mockResolvedValue({
      url: "https://files.example/version-1.1.pdf",
      contentType: "application/pdf",
    });
  });

  it("opens one provider-neutral session and takes the shared authoring lock", async () => {
    database.controlledDocument.findFirst.mockResolvedValue({
      id: "document-1",
      organisationId: "org-1",
      latestVersion: baseVersion,
    });
    database.authoringSession.create.mockResolvedValue(openSession);
    database.documentAuthoringLock.create.mockResolvedValue({});

    await expect(
      service.open({
        organisationId: "org-1",
        documentId: "document-1",
        baseVersionId: "version-1",
        openedBy: "author-1",
        invitedMemberIds: ["author-2", "author-2"],
      }),
    ).resolves.toMatchObject({ id: "session-1" });

    expect(editor.createWorkingState).toHaveBeenCalledWith({
      documentId: "document-1",
      baseVersionId: "version-1",
      content: baseVersion.content,
      memberIds: ["author-1", "author-2"],
    });
    expect(database.documentAuthoringLock.create).toHaveBeenCalledWith({
      data: {
        documentId: "document-1",
        kind: "CO_AUTHORING",
        holderId: "author-1",
        sessionId: "session-1",
      },
    });
  });

  it("creates the initial immutable draft version and rendition", async () => {
    database.controlledDocument.create.mockResolvedValue({
      id: "document-1",
      organisationId: "org-1",
      title: "Quality narrative",
    });
    database.controlledDocumentVersion.create.mockResolvedValue(baseVersion);
    database.controlledDocument.update.mockResolvedValue({});

    await expect(
      service.createDocument({
        organisationId: "org-1",
        title: "Quality narrative",
        createdBy: "author-1",
        content: baseVersion.content,
      }),
    ).resolves.toMatchObject({
      id: "document-1",
      latestVersion: { id: "version-1" },
    });
    expect(rendition.render).toHaveBeenCalledWith({
      documentId: "document-1",
      content: baseVersion.content,
      majorVersion: 1,
      minorVersion: 0,
    });
    expect(database.controlledDocument.update).toHaveBeenCalledWith({
      where: { id: "document-1" },
      data: { latestVersionId: "version-1" },
    });
  });

  it("refuses a stale base before creating provider state", async () => {
    database.controlledDocument.findFirst.mockResolvedValue({
      id: "document-1",
      organisationId: "org-1",
      latestVersion: { ...baseVersion, id: "version-2" },
    });

    await expect(
      service.open({
        organisationId: "org-1",
        documentId: "document-1",
        baseVersionId: "version-1",
        openedBy: "author-1",
      }),
    ).rejects.toMatchObject({ statusCode: 409 });
    expect(editor.createWorkingState).not.toHaveBeenCalled();
  });

  it.each(["EFFECTIVE", "SUPERSEDED"])(
    "keeps %s versions read-only",
    async (status) => {
      database.controlledDocument.findFirst.mockResolvedValue({
        id: "document-1",
        organisationId: "org-1",
        latestVersion: { ...baseVersion, status },
      });

      await expect(
        service.open({
          organisationId: "org-1",
          documentId: "document-1",
          baseVersionId: "version-1",
          openedBy: "author-1",
        }),
      ).rejects.toThrow("read-only");
    },
  );

  it("maps a competing lock insert to a conflict", async () => {
    database.controlledDocument.findFirst.mockResolvedValue({
      id: "document-1",
      organisationId: "org-1",
      latestVersion: baseVersion,
    });
    database.authoringSession.create.mockResolvedValue(openSession);
    database.documentAuthoringLock.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError("duplicate", {
        code: "P2002",
        clientVersion: "6.19.3",
      }),
    );

    await expect(
      service.open({
        organisationId: "org-1",
        documentId: "document-1",
        baseVersionId: "version-1",
        openedBy: "author-1",
      }),
    ).rejects.toMatchObject({
      statusCode: 409,
      message: "This document is already checked out or being co-authored.",
    });
  });

  it("applies an invited contributor update with optimistic revision control", async () => {
    database.authoringSession.findFirst.mockResolvedValue(openSession);
    database.authoringSession.updateMany.mockResolvedValue({ count: 1 });
    database.authoringSessionMember.upsert.mockResolvedValue({});
    database.authoringSession.findUniqueOrThrow.mockResolvedValue({
      ...openSession,
      revision: 1,
      contributorIds: ["author-1", "author-2"],
      workingState: { blocks: [{ text: "Shared edit" }] },
    });

    const result = await service.sync({
      organisationId: "org-1",
      sessionId: "session-1",
      userId: "author-2",
      expectedRevision: 0,
      update: { blocks: [{ text: "Shared edit" }] },
    });

    expect(result.revision).toBe(1);
    expect(database.authoringSession.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ revision: 0, status: "OPEN" }),
        data: expect.objectContaining({
          contributorIds: ["author-1", "author-2"],
          revision: { increment: 1 },
        }),
      }),
    );
  });

  it("refuses a stale sync and users outside the invitation", async () => {
    database.authoringSession.findFirst
      .mockResolvedValueOnce({ ...openSession, revision: 2 })
      .mockResolvedValueOnce(openSession);

    await expect(
      service.sync({
        organisationId: "org-1",
        sessionId: "session-1",
        userId: "author-2",
        expectedRevision: 1,
        update: {},
      }),
    ).rejects.toThrow("working draft changed");
    await expect(
      service.sync({
        organisationId: "org-1",
        sessionId: "session-1",
        userId: "stranger",
        expectedRevision: 0,
        update: {},
      }),
    ).rejects.toMatchObject({ statusCode: 403 });
  });

  it("returns active presence for both named contributors", async () => {
    database.authoringSession.findFirst.mockResolvedValue(openSession);
    database.authoringSessionMember.upsert.mockResolvedValue({});
    database.authoringSessionMember.findMany.mockResolvedValue([
      { userId: "author-1" },
      { userId: "author-2" },
    ]);

    await expect(
      service.presence({
        organisationId: "org-1",
        sessionId: "session-1",
        userId: "author-2",
      }),
    ).resolves.toEqual([{ userId: "author-1" }, { userId: "author-2" }]);
    expect(database.authoringSessionMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ sessionId: "session-1" }),
      }),
    );
  });

  it("closes into exactly one next minor version and releases the lock", async () => {
    database.authoringSession.findFirst
      .mockResolvedValueOnce({ ...openSession, baseVersion })
      .mockResolvedValueOnce({
        ...openSession,
        baseVersion,
        document: { latestVersionId: "version-1" },
      });
    const produced = {
      ...baseVersion,
      id: "version-2",
      minorVersion: 1,
      supersedesVersionId: "version-1",
      contributorIds: ["author-1", "author-2"],
    };
    database.controlledDocumentVersion.create.mockResolvedValue(produced);
    database.controlledDocumentVersion.update.mockResolvedValue({});
    database.controlledDocument.update.mockResolvedValue({});
    database.authoringSession.update.mockResolvedValue({});
    database.documentAuthoringLock.delete.mockResolvedValue({});

    await expect(
      service.close({
        organisationId: "org-1",
        sessionId: "session-1",
        closedBy: "author-2",
      }),
    ).resolves.toMatchObject({ id: "version-2", minorVersion: 1 });

    expect(rendition.render).toHaveBeenCalledWith(
      expect.objectContaining({ majorVersion: 1, minorVersion: 1 }),
    );
    expect(database.controlledDocumentVersion.create).toHaveBeenCalledTimes(1);
    expect(database.documentAuthoringLock.delete).toHaveBeenCalledWith({
      where: { documentId: "document-1" },
    });
  });

  it("returns the produced version when close is replayed", async () => {
    database.authoringSession.findFirst.mockResolvedValue({
      ...openSession,
      status: "CLOSED",
      producedVersionId: "version-2",
      baseVersion,
    });
    database.controlledDocumentVersion.findUniqueOrThrow.mockResolvedValue({
      ...baseVersion,
      id: "version-2",
      minorVersion: 1,
    });

    await service.close({
      organisationId: "org-1",
      sessionId: "session-1",
      closedBy: "author-1",
    });

    expect(database.controlledDocumentVersion.create).not.toHaveBeenCalled();
    expect(rendition.render).not.toHaveBeenCalled();
  });

  it("rejects invalid identifiers and revision numbers", async () => {
    await expect(
      service.open({
        organisationId: "",
        documentId: "document-1",
        baseVersionId: "version-1",
        openedBy: "author-1",
      }),
    ).rejects.toBeInstanceOf(AuthoringSessionError);
    await expect(
      service.sync({
        organisationId: "org-1",
        sessionId: "session-1",
        userId: "author-1",
        expectedRevision: -1,
        update: {},
      }),
    ).rejects.toThrow("non-negative integer");
  });
});
