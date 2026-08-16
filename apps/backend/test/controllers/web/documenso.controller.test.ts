import {
  beforeAll,
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import crypto from "crypto";
import type { Request, Response } from "express";
import { DocumensoWebhookController } from "../../../src/controllers/web/documenso.controller";
import { prisma } from "../../../src/config/prisma";
import { FormAssignmentService } from "../../../src/services/form-assignment.service";
import { DocumensoService } from "../../../src/services/documenso.service";
import { WorkspaceDocumentPacketService } from "../../../src/services/workspace-document-packet.service";
import { notifyOwnerOfPassportUpdate } from "../../../src/services/pet-clinical-records.service";
import logger from "../../../src/utils/logger";

jest.mock("../../../src/utils/logger");
jest.mock("../../../src/services/form-assignment.service", () => ({
  FormAssignmentService: {
    markSignedFromSubmission: jest.fn(),
  },
}));
jest.mock("../../../src/services/documenso.service", () => ({
  DocumensoService: {
    resolveOrganisationApiKey: jest.fn(),
    downloadSignedDocument: jest.fn(),
  },
}));
jest.mock("../../../src/services/workspace-document-packet.service", () => ({
  WorkspaceDocumentPacketService: {
    completeSigning: jest.fn(),
    resetSigning: jest.fn(),
  },
}));
jest.mock("../../../src/config/prisma", () => ({
  prisma: {
    formSubmission: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    form: {
      findUnique: jest.fn(),
    },
    renderedDocument: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    workspaceDocumentPacket: {
      findFirst: jest.fn(),
    },
    clinicalArtifactAttestation: {
      findFirst: jest.fn(),
    },
    clinicalArtifact: {
      update: jest.fn(),
    },
    encounter: {
      findUnique: jest.fn(),
    },
  },
}));
jest.mock("../../../src/services/pet-clinical-records.service", () => ({
  notifyOwnerOfPassportUpdate: jest.fn(),
}));

const mockedLogger = jest.mocked(logger);

describe("DocumensoWebhookController", () => {
  const originalSecret = process.env.DOCUMENSO_WEBHOOK_SECRET;

  let req: Partial<Request>;
  let res: Partial<Response>;
  let statusMock: jest.Mock;
  let jsonMock: jest.Mock;
  let endMock: jest.Mock;

  beforeAll(() => {
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.DOCUMENSO_WEBHOOK_SECRET;
      return;
    }

    process.env.DOCUMENSO_WEBHOOK_SECRET = originalSecret;
  });

  beforeEach(() => {
    jsonMock = jest.fn();
    endMock = jest.fn();
    statusMock = jest.fn().mockReturnValue({ json: jsonMock, end: endMock });

    req = {
      body: Buffer.from(
        JSON.stringify({
          event: undefined,
          payload: { id: 'doc-123"}\n{"level":"error"' },
        }),
      ),
      headers: {},
    };

    res = {
      status: statusMock,
      json: jsonMock,
      end: endMock,
    } as unknown as Response;

    jest.clearAllMocks();
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
  });

  it("logs a static message for invalid payloads without including request data", async () => {
    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "[DocumensoWebhook] Invalid payload",
    );
    expect(mockedLogger.error).not.toHaveBeenCalledWith(
      expect.any(String),
      expect.anything(),
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid payload" });
  });

  it("rejects payloads that carry an event but no document id", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: {},
        }),
      ),
    };

    const mockedPrisma = prisma as any;

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.formSubmission.findFirst).not.toHaveBeenCalled();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      "[DocumensoWebhook] Invalid payload",
    );
    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Invalid payload" });
  });

  /**
   * A passport attestation is only honoured from a cryptographically verified
   * callback, so these tests must configure the secret and sign the body the
   * same way Documenso does (HMAC-SHA256 hex over the raw payload).
   */
  const PASSPORT_SECRET = "passport-webhook-secret";
  const signedPassportRequest = (body: Record<string, unknown>) => {
    process.env.DOCUMENSO_WEBHOOK_SECRET = PASSPORT_SECRET;
    const raw = Buffer.from(JSON.stringify(body));
    const signature = crypto
      .createHmac("sha256", PASSPORT_SECRET)
      .update(raw)
      .digest("hex");
    return {
      ...req,
      body: raw,
      headers: { "x-documenso-signature": signature },
    };
  };

  it("completes a passport clinical record when its document signs", async () => {
    req = signedPassportRequest({
      event: "DOCUMENT_COMPLETED",
      payload: { id: "doc-pass-1" },
    });
    const mockedPrisma = prisma as any;
    mockedPrisma.clinicalArtifactAttestation.findFirst.mockResolvedValueOnce({
      id: "att-1",
      artifactId: "art-1",
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      encounterId: "enc-1",
    });
    mockedPrisma.encounter.findUnique.mockResolvedValueOnce({
      patientId: "pat-1",
    });

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.clinicalArtifact.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "art-1" },
        data: expect.objectContaining({ status: "SIGNED" }),
      }),
    );
    expect(notifyOwnerOfPassportUpdate).toHaveBeenCalledWith("pat-1");
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(mockedPrisma.formSubmission.findFirst).not.toHaveBeenCalled();
  });

  it("never resurrects a record revoked while its signature was outstanding", async () => {
    req = signedPassportRequest({
      event: "DOCUMENT_COMPLETED",
      payload: { id: "doc-pass-revoked" },
    });
    const mockedPrisma = prisma as any;
    // The revoked/superseded/VOID filter is applied in the query itself, so a
    // revoked record simply does not match and nothing is updated.
    mockedPrisma.clinicalArtifactAttestation.findFirst.mockResolvedValueOnce(
      null,
    );

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(
      mockedPrisma.clinicalArtifactAttestation.findFirst,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          documensoDocumentId: "doc-pass-revoked",
          revokedAt: null,
          supersededById: null,
          artifact: { status: { not: "VOID" } },
        }),
      }),
    );
    expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
    expect(notifyOwnerOfPassportUpdate).not.toHaveBeenCalled();
  });

  it("refuses to attest a passport record when the webhook is unverified", async () => {
    // No DOCUMENSO_WEBHOOK_SECRET: the document id is the only credential, and
    // it is an external identifier, so it must not create a clinical signature.
    delete process.env.DOCUMENSO_WEBHOOK_SECRET;
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-pass-forged" },
        }),
      ),
      headers: {},
    };
    const mockedPrisma = prisma as any;

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(
      mockedPrisma.clinicalArtifactAttestation.findFirst,
    ).not.toHaveBeenCalled();
    expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      expect.stringContaining("webhook signature not verified"),
    );
  });

  it("rejects a passport completion carrying a bad signature", async () => {
    process.env.DOCUMENSO_WEBHOOK_SECRET = PASSPORT_SECRET;
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-pass-1" },
        }),
      ),
      // Deliberately the wrong length, which used to throw inside
      // timingSafeEqual and surface as a 500 rather than a 401.
      headers: { "x-documenso-signature": "deadbeef" },
    };

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(statusMock).toHaveBeenCalledWith(401);
  });

  it("completes a passport record with no encounter without notifying", async () => {
    req = signedPassportRequest({
      event: "DOCUMENT_COMPLETED",
      payload: { id: "doc-pass-2" },
    });
    const mockedPrisma = prisma as any;
    mockedPrisma.clinicalArtifactAttestation.findFirst.mockResolvedValueOnce({
      id: "att-2",
      artifactId: "art-2",
    });
    mockedPrisma.clinicalArtifact.update.mockResolvedValueOnce({
      encounterId: null,
    });

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.encounter.findUnique).not.toHaveBeenCalled();
    expect(notifyOwnerOfPassportUpdate).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("ignores non-completion events for passport records", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_DELETED",
          payload: { id: "doc-x" },
        }),
      ),
    };
    const mockedPrisma = prisma as any;

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.clinicalArtifact.update).not.toHaveBeenCalled();
  });

  it("syncs signed form assignments when a document completes", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-123" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;

    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-1",
      formId: "form-1",
      formVersion: 2,
      appointmentId: "appt-1",
      patientId: "comp-1",
      parentId: "parent-1",
      signing: {
        status: "IN_PROGRESS",
        documentId: "doc-123",
      },
    });
    mockedPrisma.formSubmission.update.mockResolvedValue(undefined);
    mockedPrisma.form.findUnique.mockResolvedValue({
      orgId: "org-1",
      name: "Intake",
    });

    const mockedDocumensoService = DocumensoService as unknown as {
      resolveOrganisationApiKey: jest.Mock;
      downloadSignedDocument: jest.Mock;
    };
    (mockedDocumensoService.resolveOrganisationApiKey as any).mockResolvedValue(
      "documenso-key",
    );
    (mockedDocumensoService.downloadSignedDocument as any).mockResolvedValue({
      downloadUrl: "https://files.example/signed.pdf",
    });

    const mockedAssignmentService = FormAssignmentService as unknown as {
      markSignedFromSubmission: jest.Mock;
    };
    (
      mockedAssignmentService.markSignedFromSubmission as any
    ).mockResolvedValueOnce(null);

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(
      mockedAssignmentService.markSignedFromSubmission,
    ).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        templateId: "form-1",
        templateVersion: 2,
        appointmentId: "appt-1",
        companionId: "comp-1",
        parentId: "parent-1",
      }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("completes packet signing when a packet document completes (no submission)", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "packet-doc-1" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue(null);
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue({
      id: "packet-1",
    });

    const mockedPacketService = WorkspaceDocumentPacketService as unknown as {
      completeSigning: jest.Mock;
      resetSigning: jest.Mock;
    };

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.workspaceDocumentPacket.findFirst).toHaveBeenCalled();
    expect(mockedPacketService.completeSigning).toHaveBeenCalledWith(
      "packet-1",
    );
    expect(mockedPacketService.resetSigning).not.toHaveBeenCalled();
    expect(mockedPrisma.renderedDocument.findFirst).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ received: true });
  });

  it("resets packet signing when a packet document is deleted (no submission)", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_DELETED",
          payload: { id: "packet-doc-2" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue(null);
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue({
      id: "packet-2",
    });

    const mockedPacketService = WorkspaceDocumentPacketService as unknown as {
      completeSigning: jest.Mock;
      resetSigning: jest.Mock;
    };

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPacketService.resetSigning).toHaveBeenCalledWith("packet-2");
    expect(mockedPacketService.completeSigning).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("does not touch packet service when neither submission nor packet match", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "unknown-doc" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue(null);
    mockedPrisma.workspaceDocumentPacket.findFirst.mockResolvedValue(null);

    const mockedPacketService = WorkspaceDocumentPacketService as unknown as {
      completeSigning: jest.Mock;
      resetSigning: jest.Mock;
    };

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPacketService.completeSigning).not.toHaveBeenCalled();
    expect(mockedPacketService.resetSigning).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ received: true });
  });

  it("returns 500 when a webhook lookup throws", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "boom-doc" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockRejectedValue(
      new Error("db down"),
    );

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedLogger.error).toHaveBeenCalledWith(
      "[DocumensoWebhook] Error",
      expect.any(Error),
    );
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Webhook failed" });
  });

  it("returns 500 when the form is missing for a completed document", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-nf" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-nf",
      formId: "form-nf",
      formVersion: 1,
      appointmentId: null,
      patientId: null,
      parentId: null,
      signing: { status: "NOT_STARTED", documentId: "doc-nf" },
    });
    mockedPrisma.form.findUnique.mockResolvedValue(null);

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.form.findUnique).toHaveBeenCalledWith({
      where: { id: "form-nf" },
      select: { orgId: true },
    });
    expect(mockedPrisma.formSubmission.update).not.toHaveBeenCalled();
    expect(mockedLogger.error).toHaveBeenCalledWith(
      "[DocumensoWebhook] Error",
      expect.any(Error),
    );
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Webhook failed" });
  });

  it("returns 500 when the organisation has no Documenso API key", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-nokey" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-nokey",
      formId: "form-nokey",
      formVersion: 1,
      appointmentId: null,
      patientId: null,
      parentId: null,
      signing: { status: "NOT_STARTED", documentId: "doc-nokey" },
    });
    mockedPrisma.form.findUnique.mockResolvedValue({ orgId: "org-nokey" });

    const mockedDocumensoService = DocumensoService as unknown as {
      resolveOrganisationApiKey: jest.Mock;
      downloadSignedDocument: jest.Mock;
    };
    (mockedDocumensoService.resolveOrganisationApiKey as any).mockResolvedValue(
      null,
    );

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(
      mockedDocumensoService.downloadSignedDocument,
    ).not.toHaveBeenCalled();
    expect(mockedPrisma.formSubmission.update).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Webhook failed" });
  });

  it("returns 500 when the signing payload has no document id", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-noid" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-noid",
      formId: "form-noid",
      formVersion: 1,
      appointmentId: null,
      patientId: null,
      parentId: null,
      signing: { status: "NOT_STARTED" },
    });
    mockedPrisma.form.findUnique.mockResolvedValue({ orgId: "org-noid" });

    const mockedDocumensoService = DocumensoService as unknown as {
      resolveOrganisationApiKey: jest.Mock;
      downloadSignedDocument: jest.Mock;
    };
    (mockedDocumensoService.resolveOrganisationApiKey as any).mockResolvedValue(
      "some-key",
    );

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(
      mockedDocumensoService.downloadSignedDocument,
    ).not.toHaveBeenCalled();
    expect(mockedPrisma.formSubmission.update).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({ message: "Webhook failed" });
  });

  it("still returns 200 when form assignment sync fails after completion", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-sync" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-sync",
      formId: "form-sync",
      formVersion: 3,
      appointmentId: "appt-9",
      patientId: "comp-9",
      parentId: "parent-9",
      signing: { status: "NOT_STARTED", documentId: "555" },
    });
    mockedPrisma.formSubmission.update.mockResolvedValue(undefined);
    mockedPrisma.form.findUnique.mockResolvedValue({ orgId: "org-sync" });

    const mockedDocumensoService = DocumensoService as unknown as {
      resolveOrganisationApiKey: jest.Mock;
      downloadSignedDocument: jest.Mock;
    };
    (mockedDocumensoService.resolveOrganisationApiKey as any).mockResolvedValue(
      "sync-key",
    );
    (mockedDocumensoService.downloadSignedDocument as any).mockResolvedValue({
      downloadUrl: "https://files.example/synced.pdf",
    });

    const mockedAssignmentService = FormAssignmentService as unknown as {
      markSignedFromSubmission: jest.Mock;
    };
    (mockedAssignmentService.markSignedFromSubmission as any).mockRejectedValue(
      new Error("assignment sync failed"),
    );

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.formSubmission.update).toHaveBeenCalled();
    expect(mockedLogger.warn).toHaveBeenCalledWith(
      "[DocumensoWebhook] Failed to sync form assignment signed status",
      expect.objectContaining({ submissionId: "submission-sync" }),
    );
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("marks the submission signed without a pdf when download returns nothing", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-nopdf" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-nopdf",
      formId: "form-nopdf",
      formVersion: 1,
      appointmentId: null,
      patientId: null,
      parentId: null,
      signing: { status: "NOT_STARTED", documentId: "777" },
    });
    mockedPrisma.formSubmission.update.mockResolvedValue(undefined);
    mockedPrisma.form.findUnique.mockResolvedValue({ orgId: "org-nopdf" });

    const mockedDocumensoService = DocumensoService as unknown as {
      resolveOrganisationApiKey: jest.Mock;
      downloadSignedDocument: jest.Mock;
    };
    (mockedDocumensoService.resolveOrganisationApiKey as any).mockResolvedValue(
      "nopdf-key",
    );
    (mockedDocumensoService.downloadSignedDocument as any).mockResolvedValue(
      null,
    );

    const mockedAssignmentService = FormAssignmentService as unknown as {
      markSignedFromSubmission: jest.Mock;
    };
    (mockedAssignmentService.markSignedFromSubmission as any).mockResolvedValue(
      undefined,
    );

    await DocumensoWebhookController.handle(req as Request, res as Response);

    const updateArg = mockedPrisma.formSubmission.update.mock.calls[0][0];
    expect(updateArg.where).toEqual({ id: "submission-nopdf" });
    expect(updateArg.data.signing.status).toBe("SIGNED");
    expect(updateArg.data.signing.pdf).toBeUndefined();
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("skips completion work when the submission is already signed", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-signed" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-signed",
      formId: "form-signed",
      formVersion: 1,
      appointmentId: null,
      patientId: null,
      parentId: null,
      signing: { status: "SIGNED", documentId: "doc-signed" },
    });

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.form.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.formSubmission.update).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
    expect(jsonMock).toHaveBeenCalledWith({ received: true });
  });

  it("skips completion work when the submission has no signing payload", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_COMPLETED",
          payload: { id: "doc-nosign" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-nosign",
      formId: "form-nosign",
      formVersion: 1,
      appointmentId: null,
      patientId: null,
      parentId: null,
      signing: null,
    });

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.form.findUnique).not.toHaveBeenCalled();
    expect(mockedPrisma.formSubmission.update).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("skips reset when a deleted submission is already signed", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_DELETED",
          payload: { id: "doc-delsigned" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-delsigned",
      formId: "form-delsigned",
      signing: { status: "SIGNED", documentId: "888" },
    });

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.formSubmission.update).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
  });

  it("skips reset when a deleted submission has no signing payload", async () => {
    req = {
      ...req,
      body: Buffer.from(
        JSON.stringify({
          event: "DOCUMENT_DELETED",
          payload: { id: "doc-delnosign" },
        }),
      ),
    };

    const mockedPrisma = prisma as any;
    mockedPrisma.formSubmission.findFirst.mockResolvedValue({
      id: "submission-delnosign",
      formId: "form-delnosign",
      signing: null,
    });

    await DocumensoWebhookController.handle(req as Request, res as Response);

    expect(mockedPrisma.formSubmission.update).not.toHaveBeenCalled();
    expect(statusMock).toHaveBeenCalledWith(200);
  });
});
