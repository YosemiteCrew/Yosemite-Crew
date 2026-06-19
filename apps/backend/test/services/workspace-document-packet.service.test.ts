import { prisma } from "src/config/prisma";
import { WorkspaceService } from "src/services/workspace.prisma.service";
import { WorkspaceDocumentPacketService } from "../../src/services/workspace-document-packet.service";

jest.mock("src/config/prisma", () => ({
  prisma: {
    workspaceDocumentPacket: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
  },
}));

jest.mock("src/services/workspace.prisma.service", () => ({
  WorkspaceService: {
    getEncounterBootstrap: jest.fn(),
  },
  WorkspaceServiceError: class WorkspaceServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 400,
    ) {
      super(message);
    }
  },
}));

describe("WorkspaceDocumentPacketService", () => {
  const mockedPrisma = prisma as unknown as {
    workspaceDocumentPacket: {
      create: jest.Mock;
      findFirst: jest.Mock;
      update: jest.Mock;
    };
  };
  const mockedWorkspaceService = WorkspaceService as unknown as {
    getEncounterBootstrap: jest.Mock;
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockedWorkspaceService.getEncounterBootstrap.mockResolvedValue({
      appointment: { id: "appt-1" },
      encounter: { id: "enc-1" },
      companion: { id: "comp-1" },
      documents: [
        {
          documentId: "doc-1",
          sourceKind: "FORM_SUBMISSION",
          sourceId: "doc-1",
          appointmentId: "appt-1",
          encounterId: "enc-1",
          companionId: "comp-1",
          templateId: null,
          templateVersion: null,
          title: "Consent",
          kind: "FORM",
          status: "SIGNED",
          signingStatus: "SIGNED",
          pdfUrl: null,
          createdAt: new Date("2026-06-15T10:00:00.000Z"),
          updatedAt: new Date("2026-06-15T10:00:00.000Z"),
        },
      ],
    });
  });

  it("creates a packet snapshot for an encounter", async () => {
    mockedPrisma.workspaceDocumentPacket.create.mockResolvedValue({
      id: "packet-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      status: "DRAFT",
      documents: [
        {
          documentId: "doc-1",
          sourceKind: "FORM_SUBMISSION",
          sourceId: "doc-1",
          appointmentId: "appt-1",
          encounterId: "enc-1",
          companionId: "comp-1",
          templateId: null,
          templateVersion: null,
          title: "Consent",
          kind: "FORM",
          status: "SIGNED",
          signingStatus: "SIGNED",
          pdfUrl: null,
          createdAt: "2026-06-15T10:00:00.000Z",
          updatedAt: "2026-06-15T10:00:00.000Z",
        },
      ],
      signedBy: null,
      signedByName: null,
      signedAt: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });

    const packet = await WorkspaceDocumentPacketService.createForEncounter({
      organisationId: "org-1",
      encounterId: "enc-1",
    });

    expect(packet.packetId).toBe("packet-1");
    expect(mockedPrisma.workspaceDocumentPacket.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          encounterId: "enc-1",
          documents: expect.any(Array),
        }),
      }),
    );
  });

  it("loads a packet by id", async () => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue({
      id: "packet-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      status: "DRAFT",
      documents: [],
      signedBy: null,
      signedByName: null,
      signedAt: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });

    const packet = await WorkspaceDocumentPacketService.getById(
      "org-1",
      "packet-1",
    );

    expect(packet.packetId).toBe("packet-1");
  });

  it("signs a packet and rejects repeated signing", async () => {
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue({
      id: "packet-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      status: "DRAFT",
      documents: [],
      signedBy: null,
      signedByName: null,
      signedAt: null,
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T10:00:00.000Z"),
    });
    mockedPrisma.workspaceDocumentPacket.update.mockResolvedValue({
      id: "packet-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      status: "FINAL",
      documents: [],
      signedBy: "user-1",
      signedByName: "Dr. Jane",
      signedAt: new Date("2026-06-15T12:00:00.000Z"),
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T12:00:00.000Z"),
    });

    const packet = await WorkspaceDocumentPacketService.sign({
      organisationId: "org-1",
      packetId: "packet-1",
      signerId: "user-1",
      signerName: "Dr. Jane",
    });

    expect(packet.status).toBe("FINAL");
    expect(mockedPrisma.workspaceDocumentPacket.update).toHaveBeenCalled();

    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue({
      id: "packet-1",
      organisationId: "org-1",
      appointmentId: "appt-1",
      encounterId: "enc-1",
      companionId: "comp-1",
      status: "FINAL",
      documents: [],
      signedBy: "user-1",
      signedByName: "Dr. Jane",
      signedAt: new Date("2026-06-15T12:00:00.000Z"),
      createdAt: new Date("2026-06-15T10:00:00.000Z"),
      updatedAt: new Date("2026-06-15T12:00:00.000Z"),
    });

    await expect(
      WorkspaceDocumentPacketService.sign({
        organisationId: "org-1",
        packetId: "packet-1",
        signerId: "user-1",
      }),
    ).rejects.toThrow("Document packet already signed");
  });
});
