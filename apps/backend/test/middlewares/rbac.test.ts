import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import type { NextFunction, Request, Response } from "express";

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

import { prisma } from "../../src/config/prisma";
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

describe("rbac middleware", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

  it("rejects a structured (non-string) organisationId in the body", async () => {
    const res = mockRes();

    await withOrgPermissions()(
      {
        userId: "user_1",
        params: {},
        headers: {},
        body: { organisationId: { not: "" } },
      } as unknown as Request,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.userOrganization.findFirst).not.toHaveBeenCalled();
  });

  it("rejects a structured (non-string) organisationId in the query", async () => {
    const res = mockRes();

    await withOrgPermissions()(
      {
        userId: "user_1",
        params: {},
        headers: {},
        query: { organisationId: { not: "" } },
      } as unknown as Request,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.userOrganization.findFirst).not.toHaveBeenCalled();
  });

  it("ignores an empty-string organisationId param", async () => {
    const res = mockRes();

    await withOrgPermissions()(
      {
        userId: "user_1",
        params: { organisationId: "   " },
        headers: {},
      } as unknown as Request,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.userOrganization.findFirst).not.toHaveBeenCalled();
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

  it("scopes the postgres mapping lookup to active memberships", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "map_1",
      roleCode: "TECHNICIAN",
      extraPermissions: [],
      revokedPermissions: [],
      effectivePermissions: [],
    } as never);

    await withOrgPermissions()(
      {
        userId: "user_1",
        params: { orgId: "org_1" },
        headers: {},
        body: {},
      } as unknown as OrgRequest as Request,
      mockRes(),
      next(),
    );

    expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith({
      where: expect.objectContaining({
        practitionerReference: "user_1",
        active: true,
      }),
    });
  });

  it("returns 403 when the membership exists but is deactivated", async () => {
    // A deactivated mapping must not resolve permissions: the query filters on
    // `active`, so an offboarded user's row is simply not found.
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      null as never,
    );
    const res = mockRes();
    const middlewareNext = next();

    await withOrgPermissions()(
      {
        userId: "deactivated_user",
        params: { orgId: "org_1" },
        headers: {},
        body: {},
      } as unknown as OrgRequest as Request,
      res,
      middlewareNext,
    );

    expect(res.status).toHaveBeenCalledWith(403);
    expect(middlewareNext).not.toHaveBeenCalled();
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
      params: { taskId: "task_1" },
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
