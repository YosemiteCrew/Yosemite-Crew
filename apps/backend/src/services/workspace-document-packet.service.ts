import { Prisma } from "@prisma/client";
import axios from "axios";
import { prisma } from "src/config/prisma";
import {
  WorkspaceService,
  WorkspaceServiceError,
} from "src/services/workspace.prisma.service";
import { DocumensoService } from "src/services/documenso.service";
import { buildMergedClinicalPacketPdf } from "src/services/clinical-packet-pdf.service";
import { renderCombinedClinicalPacketPdf } from "src/services/rendered-document-renderer.service";
import { rerenderPersistedClinicalRenderedDocumentPdf } from "src/services/rendered-document.service";
import logger from "src/utils/logger";
import {
  INVALID_OUTBOUND_DOCUMENT_URL_MESSAGE,
  readValidatedPdfResponse,
  resolveOutboundDocumentUrl,
  type OutboundDocumentRequest,
} from "src/utils/outbound-document-url";
import type {
  WorkspaceDocumentPacketRow,
  WorkspaceDocumentPacketSigning,
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

const ensureRequiredId = (value: string, fieldName: string): string => {
  const normalized = value.trim();
  if (!normalized) {
    throw new WorkspaceServiceError(`${fieldName} is required`, 400);
  }
  return normalized;
};

/**
 * Validate the signing provider's download link before it is used and translate
 * a rejection into a typed 400. A link the guard turns down is a configuration
 * problem, not the transient "the signed copy is momentarily unavailable" case
 * the caller's fallback exists for, so the two must not look the same: this one
 * surfaces, while an expired or unreachable link still falls back.
 */
const resolveSignedPacketRequest = async (
  downloadUrl: string,
): Promise<OutboundDocumentRequest> => {
  try {
    return await resolveOutboundDocumentUrl(downloadUrl);
  } catch (error) {
    throw new WorkspaceServiceError(
      error instanceof Error
        ? error.message
        : INVALID_OUTBOUND_DOCUMENT_URL_MESSAGE,
      400,
    );
  }
};

type PacketRecord = {
  id: string;
  organisationId: string;
  appointmentId: string | null;
  encounterId: string;
  companionId: string | null;
  status: "DRAFT" | "FINAL";
  documents: unknown;
  signing: unknown;
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

const parseSigning = (
  value: unknown,
): WorkspaceDocumentPacketSigning | null => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  if (typeof candidate.status !== "string") {
    return null;
  }
  return value as WorkspaceDocumentPacketSigning;
};

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
  signing: parseSigning(row.signing),
  signedBy: row.signedBy,
  signedByName: row.signedByName,
  signedAt: row.signedAt,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * `signing.signingUrl` carries the Documenso recipient token: anyone holding the
 * URL can sign the packet. Read paths are open to `document:view:any`, which is
 * a far wider audience than the signer, so they project the signing state down
 * to its non-bearer fields.
 */
const toReadOnlyPacket = (
  packet: WorkspaceDocumentPacketRow,
): WorkspaceDocumentPacketRow =>
  packet.signing
    ? { ...packet, signing: { ...packet.signing, signingUrl: null } }
    : packet;

/**
 * Only rendered documents can be merged into the signing PDF — the merge loader
 * resolves bytes from the rendered-document pipeline. Direct uploads
 * (`sourceKind: "DOCUMENT"`) have no rendered source (their content lives in
 * uploaded attachments), so including them would fail the whole merge. Skip them
 * here (with an audit log) so the renderable documents still sign instead of the
 * packet hard-failing. Merging uploaded attachments is a separate follow-up.
 */
const selectMergeableDocuments = (
  documents: WorkspaceDocumentRow[],
  context: string,
): WorkspaceDocumentRow[] => {
  // Exclude direct uploads (DOCUMENT - not renderable/mergeable) and INVOICE rendered documents:
  // an invoice surfaces in the All Documents list but is NOT a clinical-packet member, so it must
  // never be merged into a signed or printed discharge packet.
  const mergeable = documents.filter(
    (doc) => doc.sourceKind !== "DOCUMENT" && doc.sourceKind !== "INVOICE",
  );
  const skipped = documents.length - mergeable.length;
  if (skipped > 0) {
    logger.warn(
      `[WorkspaceDocumentPacket] Skipping ${skipped} non-packet document(s) (direct uploads and invoices) when ${context}; only clinical/form packet members are merged into the PDF.`,
    );
  }
  return mergeable;
};

/**
 * Canonical clinical merge order decided by the product owner. Documents are
 * merged in this fixed clinical sequence (any missing kind is simply absent);
 * any kind not listed here sorts last while preserving the input order.
 */
const CANONICAL_MERGE_ORDER = [
  "SOAP_NOTE",
  "VITAL_RECORD",
  "PRESCRIPTION",
  "DISCHARGE_SUMMARY",
  "INPATIENT_SCHEDULE",
];

const MERGE_ORDER_RANK = new Map(
  CANONICAL_MERGE_ORDER.map((kind, index) => [kind, index]),
);

/**
 * The four clinical-artifact kinds that the combined renderer can emit as
 * content-only sections under one shared header (invoices are not packet
 * members). A packet whose docs are all of these AND all CLINICAL_ARTIFACT
 * sourced renders as ONE continuous PDF; anything else falls back to the merge.
 */
const CLINICAL_KINDS = new Set(CANONICAL_MERGE_ORDER);

const isAllClinicalArtifacts = (docs: WorkspaceDocumentRow[]): boolean =>
  docs.length > 0 &&
  docs.every(
    (doc) =>
      doc.sourceKind === "CLINICAL_ARTIFACT" &&
      CLINICAL_KINDS.has(doc.kind) &&
      // A templated artifact's fields only exist in its own rendered PDF; the
      // combined renderer would re-render it from the artifact and drop them.
      !doc.templateId,
  );

const mergeOrderRank = (kind: string): number =>
  MERGE_ORDER_RANK.get(kind) ?? CANONICAL_MERGE_ORDER.length;

/**
 * Order the mergeable documents into the canonical clinical sequence
 * (SOAP_NOTE → VITAL_RECORD → PRESCRIPTION → DISCHARGE_SUMMARY) so the merged
 * PDF is deterministic regardless of the DB query order. Stable for equal ranks.
 */
const orderDocumentsForMerge = (
  documents: WorkspaceDocumentRow[],
): WorkspaceDocumentRow[] =>
  documents
    .map((doc, index) => ({ doc, index }))
    .sort((a, b) => {
      const rankDiff = mergeOrderRank(a.doc.kind) - mergeOrderRank(b.doc.kind);
      return rankDiff === 0 ? a.index - b.index : rankDiff;
    })
    .map((entry) => entry.doc);

/**
 * Clinical artifacts are merged from their persisted rendered PDF. When an
 * artifact has not been rendered yet (`pdfUrl` empty), render and persist it on
 * demand so its bytes + signaturePlacement exist before the merge runs.
 * Idempotent: only artifacts missing a `pdfUrl` are rendered, and skipping them
 * would silently drop clinical content, so they are never skipped. Non-artifact
 * mergeable kinds are left untouched (their loader renders on demand).
 */
const ensureClinicalArtifactsRendered = async (
  organisationId: string,
  documents: WorkspaceDocumentRow[],
): Promise<void> => {
  const pending = documents.filter(
    (doc) => doc.sourceKind === "CLINICAL_ARTIFACT" && !doc.pdfUrl,
  );
  if (!pending.length) {
    return;
  }

  await Promise.all(
    pending.map((doc) =>
      rerenderPersistedClinicalRenderedDocumentPdf(
        doc.documentId,
        organisationId,
      ),
    ),
  );
};

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

/**
 * The signing packet is always sent to the authenticated signer's own address.
 * The recipient decides who can sign a clinical record, so it must never be
 * taken from the request.
 */
const resolveSignerEmail = async (signerId: string): Promise<string | null> => {
  const user = await prisma.user.findFirst({
    where: { userId: signerId },
    select: { email: true },
  });
  return user?.email ?? null;
};

const deserializePacketDocuments = (
  documents: unknown,
): WorkspaceDocumentRow[] =>
  Array.isArray(documents)
    ? documents
        .filter(isSerializedWorkspaceDocumentRow)
        .map(deserializeDocumentRow)
    : [];

const findLatestEncounterPacket = async (
  organisationId: string,
  encounterId: string,
): Promise<PacketRecord | null> =>
  (await prisma.workspaceDocumentPacket.findFirst({
    where: { organisationId, encounterId },
    orderBy: { updatedAt: "desc" },
  })) as PacketRecord | null;

const hasActiveOrCompletedSigning = (packet: PacketRecord): boolean => {
  if (packet.status === "FINAL") {
    return true;
  }
  const signing = parseSigning(packet.signing);
  return signing?.status === "IN_PROGRESS" || signing?.status === "SIGNED";
};

export const WorkspaceDocumentPacketService = {
  async createForEncounter(
    input: CreatePacketInput,
  ): Promise<WorkspaceDocumentPacketRow> {
    const existingPacket = await findLatestEncounterPacket(
      input.organisationId,
      input.encounterId,
    );
    if (existingPacket && hasActiveOrCompletedSigning(existingPacket)) {
      return mapPacket(existingPacket);
    }

    const bootstrap = await WorkspaceService.getEncounterBootstrap(
      {
        organisationId: input.organisationId,
        encounterId: input.encounterId,
      },
      undefined,
      { systemAccess: true },
    );

    if (existingPacket) {
      const refreshed = (await prisma.workspaceDocumentPacket.update({
        where: { id: existingPacket.id },
        data: {
          appointmentId: bootstrap.appointment?.id ?? null,
          companionId: bootstrap.companion?.id ?? null,
          status: "DRAFT",
          documents: bootstrap.documents.map(serializeDocumentRow),
        },
      })) as PacketRecord;

      return mapPacket(refreshed);
    }

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
    return toReadOnlyPacket(
      mapPacket(await ensurePacket(organisationId, packetId)),
    );
  },

  /**
   * Initiate signing of the packet as a single merged PDF via Documenso.
   * The packet stays DRAFT until the Documenso webhook confirms completion
   * (clinical-safety: a packet is only FINAL once it is actually signed).
   */
  async sign(input: SignPacketInput): Promise<WorkspaceDocumentPacketRow> {
    const packet = await ensurePacket(input.organisationId, input.packetId);

    if (packet.status === "FINAL") {
      throw new WorkspaceServiceError("Document packet already signed", 409);
    }

    const existingSigning = parseSigning(packet.signing);
    if (existingSigning?.status === "IN_PROGRESS") {
      throw new WorkspaceServiceError(
        "Document packet signing already in progress",
        409,
      );
    }

    const documents = deserializePacketDocuments(packet.documents);
    if (!documents.length) {
      throw new WorkspaceServiceError(
        "Document packet has no documents to sign",
        409,
      );
    }

    const signerEmail = await resolveSignerEmail(input.signerId);
    if (!signerEmail) {
      throw new WorkspaceServiceError(
        "Unable to resolve signer email for packet signing",
        400,
      );
    }

    const apiKey = await DocumensoService.resolveOrganisationApiKey(
      packet.organisationId,
    );
    if (!apiKey) {
      throw new WorkspaceServiceError(
        "Documenso API key not configured for organisation",
        400,
      );
    }

    const title = `Clinical Packet ${packet.encounterId}`;

    const mergeableDocuments = orderDocumentsForMerge(
      selectMergeableDocuments(documents, "signing the document packet"),
    );
    if (!mergeableDocuments.length) {
      throw new WorkspaceServiceError(
        "Document packet has no rendered documents to sign",
        409,
      );
    }

    await ensureClinicalArtifactsRendered(
      packet.organisationId,
      mergeableDocuments,
    );

    let merged;
    if (isAllClinicalArtifacts(mergeableDocuments)) {
      logger.info(
        `[WorkspaceDocumentPacket] Signing packet ${packet.id} as a combined clinical PDF (${mergeableDocuments.length} clinical artifact(s)).`,
      );
      merged = await renderCombinedClinicalPacketPdf({
        organisationId: packet.organisationId,
        signerName: input.signerName ?? null,
        documents: mergeableDocuments.map((doc) => ({
          documentId: doc.documentId,
          sourceId: doc.sourceId,
          kind: doc.kind,
          title: doc.title,
        })),
      });
    } else {
      logger.info(
        `[WorkspaceDocumentPacket] Signing packet ${packet.id} via PDF merge (mixed/non-clinical packet, ${mergeableDocuments.length} document(s)).`,
      );
      merged = await buildMergedClinicalPacketPdf({
        organisationId: packet.organisationId,
        title,
        signerName: input.signerName ?? null,
        documents: mergeableDocuments.map((doc) => ({
          documentId: doc.documentId,
          title: doc.title,
          kind: doc.kind,
        })),
      });
    }

    const doc = await DocumensoService.createDocument({
      pdf: merged.pdf,
      signerEmail,
      signerName: input.signerName,
      apiKey,
      signaturePlacement: merged.signaturePlacement,
      title,
    });

    if (!doc || typeof doc.id !== "number") {
      throw new WorkspaceServiceError(
        "Unable to create Documenso document",
        502,
      );
    }

    const documensoPublicBaseUrl =
      process.env.DOCUMENSO_URL ??
      process.env.DOCUMENSO_HOST_URL ??
      process.env.DOCUMENSO_BASE_URL ??
      "";
    const signingUrl =
      documensoPublicBaseUrl && doc.recipients?.[0]?.token
        ? `${documensoPublicBaseUrl}/sign/${doc.recipients[0].token}`
        : null;

    await DocumensoService.distributeDocument({ documentId: doc.id, apiKey });

    const signing: WorkspaceDocumentPacketSigning = {
      required: true,
      provider: "DOCUMENSO",
      status: "IN_PROGRESS",
      documentId: doc.id.toString(),
      signerId: input.signerId,
      signerEmail,
      signerName: input.signerName ?? null,
      signingUrl,
      documentIds: mergeableDocuments.map((d) => d.documentId),
    };

    const updated = (await prisma.workspaceDocumentPacket.update({
      where: { id: packet.id },
      data: { signing: signing as unknown as Prisma.InputJsonValue },
    })) as PacketRecord;

    return mapPacket(updated);
  },

  /**
   * Complete packet signing once Documenso reports the document COMPLETED.
   * Confirms that state with Documenso first, then downloads the signed packet,
   * marks the packet FINAL, and marks every bundled document SIGNED against the
   * single signed packet PDF. A document Documenso does not report as COMPLETED
   * is returned unchanged and nothing is stamped.
   */
  async completeSigning(
    packetId: string,
  ): Promise<WorkspaceDocumentPacketRow | null> {
    const packet = (await prisma.workspaceDocumentPacket.findUnique({
      where: { id: packetId },
    })) as PacketRecord | null;

    if (!packet) {
      return null;
    }

    const signing = parseSigning(packet.signing);
    if (!signing) {
      return mapPacket(packet);
    }
    if (packet.status === "FINAL" || signing.status === "SIGNED") {
      return mapPacket(packet);
    }
    if (!signing.documentId) {
      throw new WorkspaceServiceError("Documenso document id missing", 400);
    }

    const apiKey = await DocumensoService.resolveOrganisationApiKey(
      packet.organisationId,
    );
    if (!apiKey) {
      throw new WorkspaceServiceError(
        "Documenso API key not configured for organisation",
        400,
      );
    }

    const documensoDocumentId = Number.parseInt(signing.documentId, 10);

    // Documenso is the only authority on whether this document was actually
    // signed. A downloadable PDF is NOT that evidence — Documenso serves the
    // unsigned copy for a still-PENDING document, so finalising on a successful
    // download alone stamped packets as legally signed that nobody had signed.
    // Ask for the document's state and require COMPLETED before writing.
    const documensoStatus = await DocumensoService.getDocumentStatus({
      documentId: documensoDocumentId,
      apiKey,
    });
    if (documensoStatus !== "COMPLETED") {
      // Not an error: "not signed yet" is a normal state (the signer closed the
      // frame without finishing). Return the packet as it stands — DRAFT, with
      // signing still IN_PROGRESS — so callers read the truth rather than a
      // failure, and a later reconcile/webhook can still finalise it.
      logger.info(
        `[WorkspaceDocumentPacket] Not finalising packet ${packet.id}: Documenso reports document ${signing.documentId} as ${documensoStatus}, not COMPLETED.`,
      );
      return mapPacket(packet);
    }

    const signedPdf = await DocumensoService.downloadSignedDocument({
      documentId: documensoDocumentId,
      apiKey,
    });
    if (!signedPdf) {
      throw new WorkspaceServiceError("Unable to download signed packet", 502);
    }

    const signedAt = new Date();
    const signedUrl = signedPdf.downloadUrl ?? null;

    const updated = (await prisma.workspaceDocumentPacket.update({
      where: { id: packet.id },
      data: {
        status: "FINAL",
        signedBy: signing.signerId,
        signedByName: signing.signerName ?? null,
        signedAt,
        signing: {
          ...signing,
          status: "SIGNED",
          pdf: { url: signedUrl },
        } as unknown as Prisma.InputJsonValue,
      },
    })) as PacketRecord;

    await Promise.all(
      signing.documentIds.map(async (documentId) => {
        try {
          await prisma.renderedDocument.update({
            where: { id: documentId },
            data: {
              status: "SIGNED",
              signedBy: signing.signerId,
              signedAt,
              pdfUrl: signedUrl ?? undefined,
              signing: {
                required: true,
                provider: "DOCUMENSO",
                status: "SIGNED",
                viaPacketId: packet.id,
                pdf: { url: signedUrl },
              } as unknown as Prisma.InputJsonValue,
            },
          });
          await prisma.documentSignature.upsert({
            where: { renderedDocumentId: documentId },
            update: { signedAt },
            create: {
              renderedDocumentId: documentId,
              signerId: signing.signerId,
              signerType: "PMS_USER",
              signedAt,
            },
          });
        } catch (error) {
          logger.warn("[Packet] Failed to mark child document signed", {
            documentId,
            error,
          });
        }
      }),
    );

    return mapPacket(updated);
  },

  /**
   * On-demand reconciliation of a packet's signing state, org-scoped for the API.
   * The Documenso completion webhook can't reach the backend in local/dev (and can
   * lag in prod), so the frontend calls this when the signing overlay closes: we
   * ask Documenso for the document's state and, only if it is COMPLETED, finalize
   * the packet + mark every bundled document SIGNED, returning the updated packet.
   *
   * When the signature is still outstanding (the user closed the frame without
   * completing), the packet is returned unchanged — still DRAFT, signing still
   * IN_PROGRESS. That is a truthful answer, not an error, and it is exactly what
   * the frontend already reads (it checks `signing.status === 'SIGNED'`).
   */
  async reconcile(
    organisationId: string,
    packetId: string,
  ): Promise<WorkspaceDocumentPacketRow> {
    const packet = await ensurePacket(organisationId, packetId);
    if (packet.status === "FINAL") {
      return mapPacket(packet);
    }
    const updated = await this.completeSigning(packetId);
    return updated ?? mapPacket(packet);
  },

  /**
   * Reset signing if Documenso reports the packet document was deleted before
   * completion. Already-signed packets are left untouched.
   */
  async resetSigning(packetId: string): Promise<void> {
    const packet = (await prisma.workspaceDocumentPacket.findUnique({
      where: { id: packetId },
    })) as PacketRecord | null;

    if (!packet) {
      return;
    }

    const signing = parseSigning(packet.signing);
    if (!signing || signing.status === "SIGNED") {
      return;
    }

    await prisma.workspaceDocumentPacket.update({
      where: { id: packet.id },
      data: {
        signing: {
          ...signing,
          status: "NOT_STARTED",
        } as unknown as Prisma.InputJsonValue,
      },
    });
  },

  /**
   * When the encounter's packet has been signed, return the signed packet PDF
   * bytes (the single Documenso-signed copy) so print/download serves the signed
   * document rather than a freshly re-merged unsigned copy. Returns `null` when
   * there is no signed packet so the caller falls back to the live merge.
   */
  async fetchSignedEncounterPacketPdf(
    organisationId: string,
    encounterId: string,
  ): Promise<Buffer | null> {
    const packet = (await prisma.workspaceDocumentPacket.findFirst({
      where: { organisationId, encounterId, status: "FINAL" },
      orderBy: { signedAt: "desc" },
    })) as PacketRecord | null;
    if (!packet) {
      return null;
    }

    const signing = parseSigning(packet.signing);
    if (signing?.status !== "SIGNED" || !signing.documentId) {
      return null;
    }

    let downloadUrl: string | null = null;
    try {
      // Re-resolve a fresh signed download URL — the persisted one is a
      // short-lived presigned URL that may have expired since signing completed.
      const apiKey =
        await DocumensoService.resolveOrganisationApiKey(organisationId);
      const signed = await DocumensoService.downloadSignedDocument({
        documentId: Number.parseInt(signing.documentId, 10),
        apiKey: apiKey ?? undefined,
      });
      downloadUrl = signed?.downloadUrl ?? signing.pdf?.url ?? null;
    } catch (error) {
      logger.error(
        `[WorkspaceDocumentPacket] Unable to resolve a signed packet download URL for encounter ${encounterId}; falling back to live merge.`,
        error,
      );
      return null;
    }

    if (!downloadUrl) {
      return null;
    }

    // Outside the fallback catch on purpose: a rejected link must stay visible.
    const outbound = await resolveSignedPacketRequest(downloadUrl);

    try {
      const response = await axios.get<ArrayBuffer>(
        outbound.url,
        outbound.requestOptions,
      );
      // A response that is not a PDF is no more usable than an expired link, so
      // it degrades the same way: log it and let the caller re-merge.
      return readValidatedPdfResponse(response);
    } catch (error) {
      logger.error(
        `[WorkspaceDocumentPacket] Unable to fetch signed packet PDF for encounter ${encounterId}; falling back to live merge.`,
        error,
      );
      return null;
    }
  },

  /**
   * Build the merged clinical packet PDF for an encounter for print/download
   * (SOAP + Prescription + Discharge, etc.). Once the packet is signed this
   * returns the signed Documenso copy; otherwise it returns a freshly combined
   * (unsigned) merge. Unlike sign(), the unsigned path does not create a packet
   * record or involve Documenso — it just returns the combined bytes.
   */
  async buildEncounterPacketPdf(
    organisationId: string,
    encounterId: string,
  ): Promise<Buffer> {
    const signedPdf =
      await WorkspaceDocumentPacketService.fetchSignedEncounterPacketPdf(
        organisationId,
        encounterId,
      );
    if (signedPdf) {
      return signedPdf;
    }

    const bootstrap = await WorkspaceService.getEncounterBootstrap(
      { organisationId, encounterId },
      undefined,
      { systemAccess: true },
    );

    const documents = orderDocumentsForMerge(
      selectMergeableDocuments(
        bootstrap.documents.filter((doc) => Boolean(doc.documentId)),
        "building the encounter packet PDF",
      ),
    );
    if (!documents.length) {
      throw new WorkspaceServiceError(
        "Encounter has no rendered documents to print",
        409,
      );
    }

    await ensureClinicalArtifactsRendered(organisationId, documents);

    let merged;
    if (isAllClinicalArtifacts(documents)) {
      logger.info(
        `[WorkspaceDocumentPacket] Building encounter ${encounterId} packet PDF as a combined clinical PDF (${documents.length} clinical artifact(s)).`,
      );
      merged = await renderCombinedClinicalPacketPdf({
        organisationId,
        documents: documents.map((doc) => ({
          documentId: doc.documentId,
          sourceId: doc.sourceId,
          kind: doc.kind,
          title: doc.title,
        })),
      });
    } else {
      logger.info(
        `[WorkspaceDocumentPacket] Building encounter ${encounterId} packet PDF via PDF merge (mixed/non-clinical packet, ${documents.length} document(s)).`,
      );
      merged = await buildMergedClinicalPacketPdf({
        organisationId,
        title: `Clinical Packet ${encounterId}`,
        documents: documents.map((doc) => ({
          documentId: doc.documentId,
          title: doc.title,
          kind: doc.kind,
        })),
      });
    }

    return merged.pdf;
  },

  async buildEncounterPacketPdfForParent(
    parentId: string,
    encounterId: string,
  ): Promise<Buffer> {
    const normalizedParentId = ensureRequiredId(parentId, "parentId");
    const normalizedEncounterId = ensureRequiredId(encounterId, "encounterId");

    const encounter = await prisma.encounter.findFirst({
      where: {
        id: normalizedEncounterId,
        parentId: normalizedParentId,
      },
      select: {
        organisationId: true,
      },
    });

    if (!encounter) {
      throw new WorkspaceServiceError("Encounter not found", 404);
    }

    return WorkspaceDocumentPacketService.buildEncounterPacketPdf(
      encounter.organisationId,
      normalizedEncounterId,
    );
  },
};
