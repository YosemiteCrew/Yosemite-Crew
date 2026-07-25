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
    payment: {
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
    encounter: {
      findUnique: jest.fn(),
    },
    case: {
      findUnique: jest.fn(),
    },
    renderedDocument: {
      findUnique: jest.fn(),
    },
    roomUnit: {
      findUnique: jest.fn(),
    },
    roomUnitGroup: {
      findUnique: jest.fn(),
    },
  },
}));

import { prisma } from "../../src/config/prisma";
import {
  requirePermission,
  type OrgRequest,
  withAppointmentOrgPermissions,
  withCaseOrgPermissions,
  withEncounterOrgPermissions,
  withInventoryItemOrgPermissions,
  withInvoiceOrgPermissions,
  withOrgPermissions,
  withPaymentIntentOrgPermissions,
  withPaymentOrgPermissions,
  withRenderedDocumentOrgPermissions,
  withRoomUnitGroupOrgPermissions,
  withRoomUnitOrgPermissions,
  withTaskOrgPermissions,
} from "../../src/middlewares/rbac";

const mockRes = (): Response =>
  ({
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }) as unknown as Response;

const next = () => jest.fn() as unknown as NextFunction;

// A membership whose stored effective permissions already match the computed
// set, so withOrgPermissions resolves cleanly (no updateMany) and calls next().
const membership = () => ({
  id: "map_1",
  roleCode: undefined,
  extraPermissions: ["tasks:view:any"],
  revokedPermissions: [],
  effectivePermissions: ["tasks:view:any"],
});

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

  it("resolves org id from the organizationId param spelling", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );
    const req = {
      userId: "user_1",
      params: { organizationId: "org_z" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withOrgPermissions()(req, mockRes(), middlewareNext);

    expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { organizationReference: "org_z" },
            { organizationReference: "Organization/org_z" },
          ],
        }),
      }),
    );
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("resolves org id from the x-org-id header", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );
    const req = {
      userId: "user_1",
      params: {},
      headers: { "x-org-id": "org_hdr" },
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withOrgPermissions()(req, mockRes(), middlewareNext);

    expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { organizationReference: "org_hdr" },
            { organizationReference: "Organization/org_hdr" },
          ],
        }),
      }),
    );
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("resolves org id from the query string (both spellings)", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );

    const organisationReq = {
      userId: "user_1",
      params: {},
      headers: {},
      query: { organisationId: "org_q1" },
    } as unknown as OrgRequest as Request;
    await withOrgPermissions()(organisationReq, mockRes(), next());
    expect(prisma.userOrganization.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { organizationReference: "org_q1" },
            { organizationReference: "Organization/org_q1" },
          ],
        }),
      }),
    );

    const organizationReq = {
      userId: "user_1",
      params: {},
      headers: {},
      query: { organizationId: "org_q2" },
    } as unknown as OrgRequest as Request;
    await withOrgPermissions()(organizationReq, mockRes(), next());
    expect(prisma.userOrganization.findFirst).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { organizationReference: "org_q2" },
            { organizationReference: "Organization/org_q2" },
          ],
        }),
      }),
    );
  });

  it("skips non-object entries when extracting org id from an array body", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );
    const req = {
      userId: "user_1",
      params: {},
      headers: {},
      body: [null, "not-an-object", 42, { organisationId: "org_arr" }],
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withOrgPermissions()(req, mockRes(), middlewareNext);

    expect(prisma.userOrganization.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { organizationReference: "org_arr" },
            { organizationReference: "Organization/org_arr" },
          ],
        }),
      }),
    );
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("returns 400 for an array body with no resolvable org id", async () => {
    const res = mockRes();
    await withOrgPermissions()(
      {
        userId: "user_1",
        params: {},
        headers: {},
        body: [{ foo: "bar" }, "x"],
      } as unknown as OrgRequest as Request,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.userOrganization.findFirst).not.toHaveBeenCalled();
  });

  it("returns 400 for an array body naming two distinct organisations", async () => {
    const res = mockRes();
    await withOrgPermissions()(
      {
        userId: "user_1",
        params: {},
        headers: {},
        body: [{ organisationId: "org_a" }, { organisationId: "org_b" }],
      } as unknown as OrgRequest as Request,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(prisma.userOrganization.findFirst).not.toHaveBeenCalled();
  });

  it("returns 500 when the mapping lookup throws", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockRejectedValue(
      new Error("db down") as never,
    );
    const res = mockRes();
    const middlewareNext = next();

    await withOrgPermissions()(
      {
        userId: "user_1",
        params: { organisationId: "org_1" },
        headers: {},
      } as unknown as OrgRequest as Request,
      res,
      middlewareNext,
    );

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      message: "Failed to resolve permissions",
    });
    expect(middlewareNext).not.toHaveBeenCalled();
  });

  it("falls back to empty base permissions for an unknown role code", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "map_1",
      roleCode: "NOT_A_REAL_ROLE",
      extraPermissions: [],
      revokedPermissions: [],
      effectivePermissions: [],
    } as never);

    const req = {
      userId: "user_1",
      params: { organisationId: "org_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withOrgPermissions()(req, mockRes(), middlewareNext);

    expect((req as unknown as OrgRequest).userPermissions).toEqual([]);
    expect(prisma.userOrganization.updateMany).not.toHaveBeenCalled();
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("returns 400 when the resource id param is missing", async () => {
    const res = mockRes();

    await withAppointmentOrgPermissions()({ params: {} } as never, res, next());

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Missing appointmentId" });
    expect(prisma.appointment.findUnique).not.toHaveBeenCalled();
  });

  it("returns 400 when the resource loader throws", async () => {
    (prisma.appointment.findUnique as jest.Mock).mockRejectedValue(
      new Error("bad id") as never,
    );
    const res = mockRes();

    await withAppointmentOrgPermissions()(
      { params: { appointmentId: "apt_bad" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ message: "Invalid appointmentId" });
  });

  it("hydrates organisationId from a payment's invoice", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue({
      invoice: { organisationId: "org_pay" },
    } as never);
    const req = {
      userId: "user_1",
      params: { paymentId: "pay_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withPaymentOrgPermissions()(req, mockRes(), middlewareNext);

    expect(req.params.organisationId).toBe("org_pay");
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("returns 404 when the payment is missing", async () => {
    (prisma.payment.findUnique as jest.Mock).mockResolvedValue(null as never);
    const res = mockRes();

    await withPaymentOrgPermissions()(
      { params: { paymentId: "pay_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Payment not found" });
  });

  it("hydrates organisationId from an encounter using the default param", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );
    (prisma.encounter.findUnique as jest.Mock).mockResolvedValue({
      organisationId: "org_enc",
    } as never);
    const req = {
      userId: "user_1",
      params: { id: "enc_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withEncounterOrgPermissions()(req, mockRes(), middlewareNext);

    expect(prisma.encounter.findUnique).toHaveBeenCalledWith({
      where: { id: "enc_1" },
      select: { organisationId: true },
    });
    expect(req.params.organisationId).toBe("org_enc");
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("returns 404 when the encounter is missing", async () => {
    (prisma.encounter.findUnique as jest.Mock).mockResolvedValue(null as never);
    const res = mockRes();

    await withEncounterOrgPermissions()(
      { params: { id: "enc_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Encounter not found" });
  });

  it("hydrates organisationId from a case using a custom param name", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );
    (prisma.case.findUnique as jest.Mock).mockResolvedValue({
      organisationId: "org_case",
    } as never);
    const req = {
      userId: "user_1",
      params: { caseId: "case_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withCaseOrgPermissions("caseId")(req, mockRes(), middlewareNext);

    expect(prisma.case.findUnique).toHaveBeenCalledWith({
      where: { id: "case_1" },
      select: { organisationId: true },
    });
    expect(req.params.organisationId).toBe("org_case");
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("returns 404 when the case is missing", async () => {
    (prisma.case.findUnique as jest.Mock).mockResolvedValue(null as never);
    const res = mockRes();

    await withCaseOrgPermissions()(
      { params: { id: "case_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Case not found" });
  });

  it("hydrates organisationId from a rendered document", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );
    (prisma.renderedDocument.findUnique as jest.Mock).mockResolvedValue({
      organisationId: "org_doc",
    } as never);
    const req = {
      userId: "user_1",
      params: { renderedDocumentId: "doc_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withRenderedDocumentOrgPermissions()(req, mockRes(), middlewareNext);

    expect(req.params.organisationId).toBe("org_doc");
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("returns 404 when the rendered document is missing", async () => {
    (prisma.renderedDocument.findUnique as jest.Mock).mockResolvedValue(
      null as never,
    );
    const res = mockRes();

    await withRenderedDocumentOrgPermissions()(
      { params: { renderedDocumentId: "doc_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Rendered document not found",
    });
  });

  it("hydrates organisationId from a room unit", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );
    (prisma.roomUnit.findUnique as jest.Mock).mockResolvedValue({
      organisationId: "org_unit",
    } as never);
    const req = {
      userId: "user_1",
      params: { id: "unit_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withRoomUnitOrgPermissions()(req, mockRes(), middlewareNext);

    expect(req.params.organisationId).toBe("org_unit");
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("returns 404 when the room unit is missing", async () => {
    (prisma.roomUnit.findUnique as jest.Mock).mockResolvedValue(null as never);
    const res = mockRes();

    await withRoomUnitOrgPermissions()(
      { params: { id: "unit_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Room unit not found" });
  });

  it("hydrates organisationId from a room unit group", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue(
      membership() as never,
    );
    (prisma.roomUnitGroup.findUnique as jest.Mock).mockResolvedValue({
      organisationId: "org_group",
    } as never);
    const req = {
      userId: "user_1",
      params: { id: "group_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withRoomUnitGroupOrgPermissions()(req, mockRes(), middlewareNext);

    expect(req.params.organisationId).toBe("org_group");
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("returns 404 when the room unit group is missing", async () => {
    (prisma.roomUnitGroup.findUnique as jest.Mock).mockResolvedValue(
      null as never,
    );
    const res = mockRes();

    await withRoomUnitGroupOrgPermissions()(
      { params: { id: "group_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Room unit group not found",
    });
  });

  it("returns 404 when the invoice has no organisation", async () => {
    (prisma.invoice.findUnique as jest.Mock).mockResolvedValue(null as never);
    const res = mockRes();

    await withInvoiceOrgPermissions()(
      { params: { invoiceId: "inv_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice not found" });
  });

  it("returns 404 when no payment attempt matches the intent", async () => {
    (prisma.paymentAttempt.findFirst as jest.Mock).mockResolvedValue(
      null as never,
    );
    const res = mockRes();

    await withPaymentIntentOrgPermissions()(
      { params: { paymentIntentId: "pi_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Invoice not found" });
  });

  it("returns 404 when the task is missing", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(null as never);
    const res = mockRes();

    await withTaskOrgPermissions()(
      { params: { taskId: "task_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({ message: "Task not found" });
  });

  it("returns 404 when the inventory item is missing", async () => {
    (prisma.inventoryItem.findUnique as jest.Mock).mockResolvedValue(
      null as never,
    );
    const res = mockRes();

    await withInventoryItemOrgPermissions()(
      { params: { itemId: "item_x" } } as never,
      res,
      next(),
    );

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      message: "Inventory item not found",
    });
  });

  it("treats non-array stored effective permissions as empty and recomputes", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "map_1",
      roleCode: undefined,
      extraPermissions: ["tasks:view:any"],
      revokedPermissions: [],
      effectivePermissions: undefined,
    } as never);

    const req = {
      userId: "user_1",
      params: { organisationId: "org_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withOrgPermissions()(req, mockRes(), middlewareNext);

    // stored `undefined` normalises to [], which differs from the computed
    // set, forcing a persist and using the freshly computed permissions.
    expect(prisma.userOrganization.updateMany).toHaveBeenCalledWith({
      where: { id: "map_1" },
      data: { effectivePermissions: ["tasks:view:any"] },
    });
    expect((req as unknown as OrgRequest).userPermissions).toEqual([
      "tasks:view:any",
    ]);
    expect(middlewareNext).toHaveBeenCalled();
  });

  it("recomputes when stored and computed permissions differ but match in length", async () => {
    (prisma.userOrganization.findFirst as jest.Mock).mockResolvedValue({
      id: "map_1",
      roleCode: undefined,
      extraPermissions: ["tasks:view:any", "tasks:edit:any"],
      revokedPermissions: [],
      // Same length as computed, but a different member -> samePermissions
      // must return false on the mismatched entry.
      effectivePermissions: ["tasks:view:any", "companions:view:any"],
    } as never);

    const req = {
      userId: "user_1",
      params: { organisationId: "org_1" },
      headers: {},
    } as unknown as OrgRequest as Request;
    const middlewareNext = next();

    await withOrgPermissions()(req, mockRes(), middlewareNext);

    expect(prisma.userOrganization.updateMany).toHaveBeenCalledWith({
      where: { id: "map_1" },
      data: {
        effectivePermissions: ["tasks:view:any", "tasks:edit:any"],
      },
    });
    expect((req as unknown as OrgRequest).userPermissions).toEqual([
      "tasks:view:any",
      "tasks:edit:any",
    ]);
    expect(middlewareNext).toHaveBeenCalled();
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
