import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "src/config/prisma";

export class AuthoringSessionError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400,
  ) {
    super(message);
    this.name = "AuthoringSessionError";
  }
}

export interface EditorSessionAdapter {
  readonly provider: string;
  createWorkingState(input: {
    documentId: string;
    baseVersionId: string;
    content: Prisma.JsonValue;
    memberIds: string[];
  }): Promise<{
    providerSessionId?: string;
    workingState: Prisma.InputJsonValue;
  }>;
  applyUpdate(input: {
    providerSessionId?: string;
    workingState: Prisma.JsonValue;
    update: Prisma.JsonValue;
    userId: string;
  }): Promise<Prisma.InputJsonValue>;
  snapshot(input: {
    providerSessionId?: string;
    workingState: Prisma.JsonValue;
  }): Promise<Prisma.InputJsonValue>;
}

export interface AuthoringRenditionAdapter {
  render(input: {
    documentId: string;
    content: Prisma.InputJsonValue;
    majorVersion: number;
    minorVersion: number;
  }): Promise<{ url: string; contentType: string }>;
}

export interface OpenAuthoringSessionInput {
  organisationId: string;
  documentId: string;
  baseVersionId: string;
  openedBy: string;
  invitedMemberIds?: string[];
}

export interface CreateControlledDocumentInput {
  organisationId: string;
  title: string;
  createdBy: string;
  content: Prisma.InputJsonValue;
}

export interface SyncAuthoringSessionInput {
  organisationId: string;
  sessionId: string;
  userId: string;
  expectedRevision: number;
  update: Prisma.JsonValue;
}

export interface CloseAuthoringSessionInput {
  organisationId: string;
  sessionId: string;
  closedBy: string;
}

type DatabaseClient = Pick<
  PrismaClient,
  | "controlledDocument"
  | "controlledDocumentVersion"
  | "authoringSession"
  | "authoringSessionMember"
  | "documentAuthoringLock"
  | "$transaction"
>;

const uniqueIds = (values: string[]): string[] => [
  ...new Set(values.map((value) => value.trim()).filter(Boolean)),
];

const requireId = (value: string, field: string): string => {
  const normalized = value?.trim();
  if (!normalized) throw new AuthoringSessionError(`${field} is required`);
  return normalized;
};

const isLockConflict = (error: unknown): boolean =>
  error instanceof Prisma.PrismaClientKnownRequestError &&
  error.code === "P2002";

const assertMember = (
  session: {
    openedBy: string;
    invitedMemberIds: string[];
    contributorIds: string[];
  },
  userId: string,
): void => {
  const canEdit =
    session.openedBy === userId ||
    session.invitedMemberIds.includes(userId) ||
    session.contributorIds.includes(userId);
  if (!canEdit) {
    throw new AuthoringSessionError(
      "You are not a member of this authoring session",
      403,
    );
  }
};

const buildSessionService = (
  database: DatabaseClient,
  editor: EditorSessionAdapter,
  rendition: AuthoringRenditionAdapter,
) => ({
  async createDocument(input: CreateControlledDocumentInput) {
    const organisationId = requireId(input.organisationId, "organisationId");
    const title = requireId(input.title, "title");
    const createdBy = requireId(input.createdBy, "createdBy");
    return database.$transaction(
      async (tx) => {
        const document = await tx.controlledDocument.create({
          data: { organisationId, title },
        });
        const rendered = await rendition.render({
          documentId: document.id,
          content: input.content,
          majorVersion: 1,
          minorVersion: 0,
        });
        const version = await tx.controlledDocumentVersion.create({
          data: {
            documentId: document.id,
            content: input.content,
            renditionUrl: rendered.url,
            renditionContentType: rendered.contentType,
            contributorIds: [createdBy],
            createdBy,
          },
        });
        await tx.controlledDocument.update({
          where: { id: document.id },
          data: { latestVersionId: version.id },
        });
        return { ...document, latestVersion: version };
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },

  async open(input: OpenAuthoringSessionInput) {
    const organisationId = requireId(input.organisationId, "organisationId");
    const documentId = requireId(input.documentId, "documentId");
    const baseVersionId = requireId(input.baseVersionId, "baseVersionId");
    const openedBy = requireId(input.openedBy, "openedBy");
    const memberIds = uniqueIds([openedBy, ...(input.invitedMemberIds ?? [])]);

    const document = await database.controlledDocument.findFirst({
      where: { id: documentId, organisationId },
      include: { latestVersion: true },
    });
    if (!document?.latestVersion) {
      throw new AuthoringSessionError("Controlled document not found", 404);
    }
    if (document.latestVersion.id !== baseVersionId) {
      throw new AuthoringSessionError(
        "This version is no longer current. Reload the document before editing.",
        409,
      );
    }
    if (document.latestVersion.status !== "DRAFT") {
      throw new AuthoringSessionError(
        "Effective and superseded versions are read-only.",
        409,
      );
    }

    const editorState = await editor.createWorkingState({
      documentId,
      baseVersionId,
      content: document.latestVersion.content,
      memberIds,
    });

    try {
      return await database.$transaction(
        async (tx) => {
          const current = await tx.controlledDocument.findFirst({
            where: { id: documentId, organisationId },
            include: { latestVersion: true },
          });
          if (current?.latestVersion?.id !== baseVersionId) {
            throw new AuthoringSessionError(
              "This version is no longer current. Reload the document before editing.",
              409,
            );
          }
          if (current.latestVersion.status !== "DRAFT") {
            throw new AuthoringSessionError(
              "Effective and superseded versions are read-only.",
              409,
            );
          }

          const session = await tx.authoringSession.create({
            data: {
              organisationId,
              documentId,
              baseVersionId,
              editorProvider: editor.provider,
              providerSessionId: editorState.providerSessionId,
              workingState: editorState.workingState,
              invitedMemberIds: memberIds,
              contributorIds: [openedBy],
              openedBy,
              members: {
                create: memberIds.map((userId) => ({
                  userId,
                  joinedAt: userId === openedBy ? new Date() : undefined,
                  lastActiveAt: userId === openedBy ? new Date() : undefined,
                  contributedAt: userId === openedBy ? new Date() : undefined,
                })),
              },
            },
          });
          await tx.documentAuthoringLock.create({
            data: {
              documentId,
              kind: "CO_AUTHORING",
              holderId: openedBy,
              sessionId: session.id,
            },
          });
          return session;
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (error) {
      if (isLockConflict(error)) {
        throw new AuthoringSessionError(
          "This document is already checked out or being co-authored.",
          409,
        );
      }
      throw error;
    }
  },

  async sync(input: SyncAuthoringSessionInput) {
    const organisationId = requireId(input.organisationId, "organisationId");
    const sessionId = requireId(input.sessionId, "sessionId");
    const userId = requireId(input.userId, "userId");
    if (
      !Number.isInteger(input.expectedRevision) ||
      input.expectedRevision < 0
    ) {
      throw new AuthoringSessionError(
        "expectedRevision must be a non-negative integer",
      );
    }

    const session = await database.authoringSession.findFirst({
      where: { id: sessionId, organisationId },
    });
    if (!session)
      throw new AuthoringSessionError("Authoring session not found", 404);
    if (session.status !== "OPEN") {
      throw new AuthoringSessionError("This authoring session is closed", 409);
    }
    assertMember(session, userId);
    if (session.revision !== input.expectedRevision) {
      throw new AuthoringSessionError(
        "The working draft changed. Refresh it before applying this update.",
        409,
      );
    }

    const workingState = await editor.applyUpdate({
      providerSessionId: session.providerSessionId ?? undefined,
      workingState: session.workingState,
      update: input.update,
      userId,
    });
    const contributorIds = uniqueIds([...session.contributorIds, userId]);

    return database.$transaction(async (tx) => {
      const updated = await tx.authoringSession.updateMany({
        where: {
          id: sessionId,
          organisationId,
          status: "OPEN",
          revision: input.expectedRevision,
        },
        data: {
          workingState,
          contributorIds,
          revision: { increment: 1 },
        },
      });
      if (updated.count !== 1) {
        throw new AuthoringSessionError(
          "The working draft changed. Refresh it before applying this update.",
          409,
        );
      }
      const now = new Date();
      await tx.authoringSessionMember.upsert({
        where: { sessionId_userId: { sessionId, userId } },
        create: {
          sessionId,
          userId,
          joinedAt: now,
          lastActiveAt: now,
          contributedAt: now,
        },
        update: { joinedAt: now, lastActiveAt: now, contributedAt: now },
      });
      return tx.authoringSession.findUniqueOrThrow({
        where: { id: sessionId },
      });
    });
  },

  async presence(input: {
    organisationId: string;
    sessionId: string;
    userId: string;
  }) {
    const organisationId = requireId(input.organisationId, "organisationId");
    const sessionId = requireId(input.sessionId, "sessionId");
    const userId = requireId(input.userId, "userId");
    const session = await database.authoringSession.findFirst({
      where: { id: sessionId, organisationId },
    });
    if (!session)
      throw new AuthoringSessionError("Authoring session not found", 404);
    if (session.status !== "OPEN") {
      throw new AuthoringSessionError("This authoring session is closed", 409);
    }
    assertMember(session, userId);

    const now = new Date();
    await database.authoringSessionMember.upsert({
      where: { sessionId_userId: { sessionId, userId } },
      create: { sessionId, userId, joinedAt: now, lastActiveAt: now },
      update: { joinedAt: now, lastActiveAt: now },
    });
    return database.authoringSessionMember.findMany({
      where: {
        sessionId,
        lastActiveAt: { gte: new Date(now.getTime() - 60_000) },
      },
      orderBy: { userId: "asc" },
    });
  },

  async close(input: CloseAuthoringSessionInput) {
    const organisationId = requireId(input.organisationId, "organisationId");
    const sessionId = requireId(input.sessionId, "sessionId");
    const closedBy = requireId(input.closedBy, "closedBy");
    const session = await database.authoringSession.findFirst({
      where: { id: sessionId, organisationId },
      include: { baseVersion: true },
    });
    if (!session)
      throw new AuthoringSessionError("Authoring session not found", 404);
    assertMember(session, closedBy);
    if (session.status === "CLOSED" && session.producedVersionId) {
      return database.controlledDocumentVersion.findUniqueOrThrow({
        where: { id: session.producedVersionId },
      });
    }
    if (session.status !== "OPEN") {
      throw new AuthoringSessionError(
        "This authoring session cannot be closed",
        409,
      );
    }

    const content = await editor.snapshot({
      providerSessionId: session.providerSessionId ?? undefined,
      workingState: session.workingState,
    });
    const nextMinor = session.baseVersion.minorVersion + 1;
    const rendered = await rendition.render({
      documentId: session.documentId,
      content,
      majorVersion: session.baseVersion.majorVersion,
      minorVersion: nextMinor,
    });

    return database.$transaction(
      async (tx) => {
        const current = await tx.authoringSession.findFirst({
          where: { id: sessionId, organisationId },
          include: {
            baseVersion: true,
            document: { select: { latestVersionId: true } },
          },
        });
        if (!current)
          throw new AuthoringSessionError("Authoring session not found", 404);
        if (current.status === "CLOSED" && current.producedVersionId) {
          return tx.controlledDocumentVersion.findUniqueOrThrow({
            where: { id: current.producedVersionId },
          });
        }
        if (
          current.status !== "OPEN" ||
          current.document.latestVersionId !== current.baseVersionId
        ) {
          throw new AuthoringSessionError(
            "The base version is no longer current. The session cannot be closed.",
            409,
          );
        }

        const version = await tx.controlledDocumentVersion.create({
          data: {
            documentId: current.documentId,
            majorVersion: current.baseVersion.majorVersion,
            minorVersion: current.baseVersion.minorVersion + 1,
            status: "DRAFT",
            content,
            renditionUrl: rendered.url,
            renditionContentType: rendered.contentType,
            contributorIds: uniqueIds(current.contributorIds),
            createdBy: closedBy,
            supersedesVersionId: current.baseVersionId,
          },
        });
        await tx.controlledDocumentVersion.update({
          where: { id: current.baseVersionId },
          data: { status: "SUPERSEDED" },
        });
        await tx.controlledDocument.update({
          where: { id: current.documentId },
          data: { latestVersionId: version.id },
        });
        await tx.authoringSession.update({
          where: { id: sessionId },
          data: {
            status: "CLOSED",
            closedBy,
            closedAt: new Date(),
            producedVersionId: version.id,
          },
        });
        await tx.documentAuthoringLock.delete({
          where: { documentId: current.documentId },
        });
        return version;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  },
});

export const createAuthoringSessionService = (input: {
  editor: EditorSessionAdapter;
  rendition: AuthoringRenditionAdapter;
  database?: DatabaseClient;
}) =>
  buildSessionService(input.database ?? prisma, input.editor, input.rendition);
