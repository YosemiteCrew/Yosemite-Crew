import type { Request, Response, Router } from "express";
import { ROLE_PERMISSIONS } from "../../src/models/role-permission";
import type { Permission } from "../../src/models/role-permission";

const requireWebAuth = jest.fn((_req, _res, next) => next());

const PrescriptionController = {
  listDispenseRequests: jest.fn(),
  getDispenseRequest: jest.fn(),
  generateLabelPdf: jest.fn(),
  generateLabels: jest.fn(),
  finalize: jest.fn(),
  reserve: jest.fn(),
  notDispensed: jest.fn(),
  dispense: jest.fn(),
  returnPrescription: jest.fn(),
  voidDispense: jest.fn(),
};

// Only the membership lookup is stubbed: `requirePermission` is the real
// implementation so the any-of/all-of semantics are exercised as deployed.
jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
}));

jest.mock("../../src/controllers/web/prescription.controller", () => ({
  PrescriptionController,
}));

let activePermissions: Permission[] = [];

jest.mock("../../src/middlewares/rbac", () => {
  const actual = jest.requireActual("../../src/middlewares/rbac");
  return {
    ...actual,
    withOrgPermissions:
      () => (req: Request, _res: Response, next: () => void) => {
        (req as Request & { userPermissions: Permission[] }).userPermissions =
          activePermissions;
        next();
      },
  };
});

const router = jest.requireActual("../../src/routers/prescription.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{
      handle: (req: Request, res: Response, next: () => void) => void;
    }>;
  };
};

const findRoute = (path: string, method: string) =>
  ((router as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  )?.route;

/** Drives a route's middleware chain and reports the outcome. */
const runRoute = async (path: string, method: string) => {
  const route = findRoute(path, method);
  if (!route) throw new Error(`route not found: ${method} ${path}`);

  const req = {
    params: { organisationId: "org-1", prescriptionId: "rx-1" },
    headers: {},
    query: {},
    body: {},
    userId: "user-1",
  } as unknown as Request;

  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response & { status: jest.Mock; json: jest.Mock };

  let executed = 0;
  for (const layer of route.stack) {
    let advanced = false;
    executed += 1;
    await layer.handle(req, res, () => {
      advanced = true;
    });
    if (!advanced) break;
  }

  // The controller is the last layer and never calls next(), so a chain that
  // ran every layer is one that reached the handler.
  return { res, reachedHandler: executed === route.stack.length };
};

const DISPENSE_ACTIONS = [
  String.raw`/organisations/:organisationId/:prescriptionId/\$reserve`,
  String.raw`/organisations/:organisationId/:prescriptionId/\$approve`,
  String.raw`/organisations/:organisationId/:prescriptionId/\$not-dispensed`,
  String.raw`/organisations/:organisationId/:prescriptionId/\$dispense`,
  String.raw`/organisations/:organisationId/:prescriptionId/\$return`,
  String.raw`/organisations/:organisationId/:prescriptionId/\$void-dispense`,
];

const DISPENSE_REQUEST_READS = [
  "/organisations/:organisationId/prescription-dispense-requests",
  "/organisations/:organisationId/prescription-dispense-requests/:dispenseRequestId",
];

describe("prescription.router authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activePermissions = [];
  });

  describe.each(DISPENSE_ACTIONS)("POST %s", (path) => {
    it("rejects an inventory-only caller", async () => {
      activePermissions = ["inventory:edit:any", "inventory:view:any"];

      const { res } = await runRoute(path, "post");

      expect(res.status).toHaveBeenCalledWith(403);
      expect(PrescriptionController.dispense).not.toHaveBeenCalled();
      expect(PrescriptionController.reserve).not.toHaveBeenCalled();
      expect(PrescriptionController.returnPrescription).not.toHaveBeenCalled();
      expect(PrescriptionController.voidDispense).not.toHaveBeenCalled();
      expect(PrescriptionController.notDispensed).not.toHaveBeenCalled();
    });

    it("rejects a RECEPTIONIST, who holds inventory:edit:any but no prescription:edit:*", async () => {
      activePermissions = ROLE_PERMISSIONS.RECEPTIONIST;

      const { res } = await runRoute(path, "post");

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it.each(["TECHNICIAN", "ASSISTANT"] as const)(
      "rejects a %s, who holds prescription:edit:own but not :any",
      async (role) => {
        activePermissions = ROLE_PERMISSIONS[role];

        const { res } = await runRoute(path, "post");

        expect(res.status).toHaveBeenCalledWith(403);
      },
    );

    it("rejects a caller holding prescription:edit:any without inventory:edit:any", async () => {
      activePermissions = ["prescription:edit:any"];

      const { res } = await runRoute(path, "post");

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("allows an OWNER, who holds both permissions", async () => {
      activePermissions = ROLE_PERMISSIONS.OWNER;

      const { res, reachedHandler } = await runRoute(path, "post");

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(reachedHandler).toBe(true);
    });
  });

  describe.each(DISPENSE_REQUEST_READS)("GET %s", (path) => {
    it("rejects a caller with inventory:view:any but no prescription:view:any", async () => {
      activePermissions = ["inventory:view:any", "inventory:edit:any"];

      const { res } = await runRoute(path, "get");

      expect(res.status).toHaveBeenCalledWith(403);
      expect(
        PrescriptionController.listDispenseRequests,
      ).not.toHaveBeenCalled();
      expect(PrescriptionController.getDispenseRequest).not.toHaveBeenCalled();
    });

    it("rejects a caller with prescription:view:any but no inventory:view:any", async () => {
      activePermissions = ["prescription:view:any"];

      const { res } = await runRoute(path, "get");

      expect(res.status).toHaveBeenCalledWith(403);
    });

    it("allows a caller holding both permissions", async () => {
      activePermissions = ["prescription:view:any", "inventory:view:any"];

      const { res, reachedHandler } = await runRoute(path, "get");

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(reachedHandler).toBe(true);
    });
  });
});
