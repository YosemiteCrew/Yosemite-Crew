import { Request, Response } from "express";
import { WorkspaceController } from "../../src/controllers/web/workspace.controller";
import {
  WorkspaceService,
  WorkspaceServiceError,
} from "src/services/workspace.prisma.service";
import { AuthUserMobileService } from "src/services/authUserMobile.service";
import { WorkspaceDocumentPacketService } from "src/services/workspace-document-packet.service";
import logger from "src/utils/logger";

jest.mock("src/services/workspace.prisma.service", () => ({
  WorkspaceService: {
    getAppointmentBootstrap: jest.fn(),
    getEncounterBootstrap: jest.fn(),
    getEncounterFinalizationGate: jest.fn(),
    getAppointmentDocuments: jest.fn(),
    getEncounterDocuments: jest.fn(),
    getCompanionDocuments: jest.fn(),
    getCompanionMedicalRecords: jest.fn(),
    getEncounterTreatmentItems: jest.fn(),
    createEncounterTreatmentItem: jest.fn(),
    updateTreatmentItem: jest.fn(),
    deleteTreatmentItem: jest.fn(),
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

jest.mock("src/services/workspace-document-packet.service", () => ({
  WorkspaceDocumentPacketService: {
    createForEncounter: jest.fn(),
    getById: jest.fn(),
    sign: jest.fn(),
    reconcile: jest.fn(),
    buildEncounterPacketPdf: jest.fn(),
    buildEncounterPacketPdfForParent: jest.fn(),
  },
}));

jest.mock("src/services/authUserMobile.service", () => ({
  AuthUserMobileService: {
    getByProviderUserId: jest.fn(),
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe("WorkspaceController", () => {
  let req: Partial<Request> & {
    userPermissions?: string[];
    userId?: string;
    body?: unknown;
  };
  let res: Partial<Response>;
  let json: jest.Mock;
  let send: jest.Mock;
  let status: jest.Mock;
  let setHeader: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    json = jest.fn();
    send = jest.fn();
    status = jest.fn().mockReturnValue({ json, send });
    setHeader = jest.fn();
    req = { params: {}, userPermissions: [] };
    res = { status, json, send, setHeader };
  });

  it("returns the appointment bootstrap payload", async () => {
    req.params = {
      organisationId: "org-1",
      appointmentId: "appt-1",
    };
    (WorkspaceService.getAppointmentBootstrap as jest.Mock).mockResolvedValue({
      organisationId: "org-1",
      appointment: null,
    });

    await WorkspaceController.getAppointmentBootstrap(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getAppointmentBootstrap).toHaveBeenCalledWith(
      {
        organisationId: "org-1",
        appointmentId: "appt-1",
      },
      [],
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      organisationId: "org-1",
      appointment: null,
    });
  });

  it("returns a validation error for missing params", async () => {
    req.params = { organisationId: "org-1" } as never;

    await WorkspaceController.getAppointmentBootstrap(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      message: "Invalid workspace request.",
      issues: expect.any(Array),
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("returns the encounter bootstrap payload", async () => {
    req.params = {
      organisationId: "org-2",
      encounterId: "enc-1",
    };
    (WorkspaceService.getEncounterBootstrap as jest.Mock).mockResolvedValue({
      organisationId: "org-2",
      encounter: { id: "enc-1" },
    });

    await WorkspaceController.getEncounterBootstrap(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getEncounterBootstrap).toHaveBeenCalledWith(
      {
        organisationId: "org-2",
        encounterId: "enc-1",
      },
      [],
    );
    expect(status).toHaveBeenCalledWith(200);
  });

  it("returns the encounter finalization gate payload", async () => {
    req.params = {
      organisationId: "org-2",
      encounterId: "enc-1",
    };
    (
      WorkspaceService.getEncounterFinalizationGate as jest.Mock
    ).mockResolvedValue({
      enabled: false,
      disabledReason: "Required forms are still pending.",
    });

    await WorkspaceController.getEncounterFinalizationGate(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getEncounterFinalizationGate).toHaveBeenCalledWith(
      {
        organisationId: "org-2",
        encounterId: "enc-1",
      },
      [],
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      enabled: false,
      disabledReason: "Required forms are still pending.",
    });
  });

  it("returns appointment documents", async () => {
    req.params = {
      organisationId: "org-1",
      appointmentId: "appt-2",
    };
    (WorkspaceService.getAppointmentDocuments as jest.Mock).mockResolvedValue([
      { documentId: "doc-1" },
    ]);

    await WorkspaceController.getAppointmentDocuments(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getAppointmentDocuments).toHaveBeenCalledWith(
      {
        organisationId: "org-1",
        appointmentId: "appt-2",
      },
      [],
    );
    expect(json).toHaveBeenCalledWith([{ documentId: "doc-1" }]);
  });

  it("creates a document packet", async () => {
    req.params = {
      organisationId: "org-3",
      encounterId: "enc-3",
    };
    (
      WorkspaceDocumentPacketService.createForEncounter as jest.Mock
    ).mockResolvedValue({ packetId: "packet-1" });

    await WorkspaceController.createDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(
      WorkspaceDocumentPacketService.createForEncounter,
    ).toHaveBeenCalledWith({
      organisationId: "org-3",
      encounterId: "enc-3",
    });
    expect(status).toHaveBeenCalledWith(201);
  });

  it("streams the mobile encounter document packet PDF for the linked parent", async () => {
    req.params = {
      encounterId: "enc-mobile",
    };
    req.userId = "provider-1";
    (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({
      parentId: "parent-1",
    });
    (
      WorkspaceDocumentPacketService.buildEncounterPacketPdfForParent as jest.Mock
    ).mockResolvedValue(Buffer.from("pdf"));

    await WorkspaceController.getMobileEncounterDocumentPacketPdf(
      req as Request,
      res as Response,
    );

    expect(AuthUserMobileService.getByProviderUserId).toHaveBeenCalledWith(
      "provider-1",
    );
    expect(
      WorkspaceDocumentPacketService.buildEncounterPacketPdfForParent,
    ).toHaveBeenCalledWith("parent-1", "enc-mobile");
    expect(setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'inline; filename="clinical-packet-enc-mobile.pdf"',
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith(Buffer.from("pdf"));
  });

  it("rejects the mobile encounter packet PDF without an authenticated user", async () => {
    req.params = {
      encounterId: "enc-mobile",
    };

    await WorkspaceController.getMobileEncounterDocumentPacketPdf(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(
      WorkspaceDocumentPacketService.buildEncounterPacketPdfForParent,
    ).not.toHaveBeenCalled();
  });

  it("rejects the mobile encounter packet PDF when the user has no parent profile", async () => {
    req.params = {
      encounterId: "enc-mobile",
    };
    req.userId = "provider-1";
    (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({
      parentId: null,
    });

    await WorkspaceController.getMobileEncounterDocumentPacketPdf(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(
      WorkspaceDocumentPacketService.buildEncounterPacketPdfForParent,
    ).not.toHaveBeenCalled();
  });

  it("signs a document packet when the request is authenticated", async () => {
    req.params = {
      organisationId: "org-4",
      packetId: "packet-2",
    };
    req.body = { signerName: "Dr. Jane" };
    req.userId = "user-1";
    (WorkspaceDocumentPacketService.sign as jest.Mock).mockResolvedValue({
      packetId: "packet-2",
      status: "FINAL",
    });

    await WorkspaceController.signDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(WorkspaceDocumentPacketService.sign).toHaveBeenCalledWith({
      organisationId: "org-4",
      packetId: "packet-2",
      signerId: "user-1",
      signerName: "Dr. Jane",
    });
    expect(status).toHaveBeenCalledWith(200);
  });

  it("rejects packet signing without an authenticated user", async () => {
    req.params = {
      organisationId: "org-4",
      packetId: "packet-2",
    };

    await WorkspaceController.signDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(401);
    expect(WorkspaceDocumentPacketService.sign).not.toHaveBeenCalled();
  });

  it("manages treatment items", async () => {
    req.params = {
      organisationId: "org-5",
      encounterId: "enc-5",
      itemId: "item-5",
    };
    (
      WorkspaceService.getEncounterTreatmentItems as jest.Mock
    ).mockResolvedValue([{ id: "item-5" }]);
    (
      WorkspaceService.createEncounterTreatmentItem as jest.Mock
    ).mockResolvedValue({ id: "item-6" });
    (WorkspaceService.updateTreatmentItem as jest.Mock).mockResolvedValue({
      id: "item-5",
    });
    (WorkspaceService.deleteTreatmentItem as jest.Mock).mockResolvedValue(
      undefined,
    );

    await WorkspaceController.getEncounterTreatmentItems(
      req as Request,
      res as Response,
    );
    await WorkspaceController.createEncounterTreatmentItem(
      {
        ...req,
        body: {
          productId: "prod-1",
          productSnapshot: { name: "Procedure" },
          servicePackageKind: "PROCEDURE",
          quantity: 1,
          priceSnapshot: { totalAmount: 10 },
        },
      } as Request,
      res as Response,
    );
    await WorkspaceController.updateTreatmentItem(
      {
        ...req,
        body: { quantity: 2 },
      } as Request,
      res as Response,
    );
    await WorkspaceController.deleteTreatmentItem(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getEncounterTreatmentItems).toHaveBeenCalledWith({
      organisationId: "org-5",
      encounterId: "enc-5",
    });
    expect(WorkspaceService.createEncounterTreatmentItem).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-5",
        encounterId: "enc-5",
        productId: "prod-1",
      }),
    );
    expect(WorkspaceService.updateTreatmentItem).toHaveBeenCalledWith(
      "item-5",
      "org-5",
      { quantity: 2 },
    );
    expect(WorkspaceService.deleteTreatmentItem).toHaveBeenCalledWith(
      "item-5",
      "org-5",
    );
    expect(status).toHaveBeenCalledWith(204);
  });

  it("forwards the service status code and message for a WorkspaceServiceError", async () => {
    req.params = { organisationId: "org-1", appointmentId: "appt-1" };
    (WorkspaceService.getAppointmentBootstrap as jest.Mock).mockRejectedValue(
      new WorkspaceServiceError("Appointment not found", 404),
    );

    await WorkspaceController.getAppointmentBootstrap(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Appointment not found" });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it("logs and returns a 500 for an unexpected service failure", async () => {
    req.params = { organisationId: "org-1", appointmentId: "appt-1" };
    const failure = new Error("prisma exploded");
    (WorkspaceService.getAppointmentBootstrap as jest.Mock).mockRejectedValue(
      failure,
    );

    await WorkspaceController.getAppointmentBootstrap(
      req as Request,
      res as Response,
    );

    expect(logger.error).toHaveBeenCalledWith(
      "Unexpected workspace bootstrap error",
      failure,
    );
    expect(status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({ message: "Internal Server Error" });
  });

  it("passes the caller's permissions through to the encounter bootstrap", async () => {
    req.params = { organisationId: "org-2", encounterId: "enc-1" };
    req.userPermissions = ["document:view:any", "labs:view:any"];
    (WorkspaceService.getEncounterBootstrap as jest.Mock).mockResolvedValue({
      organisationId: "org-2",
    });

    await WorkspaceController.getEncounterBootstrap(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getEncounterBootstrap).toHaveBeenCalledWith(
      { organisationId: "org-2", encounterId: "enc-1" },
      ["document:view:any", "labs:view:any"],
    );
  });

  it("defaults to an empty permission list when the request carries none", async () => {
    const bareReq = {
      params: { organisationId: "org-2", encounterId: "enc-1" },
    } as unknown as Request;
    (WorkspaceService.getEncounterBootstrap as jest.Mock).mockResolvedValue({
      organisationId: "org-2",
    });

    await WorkspaceController.getEncounterBootstrap(bareReq, res as Response);

    expect(WorkspaceService.getEncounterBootstrap).toHaveBeenCalledWith(
      { organisationId: "org-2", encounterId: "enc-1" },
      [],
    );
  });

  it("rejects the encounter bootstrap when the encounter id is missing", async () => {
    req.params = { organisationId: "org-2" } as never;

    await WorkspaceController.getEncounterBootstrap(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(WorkspaceService.getEncounterBootstrap).not.toHaveBeenCalled();
  });

  it("rejects the finalization gate when the organisation id is missing", async () => {
    req.params = { encounterId: "enc-1" } as never;

    await WorkspaceController.getEncounterFinalizationGate(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(
      WorkspaceService.getEncounterFinalizationGate,
    ).not.toHaveBeenCalled();
  });

  it("surfaces a service error raised while loading appointment documents", async () => {
    req.params = { organisationId: "org-1", appointmentId: "appt-2" };
    (WorkspaceService.getAppointmentDocuments as jest.Mock).mockRejectedValue(
      new WorkspaceServiceError("Appointment not found", 404),
    );

    await WorkspaceController.getAppointmentDocuments(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Appointment not found" });
  });

  it("returns encounter documents scoped to the caller's permissions", async () => {
    req.params = { organisationId: "org-1", encounterId: "enc-7" };
    req.userPermissions = ["document:view:any"];
    (WorkspaceService.getEncounterDocuments as jest.Mock).mockResolvedValue([
      { documentId: "doc-7" },
    ]);

    await WorkspaceController.getEncounterDocuments(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getEncounterDocuments).toHaveBeenCalledWith(
      { organisationId: "org-1", encounterId: "enc-7" },
      ["document:view:any"],
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith([{ documentId: "doc-7" }]);
  });

  it("surfaces a service error raised while loading encounter documents", async () => {
    req.params = { organisationId: "org-1", encounterId: "enc-7" };
    (WorkspaceService.getEncounterDocuments as jest.Mock).mockRejectedValue(
      new WorkspaceServiceError("Encounter not found", 404),
    );

    await WorkspaceController.getEncounterDocuments(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Encounter not found" });
  });

  it("returns companion documents", async () => {
    req.params = { organisationId: "org-1", companionId: "pet-1" };
    (WorkspaceService.getCompanionDocuments as jest.Mock).mockResolvedValue([
      { documentId: "doc-companion" },
    ]);

    await WorkspaceController.getCompanionDocuments(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getCompanionDocuments).toHaveBeenCalledWith({
      organisationId: "org-1",
      companionId: "pet-1",
    });
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith([{ documentId: "doc-companion" }]);
  });

  it("rejects companion documents for a companion outside the organisation", async () => {
    req.params = { organisationId: "org-1", companionId: "pet-other" };
    (WorkspaceService.getCompanionDocuments as jest.Mock).mockRejectedValue(
      new WorkspaceServiceError("Companion not found", 404),
    );

    await WorkspaceController.getCompanionDocuments(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Companion not found" });
  });

  it("returns companion medical records", async () => {
    req.params = { organisationId: "org-1", companionId: "pet-1" };
    (
      WorkspaceService.getCompanionMedicalRecords as jest.Mock
    ).mockResolvedValue([{ documentId: "rec-1", kind: "SOAP_NOTE" }]);

    await WorkspaceController.getCompanionMedicalRecords(
      req as Request,
      res as Response,
    );

    expect(WorkspaceService.getCompanionMedicalRecords).toHaveBeenCalledWith({
      organisationId: "org-1",
      companionId: "pet-1",
    });
    expect(json).toHaveBeenCalledWith([
      { documentId: "rec-1", kind: "SOAP_NOTE" },
    ]);
  });

  it("rejects companion medical records when the companion id is missing", async () => {
    req.params = { organisationId: "org-1" } as never;

    await WorkspaceController.getCompanionMedicalRecords(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    // The wording is zod's, and zod 4 rephrased it from "Required". The
    // contract this guards is the envelope - status, message, and one issue
    // naming the offending path - so the text is matched loosely rather than
    // re-pinned to a string the library owns and may reword again.
    expect(json).toHaveBeenCalledWith({
      message: "Invalid workspace request.",
      issues: [
        {
          path: "companionId",
          message: expect.stringMatching(/expected string/i),
        },
      ],
    });
    expect(WorkspaceService.getCompanionMedicalRecords).not.toHaveBeenCalled();
  });

  it("surfaces a service error raised while creating a document packet", async () => {
    req.params = { organisationId: "org-3", encounterId: "enc-3" };
    (
      WorkspaceDocumentPacketService.createForEncounter as jest.Mock
    ).mockRejectedValue(new WorkspaceServiceError("Encounter not found", 404));

    await WorkspaceController.createDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Encounter not found" });
  });

  it("streams the encounter document packet PDF as an inline attachment", async () => {
    req.params = { organisationId: "org-3", encounterId: "enc-pdf" };
    const pdf = Buffer.from("%PDF-1.7");
    (
      WorkspaceDocumentPacketService.buildEncounterPacketPdf as jest.Mock
    ).mockResolvedValue(pdf);

    await WorkspaceController.getEncounterDocumentPacketPdf(
      req as Request,
      res as Response,
    );

    expect(
      WorkspaceDocumentPacketService.buildEncounterPacketPdf,
    ).toHaveBeenCalledWith("org-3", "enc-pdf");
    expect(setHeader).toHaveBeenCalledWith("Content-Type", "application/pdf");
    expect(setHeader).toHaveBeenCalledWith(
      "Content-Disposition",
      'inline; filename="clinical-packet-enc-pdf.pdf"',
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(send).toHaveBeenCalledWith(pdf);
  });

  it("does not set PDF headers when the encounter packet cannot be built", async () => {
    req.params = { organisationId: "org-3", encounterId: "enc-pdf" };
    (
      WorkspaceDocumentPacketService.buildEncounterPacketPdf as jest.Mock
    ).mockRejectedValue(new WorkspaceServiceError("Packet not found", 404));

    await WorkspaceController.getEncounterDocumentPacketPdf(
      req as Request,
      res as Response,
    );

    expect(setHeader).not.toHaveBeenCalled();
    expect(send).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Packet not found" });
  });

  it("rejects the encounter packet PDF when the organisation id is missing", async () => {
    req.params = { encounterId: "enc-pdf" } as never;

    await WorkspaceController.getEncounterDocumentPacketPdf(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(
      WorkspaceDocumentPacketService.buildEncounterPacketPdf,
    ).not.toHaveBeenCalled();
  });

  it("does not set PDF headers when the parent packet build fails", async () => {
    req.params = { encounterId: "enc-mobile" };
    req.userId = "provider-1";
    (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue({
      parentId: "parent-1",
    });
    (
      WorkspaceDocumentPacketService.buildEncounterPacketPdfForParent as jest.Mock
    ).mockRejectedValue(new WorkspaceServiceError("Encounter not found", 403));

    await WorkspaceController.getMobileEncounterDocumentPacketPdf(
      req as Request,
      res as Response,
    );

    expect(setHeader).not.toHaveBeenCalled();
    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith({ message: "Encounter not found" });
  });

  it("rejects the mobile packet PDF when the auth user record is missing entirely", async () => {
    req.params = { encounterId: "enc-mobile" };
    req.userId = "provider-1";
    (AuthUserMobileService.getByProviderUserId as jest.Mock).mockResolvedValue(
      null,
    );

    await WorkspaceController.getMobileEncounterDocumentPacketPdf(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(403);
    expect(
      WorkspaceDocumentPacketService.buildEncounterPacketPdfForParent,
    ).not.toHaveBeenCalled();
  });

  it("returns a single document packet", async () => {
    req.params = { organisationId: "org-4", packetId: "packet-9" };
    (WorkspaceDocumentPacketService.getById as jest.Mock).mockResolvedValue({
      packetId: "packet-9",
      status: "DRAFT",
    });

    await WorkspaceController.getDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(WorkspaceDocumentPacketService.getById).toHaveBeenCalledWith(
      "org-4",
      "packet-9",
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      packetId: "packet-9",
      status: "DRAFT",
    });
  });

  it("returns 404 for a packet that belongs to another organisation", async () => {
    req.params = { organisationId: "org-4", packetId: "packet-other" };
    (WorkspaceDocumentPacketService.getById as jest.Mock).mockRejectedValue(
      new WorkspaceServiceError("Document packet not found", 404),
    );

    await WorkspaceController.getDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Document packet not found" });
  });

  it("rejects a packet read with a missing packet id", async () => {
    req.params = { organisationId: "org-4" } as never;

    await WorkspaceController.getDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(WorkspaceDocumentPacketService.getById).not.toHaveBeenCalled();
  });

  it("signs a packet without a signer name when the body is absent", async () => {
    req.params = { organisationId: "org-4", packetId: "packet-2" };
    req.userId = "user-1";
    req.body = undefined;
    (WorkspaceDocumentPacketService.sign as jest.Mock).mockResolvedValue({
      packetId: "packet-2",
    });

    await WorkspaceController.signDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(WorkspaceDocumentPacketService.sign).toHaveBeenCalledWith({
      organisationId: "org-4",
      packetId: "packet-2",
      signerId: "user-1",
      signerName: undefined,
    });
  });

  it("rejects packet signing with a blank signer name", async () => {
    req.params = { organisationId: "org-4", packetId: "packet-2" };
    req.userId = "user-1";
    req.body = { signerName: "   " };

    await WorkspaceController.signDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(WorkspaceDocumentPacketService.sign).not.toHaveBeenCalled();
  });

  it("reconciles a document packet", async () => {
    req.params = { organisationId: "org-4", packetId: "packet-2" };
    (WorkspaceDocumentPacketService.reconcile as jest.Mock).mockResolvedValue({
      packetId: "packet-2",
      reconciled: true,
    });

    await WorkspaceController.reconcileDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(WorkspaceDocumentPacketService.reconcile).toHaveBeenCalledWith(
      "org-4",
      "packet-2",
    );
    expect(status).toHaveBeenCalledWith(200);
    expect(json).toHaveBeenCalledWith({
      packetId: "packet-2",
      reconciled: true,
    });
  });

  it("surfaces a service error raised while reconciling a document packet", async () => {
    req.params = { organisationId: "org-4", packetId: "packet-2" };
    (WorkspaceDocumentPacketService.reconcile as jest.Mock).mockRejectedValue(
      new WorkspaceServiceError("Document packet not found", 404),
    );

    await WorkspaceController.reconcileDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Document packet not found" });
  });

  it("rejects reconciliation when the packet id is missing", async () => {
    req.params = { organisationId: "org-4" } as never;

    await WorkspaceController.reconcileDocumentPacket(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(WorkspaceDocumentPacketService.reconcile).not.toHaveBeenCalled();
  });

  it("surfaces a service error raised while listing treatment items", async () => {
    req.params = { organisationId: "org-5", encounterId: "enc-5" };
    (
      WorkspaceService.getEncounterTreatmentItems as jest.Mock
    ).mockRejectedValue(
      new WorkspaceServiceError("Encounter is required", 400),
    );

    await WorkspaceController.getEncounterTreatmentItems(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({ message: "Encounter is required" });
  });

  it("normalizes the optional treatment item fields on create", async () => {
    (
      WorkspaceService.createEncounterTreatmentItem as jest.Mock
    ).mockResolvedValue({ id: "item-9" });

    await WorkspaceController.createEncounterTreatmentItem(
      {
        params: { organisationId: "org-5", encounterId: "enc-5" },
        body: {
          appointmentId: "appt-5",
          productId: "prod-9",
          productVersion: 3,
          productSnapshot: { name: "Vaccine" },
          servicePackageKind: "PROCEDURE",
          quantity: 2,
          priceSnapshot: { grossAmount: 50 },
          billingStatus: "BILLED",
          invoiceRowId: "row-1",
          lockState: "LOCKED",
        },
      } as unknown as Request,
      res as Response,
    );

    expect(WorkspaceService.createEncounterTreatmentItem).toHaveBeenCalledWith({
      organisationId: "org-5",
      encounterId: "enc-5",
      appointmentId: "appt-5",
      productId: "prod-9",
      productVersion: 3,
      productSnapshot: { name: "Vaccine" },
      servicePackageKind: "PROCEDURE",
      quantity: 2,
      priceSnapshot: { grossAmount: 50 },
      billingStatus: "BILLED",
      invoiceRowId: "row-1",
      lockState: "LOCKED",
    });
    expect(status).toHaveBeenCalledWith(201);
  });

  it("rejects a treatment item create with a missing body", async () => {
    await WorkspaceController.createEncounterTreatmentItem(
      {
        params: { organisationId: "org-5", encounterId: "enc-5" },
      } as unknown as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith({
      message: "Invalid workspace request.",
      issues: expect.any(Array),
    });
    expect(
      WorkspaceService.createEncounterTreatmentItem,
    ).not.toHaveBeenCalled();
  });

  it("rejects a treatment item create with a non-positive quantity", async () => {
    await WorkspaceController.createEncounterTreatmentItem(
      {
        params: { organisationId: "org-5", encounterId: "enc-5" },
        body: {
          productId: "prod-9",
          productSnapshot: {},
          servicePackageKind: "PROCEDURE",
          quantity: 0,
          priceSnapshot: {},
        },
      } as unknown as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(
      WorkspaceService.createEncounterTreatmentItem,
    ).not.toHaveBeenCalled();
  });

  it("updates a treatment item with an empty patch when the body is absent", async () => {
    (WorkspaceService.updateTreatmentItem as jest.Mock).mockResolvedValue({
      id: "item-5",
    });

    await WorkspaceController.updateTreatmentItem(
      {
        params: { organisationId: "org-5", itemId: "item-5" },
      } as unknown as Request,
      res as Response,
    );

    expect(WorkspaceService.updateTreatmentItem).toHaveBeenCalledWith(
      "item-5",
      "org-5",
      {},
    );
    expect(status).toHaveBeenCalledWith(200);
  });

  it("surfaces a service error raised while updating a treatment item", async () => {
    req.params = { organisationId: "org-5", itemId: "item-5" };
    req.body = { quantity: 2 };
    (WorkspaceService.updateTreatmentItem as jest.Mock).mockRejectedValue(
      new WorkspaceServiceError("Treatment item not found", 404),
    );

    await WorkspaceController.updateTreatmentItem(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Treatment item not found" });
  });

  it("surfaces a service error raised while deleting a treatment item", async () => {
    req.params = { organisationId: "org-5", itemId: "item-5" };
    (WorkspaceService.deleteTreatmentItem as jest.Mock).mockRejectedValue(
      new WorkspaceServiceError("Treatment item not found", 404),
    );

    await WorkspaceController.deleteTreatmentItem(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(404);
    expect(json).toHaveBeenCalledWith({ message: "Treatment item not found" });
  });

  it("rejects a treatment item delete with a missing item id", async () => {
    req.params = { organisationId: "org-5" } as never;

    await WorkspaceController.deleteTreatmentItem(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(WorkspaceService.deleteTreatmentItem).not.toHaveBeenCalled();
  });
});
