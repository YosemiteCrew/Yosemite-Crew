import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

jest.mock("../../src/config/read-switch", () => ({
  isReadFromPostgres: jest.fn(),
}));

jest.mock("../../src/config/prisma", () => ({
  prisma: {
    userOrganization: {
      findFirst: jest.fn(),
      updateMany: jest.fn(),
    },
    appointment: {
      findUnique: jest.fn(),
    },
    invoice: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
    paymentAttempt: {
      findFirst: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
    },
    inventoryItem: {
      findUnique: jest.fn(),
    },
  },
}));

jest.mock("../../src/models/user-organization", () => ({
  __esModule: true,
  default: {
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn(),
  },
}));

jest.mock("../../src/models/appointment", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/invoice", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
}));

jest.mock("../../src/models/task", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

jest.mock("../../src/models/inventory", () => ({
  __esModule: true,
  InventoryItemModel: {
    findById: jest.fn(),
  },
}));

import { prisma } from "../../src/config/prisma";
import { isReadFromPostgres } from "../../src/config/read-switch";
import UserOrganizationModel from "../../src/models/user-organization";
import AppointmentModel from "../../src/models/appointment";
import InvoiceModel from "../../src/models/invoice";
import TaskModel from "../../src/models/task";
import { InventoryItemModel } from "../../src/models/inventory";
import {
  requirePermission,
  type OrgRequest,
  withAppointmentOrgPermissions,
  withInventoryItemOrgPermissions,
  withInvoiceOrgPermissions,
  withOrgPermissions,
  withPaymentIntentOrgPermissions,
  withTaskOrgPermissions,
} from "../../src/middlewares/rbac";

const mockRes = (): Response =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as unknown as Response;

const next = () => jest.fn() as unknown as NextFunction;

const leanResult = (value: unknown) => ({
  lean: jest.fn().mockResolvedValue(value as never),
});

describe("rbac middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (isReadFromPostgres as jest.Mock).mockReturnValue(true);
  });

  it("returns 400 when org context cannot be extracted", async () => {
    const req = {
      userId: "user_1",
      params: {},
      headers: {},
    } as unknown as Request;
    const res = mockRes();

    await withOrgPermissions()(req, res, next());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      message: "Missing userId or organisationId",
    });
  });

  it("loads permissions from postgres when effective permissions are current", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "map_1",
      roleCode: undefined,
      extraPermissions: ["tasks:view:any"],
      revokedPermissions: undefined,
      effectivePermissions: ["tasks:view:any"],
    } as never);

    const req = {
      userId: "user_1",
      params: { organisationId: "org_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withOrgPermissions()(req, mockRes(), middlewareNext);

    expect(prisma.userOrganization.findFirst).toHaveBeenCalled();
    expect((req as unknown as OrgRequest).userPermissions).toEqual([
      "tasks:view:any",
    ]);
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("recomputes and persists postgres permissions when stale", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "map_1",
      roleCode: "ADMIN",
      extraPermissions: ["tasks:edit:any"],
      revokedPermissions: ["tasks:view:own"],
      effectivePermissions: ["tasks:view:own"],
    } as never);

    const req = {
      userId: "user_1",
      params: { organisationId: "org_1" },
      headers: {},
    } as unknown as OrgRequest as Request;

    await withOrgPermissions()(req, mockRes(), next());

    expect(prisma.userOrganization.updateMany).toHaveBeenCalledWith({
      where: { id: "map_1" },
      data: {
        effectivePermissions: expect.arrayContaining(["tasks:edit:any"]),
      },
    });
  });

  it("uses mongo mapping when postgres reads are disabled", async () => {
    (isReadFromPostgres as jest.Mock).mockReturnValue(false);
    (UserOrganizationModel.findOne as jest.Mock).mockResolvedValue({
      _id: "mongo_1",
      roleCode: "TECHNICIAN",
      extraPermissions: ["tasks:view:any"],
      revokedPermissions: [],
      effectivePermissions: [],
    } as never);
    (UserOrganizationModel.findByIdAndUpdate as jest.Mock).mockResolvedValue({
      effectivePermissions: ["tasks:view:any"],
    } as never);

    const req = {
      userId: "user_1",
      params: { orgId: "org_1" },
      headers: {},
      body: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withOrgPermissions()(req, mockRes(), middlewareNext);

    expect(UserOrganizationModel.findOne).toHaveBeenCalledWith({
      practitionerReference: "user_1",
      $or: [
        { organizationReference: "org_1" },
        { organizationReference: "Organization/org_1" },
      ],
    });
    expect(UserOrganizationModel.findByIdAndUpdate).toHaveBeenCalled();
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("returns 403 when the user is not associated with the organisation", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      null as never,
    );
    const res = mockRes();

    await withOrgPermissions()(
      {
        userId: "user_1",
        params: { organisationId: "org_1" },
        headers: {},
      } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(403);
  });

  it("extracts organisation id from a single-org array payload", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "map_1",
      roleCode: undefined,
      extraPermissions: ["tasks:view:any"],
      revokedPermissions: [],
      effectivePermissions: ["tasks:view:any"],
    } as never);

    const req = {
      userId: "user_1",
      params: {},
      headers: {},
      body: [{ organisationId: "org_1" }, { organisationId: "org_1" }],
    } as unknown as OrgRequest as Request;

    await withOrgPermissions()(req, mockRes(), next());

    expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { organizationReference: "org_1" },
            { organizationReference: "Organization/org_1" },
          ],
        }),
      }),
    );
  });

  it("returns 404 from appointment lookup wrapper when appointment is missing", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue(
      null as never,
    );
    const res = mockRes();

    await withAppointmentOrgPermissions()(
      { params: { appointmentId: "apt_1" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment not found",
    });
  });

  it("hydrates organisationId through wrapper middlewares", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "map_1",
      roleCode: undefined,
      extraPermissions: ["tasks:view:any"],
      revokedPermissions: [],
      effectivePermissions: ["tasks:view:any"],
    } as never);
    (prisma.appointment.findUnique as jest.Mock).mockResolvedValue({
      organisationId: "org_apt",
    } as never);
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue({
      organisationId: "org_inv",
    } as never);
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValue({
      invoice: { organisationId: "org_pi" },
    } as never);
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      organisationId: "org_task",
    } as never);
    (prisma.inventoryItem.findUnique as jest.Mock).mockResolvedValue({
      organisationId: "org_item",
    } as never);

    const appointmentReq = {
      userId: "user_1",
      params: { appointmentId: "apt_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const invoiceReq = {
      userId: "user_1",
      params: { invoiceId: "inv_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const paymentReq = {
      userId: "user_1",
      params: { paymentIntentId: "pi_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const taskReq = {
      userId: "user_1",
      params: { taskId: "507f1f77bcf86cd799439012" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const itemReq = {
      userId: "user_1",
      params: { itemId: "item_1" },
      headers: {},
    } as unknown as OrgRequest as Request;

    await withAppointmentOrgPermissions()(appointmentReq, mockRes(), next());
    await withInvoiceOrgPermissions()(invoiceReq, mockRes(), next());
    await withPaymentIntentOrgPermissions()(paymentReq, mockRes(), next());
    await withTaskOrgPermissions()(taskReq, mockRes(), next());
    await withInventoryItemOrgPermissions()(itemReq, mockRes(), next());

    expect(appointmentReq.params.organisationId).toBe("org_apt");
    expect(invoiceReq.params.organisationId).toBe("org_inv");
    expect(paymentReq.params.organisationId).toBe("org_pi");
    expect(taskReq.params.organisationId).toBe("org_task");
    expect(itemReq.params.organisationId).toBe("org_item");
  });

  it("uses mongo lookups in resource wrappers when postgres reads are disabled", async () => {
    (isReadFromPostgres as jest.Mock).mockReturnValue(false);
    const mongoAppointmentId = "507f1f77bcf86cd799439011";
    (AppointmentModel.findById as jest.Mock).mockReturnValue(
      leanResult({ organisationId: "org_apt" }),
    );
    (InvoiceModel.findById as jest.Mock).mockReturnValue(
      leanResult({ organisationId: "org_inv" }),
    );
    (InvoiceModel.findOne as jest.Mock).mockReturnValue(
      leanResult({ organisationId: "org_pi" }),
    );
    (TaskModel.findById as jest.Mock).mockReturnValue(
      leanResult({ organisationId: "org_task" }),
    );
    (InventoryItemModel.findById as jest.Mock).mockReturnValue(
      leanResult({ organisationId: "org_item" }),
    );
    (UserOrganizationModel.findOne as jest.Mock).mockResolvedValue({
      _id: "map_1",
      roleCode: undefined,
      extraPermissions: ["tasks:view:any"],
      revokedPermissions: [],
      effectivePermissions: ["tasks:view:any"],
    } as never);

    await withAppointmentOrgPermissions()(
      {
        userId: "user_1",
        params: { appointmentId: mongoAppointmentId },
        headers: {},
      } as never,
      mockRes(),
      next(),
    );

    await withTaskOrgPermissions()(
      {
        userId: "user_1",
        params: { taskId: "507f1f77bcf86cd799439012" },
        headers: {},
      } as never,
      mockRes(),
      next(),
    );

    expect(AppointmentModel.findById).toHaveBeenCalledWith(mongoAppointmentId, {
      organisationId: 1,
    });
    expect(TaskModel.findById).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439012",
      {
        organisationId: 1,
      },
    );
  });

  it("returns 404 instead of hanging for UUID appointment ids in mongo mode", async () => {
    (isReadFromPostgres as jest.Mock).mockReturnValue(false);
    const res = mockRes();

    await withAppointmentOrgPermissions()(
      {
        userId: "user_1",
        params: { appointmentId: "bb264871-8d18-420e-bbc0-fd926db9e7ad" },
        headers: {},
      } as never,
      res,
      next(),
    );

    expect(AppointmentModel.findById).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Appointment not found",
    });
  });
});

describe("rbac requirePermission", () => {
  it("returns 500 if permissions not loaded", () => {
    const middleware = requirePermission("tasks:view:any");
    const req = {} as Request;
    const res = mockRes();

    middleware(req, res, next());

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it("allows a single permission match", () => {
    const middleware = requirePermission("tasks:view:any");
    const req = {
      userPermissions: ["tasks:view:any"],
    } as unknown as OrgRequest;
    const middlewareNext = next();

    middleware(req as unknown as Request, mockRes(), middlewareNext);

    expect(middlewareNext).toHaveBeenCalled();
  });

  it("treats arrays as any-of and rejects missing permissions", () => {
    const allowMiddleware = requirePermission([
      "tasks:edit:any",
      "tasks:edit:own",
    ]);
    const denyMiddleware = requirePermission([
      "tasks:edit:any",
      "tasks:edit:own",
    ]);

    const allowNext = next();
    allowMiddleware(
      {
        userPermissions: ["tasks:edit:own"],
      } as never,
      mockRes(),
      allowNext,
    );

    const denyRes = mockRes();
    denyMiddleware(
      {
        userPermissions: ["tasks:view:any"],
      } as never,
      denyRes,
      next(),
    );

    expect(allowNext).toHaveBeenCalled();
    expect(denyRes.status).toHaveBeenCalledWith(403);
  });
});
