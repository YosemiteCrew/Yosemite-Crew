import { Request, Response } from "express";
import { FormAssignmentController } from "../../src/controllers/web/form-assignment.controller";
import { FormAssignmentService } from "src/services/form-assignment.service";
import logger from "src/utils/logger";

jest.mock("src/services/form-assignment.service", () => ({
  FormAssignmentService: {
    createForAppointment: jest.fn(),
    listForAppointment: jest.fn(),
    listForCompanion: jest.fn(),
    resend: jest.fn(),
    cancel: jest.fn(),
  },
  FormAssignmentServiceError: class FormAssignmentServiceError extends Error {
    constructor(
      message: string,
      public readonly statusCode = 400,
    ) {
      super(message);
    }
  },
  createFormAssignmentSchema: {
    omit: () => ({
      extend: () => ({
        parse: (value: unknown) => value,
      }),
    }),
  },
  formAssignmentSignerIdentitySchema: {
    optional: () => undefined,
  },
}));

jest.mock("src/utils/logger", () => ({
  __esModule: true,
  default: {
    error: jest.fn(),
  },
}));

describe("FormAssignmentController", () => {
  let req: Partial<Request> & { userId?: string };
  let res: Partial<Response>;
  let json: jest.Mock;
  let status: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    req = { params: {}, body: {}, userId: "user-1" };
    res = { status, json };
  });

  it("creates an appointment assignment", async () => {
    req.params = {
      organisationId: "org-1",
      appointmentId: "appt-1",
    };
    req.body = {
      templateId: "template-1",
      signerIdentity: { name: "Alex" },
    };
    (FormAssignmentService.createForAppointment as jest.Mock).mockResolvedValue(
      {
        id: "assignment-1",
      },
    );

    await FormAssignmentController.createForAppointment(
      req as Request,
      res as Response,
    );

    expect(FormAssignmentService.createForAppointment).toHaveBeenCalledWith(
      expect.objectContaining({
        organisationId: "org-1",
        appointmentId: "appt-1",
        templateId: "template-1",
        createdBy: "user-1",
      }),
    );
    expect(status).toHaveBeenCalledWith(201);
  });

  it("lists appointment assignments", async () => {
    req.params = {
      organisationId: "org-1",
      appointmentId: "appt-1",
    };
    (FormAssignmentService.listForAppointment as jest.Mock).mockResolvedValue([
      { id: "assignment-1" },
    ]);

    await FormAssignmentController.listForAppointment(
      req as Request,
      res as Response,
    );

    expect(FormAssignmentService.listForAppointment).toHaveBeenCalledWith(
      "org-1",
      "appt-1",
    );
    expect(status).toHaveBeenCalledWith(200);
  });

  it("lists companion assignments", async () => {
    req.params = {
      organisationId: "org-1",
      companionId: "comp-1",
    };
    (FormAssignmentService.listForCompanion as jest.Mock).mockResolvedValue([
      { id: "assignment-1" },
    ]);

    await FormAssignmentController.listForCompanion(
      req as Request,
      res as Response,
    );

    expect(FormAssignmentService.listForCompanion).toHaveBeenCalledWith(
      "org-1",
      "comp-1",
    );
    expect(status).toHaveBeenCalledWith(200);
  });

  it("resends an assignment", async () => {
    req.params = {
      organisationId: "org-1",
      assignmentId: "assignment-1",
    };
    (FormAssignmentService.resend as jest.Mock).mockResolvedValue({
      id: "assignment-1",
    });

    await FormAssignmentController.resend(req as Request, res as Response);

    expect(FormAssignmentService.resend).toHaveBeenCalledWith(
      "assignment-1",
      "org-1",
      "user-1",
    );
    expect(status).toHaveBeenCalledWith(200);
  });

  it("returns a validation error for invalid params", async () => {
    req.params = { organisationId: "org-1" } as never;

    await FormAssignmentController.listForAppointment(
      req as Request,
      res as Response,
    );

    expect(status).toHaveBeenCalledWith(400);
    expect(logger.error).not.toHaveBeenCalled();
  });
});
