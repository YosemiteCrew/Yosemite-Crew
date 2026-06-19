import { prisma } from "src/config/prisma";
import {
  WorkspaceService,
  WorkspaceServiceError,
} from "src/services/workspace.prisma.service";
import type {
  WorkspaceDocumentPacketRow,
  WorkspaceDocumentRow,
} from "@yosemite-crew/types";

type CreatePacketInput = {
  organisationId: string;
  encounterId: string;
};

type SignPacketInput = {
  organisationId: string;
  packetId: string;
  signerId: string;
  signerName?: string;
};

type PacketRecord = {
  id: string;
  organisationId: string;
  appointmentId: string | null;
  encounterId: string;
  companionId: string | null;
  status: "DRAFT" | "FINAL";
  documents: unknown;
  signedBy: string | null;
  signedByName: string | null;
  signedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

type SerializedWorkspaceDocumentRow = Omit<
  WorkspaceDocumentRow,
  "createdAt" | "updatedAt"
> & {
  createdAt: string;
  updatedAt: string;
};

const isSerializedWorkspaceDocumentRow = (
  value: unknown,
): value is SerializedWorkspaceDocumentRow =>
  typeof value === "object" &&
  value !== null &&
  "documentId" in value &&
  "title" in value;

const serializeDocumentRow = (
  row: WorkspaceDocumentRow,
): SerializedWorkspaceDocumentRow => ({
  ...row,
  createdAt: row.createdAt.toISOString(),
  updatedAt: row.updatedAt.toISOString(),
});

const deserializeDocumentRow = (
  row: SerializedWorkspaceDocumentRow,
): WorkspaceDocumentRow => ({
  ...row,
  createdAt: new Date(row.createdAt),
  updatedAt: new Date(row.updatedAt),
});

const mapPacket = (row: PacketRecord): WorkspaceDocumentPacketRow => ({
  packetId: row.id,
  organisationId: row.organisationId,
  appointmentId: row.appointmentId,
  encounterId: row.encounterId,
  companionId: row.companionId,
  documents: Array.isArray(row.documents)
    ? row.documents
        .filter(isSerializedWorkspaceDocumentRow)
        .map(deserializeDocumentRow)
    : [],
  status: row.status,
  signedBy: row.signedBy,
  signedByName: row.signedByName,
  signedAt: row.signedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const ensurePacket = async (
  organisationId: string,
  packetId: string,
): Promise<PacketRecord> => {
  const packet = (await prisma.workspaceDocumentPacket.findFirst({
    where: {
      id: packetId,
      organisationId,
    },
  })) as PacketRecord | null;

  if (!packet) {
    throw new WorkspaceServiceError("Document packet not found", 404);
  }

  return packet;
};

export const WorkspaceDocumentPacketService = {
  async createForEncounter(
    input: CreatePacketInput,
  ): Promise<WorkspaceDocumentPacketRow> {
    const bootstrap = await WorkspaceService.getEncounterBootstrap(
      {
        organisationId: input.organisationId,
        encounterId: input.encounterId,
      },
      [],
    );

    const packet = (await prisma.workspaceDocumentPacket.create({
      data: {
        organisationId: input.organisationId,
        appointmentId: bootstrap.appointment?.id ?? null,
        encounterId: input.encounterId,
        companionId: bootstrap.companion?.id ?? null,
        status: "DRAFT",
        documents: bootstrap.documents.map(serializeDocumentRow),
      },
    })) as PacketRecord;

    return mapPacket(packet);
  },

  async getById(
    organisationId: string,
    packetId: string,
  ): Promise<WorkspaceDocumentPacketRow> {
    return mapPacket(await ensurePacket(organisationId, packetId));
  },

  async sign(input: SignPacketInput): Promise<WorkspaceDocumentPacketRow> {
    const packet = await ensurePacket(input.organisationId, input.packetId);

    if (packet.status === "FINAL") {
      throw new WorkspaceServiceError("Document packet already signed", 409);
    }

    const signedPacket = (await prisma.workspaceDocumentPacket.update({
      where: {
        id: packet.id,
      },
      data: {
        status: "FINAL",
        signedBy: input.signerId,
        signedByName: input.signerName ?? null,
        signedAt: new Date(),
      },
    })) as PacketRecord;

    return mapPacket(signedPacket);
  },
};
