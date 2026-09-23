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

const PrescriptionFillAuthorisationController = {
  authorise: jest.fn(),
  revoke: jest.fn(),
  eligibility: jest.fn(),
  reserve: jest.fn(),
  fulfil: jest.fn(),
  cancel: jest.fn(),
};

jest.mock("../../src/controllers/web/prescription.controller", () => ({
  PrescriptionController,
}));

jest.mock(
  "../../src/controllers/web/prescription-fill-authorisation.controller",
  () => ({ PrescriptionFillAuthorisationController }),
);

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
    params: {
      organisationId: "org-1",
      prescriptionId: "rx-1",
      itemId: "item-1",
      authorizationId: "auth-1",
      reservationId: "res-1",
    },
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

/*
 * Authorised repeats (#3162). Three groups with deliberately different gates,
 * so each one is asserted against the permission set the OTHER groups accept -
 * a shared "OWNER reaches it" case would hold for all three and distinguish
 * nothing.
 */
const AUTHORITY_WRITES = [
  "/organisations/:organisationId/items/:itemId/fill-authorisations",
  String.raw`/organisations/:organisationId/fill-authorisations/:authorizationId/\$revoke`,
];

const FILL_ACTIONS = [
  "/organisations/:organisationId/items/:itemId/fill-reservations",
  String.raw`/organisations/:organisationId/fill-reservations/:reservationId/\$fulfil`,
  String.raw`/organisations/:organisationId/fill-reservations/:reservationId/\$cancel`,
];

const ELIGIBILITY_READ =
  "/organisations/:organisationId/items/:itemId/fill-eligibility";

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

  describe.each(AUTHORITY_WRITES)("POST %s", (path) => {
    it("rejects an inventory-only caller", async () => {
      activePermissions = ["inventory:edit:any", "inventory:view:any"];

      const { res } = await runRoute(path, "post");

      expect(res.status).toHaveBeenCalledWith(403);
      expect(
        PrescriptionFillAuthorisationController.authorise,
      ).not.toHaveBeenCalled();
      expect(
        PrescriptionFillAuthorisationController.revoke,
      ).not.toHaveBeenCalled();
    });

    it("rejects a RECEPTIONIST", async () => {
      activePermissions = ROLE_PERMISSIONS.RECEPTIONIST;

      const { res } = await runRoute(path, "post");

      expect(res.status).toHaveBeenCalledWith(403);
    });

    // The distinguishing case: unlike the dispense actions above, issuing an
    // authority needs no inventory permission at all.
    it("allows a caller holding prescription:edit:any and nothing else", async () => {
      activePermissions = ["prescription:edit:any"];

      const { res, reachedHandler } = await runRoute(path, "post");

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(reachedHandler).toBe(true);
    });

    /*
     * `prescription:edit:own` is admitted at the router on purpose. The
     * refusal for an own-only caller on someone else's prescription is the
     * service's, and is asserted in
     * test/services/prescription-fill-authorisation.service.test.ts.
     */
    it.each(["TECHNICIAN", "ASSISTANT"] as const)(
      "admits a %s, who holds prescription:edit:own",
      async (role) => {
        activePermissions = ROLE_PERMISSIONS[role];

        const { res, reachedHandler } = await runRoute(path, "post");

        expect(res.status).not.toHaveBeenCalledWith(403);
        expect(reachedHandler).toBe(true);
      },
    );
  });

  describe.each(FILL_ACTIONS)("POST %s", (path) => {
    it("rejects a caller holding prescription:edit:any without inventory:edit:any", async () => {
      activePermissions = ["prescription:edit:any"];

      const { res } = await runRoute(path, "post");

      expect(res.status).toHaveBeenCalledWith(403);
      expect(
        PrescriptionFillAuthorisationController.reserve,
      ).not.toHaveBeenCalled();
      expect(
        PrescriptionFillAuthorisationController.fulfil,
      ).not.toHaveBeenCalled();
      expect(
        PrescriptionFillAuthorisationController.cancel,
      ).not.toHaveBeenCalled();
    });

    it("rejects an inventory-only caller", async () => {
      activePermissions = ["inventory:edit:any", "inventory:view:any"];

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

    it("allows an OWNER, who holds both permissions", async () => {
      activePermissions = ROLE_PERMISSIONS.OWNER;

      const { res, reachedHandler } = await runRoute(path, "post");

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(reachedHandler).toBe(true);
    });
  });

  /*
   * `requireWebAuth` is stubbed to a pass-through here so the permission
   * semantics can be driven, which means no assertion above can tell a route
   * that authenticates from one that does not - deleting it from a route left
   * every other case in this file green. These name the middleware directly.
   */
  describe("authentication", () => {
    it.each([...AUTHORITY_WRITES, ...FILL_ACTIONS])(
      "runs requireWebAuth before POST %s",
      async (path) => {
        activePermissions = ROLE_PERMISSIONS.OWNER;

        await runRoute(path, "post");

        expect(requireWebAuth).toHaveBeenCalledTimes(1);
      },
    );

    it("runs requireWebAuth before the eligibility read", async () => {
      activePermissions = ROLE_PERMISSIONS.OWNER;

      await runRoute(ELIGIBILITY_READ, "get");

      expect(requireWebAuth).toHaveBeenCalledTimes(1);
    });
  });

  describe(`GET ${ELIGIBILITY_READ}`, () => {
    it("rejects an inventory-only caller", async () => {
      activePermissions = ["inventory:view:any", "inventory:edit:any"];

      const { res } = await runRoute(ELIGIBILITY_READ, "get");

      expect(res.status).toHaveBeenCalledWith(403);
      expect(
        PrescriptionFillAuthorisationController.eligibility,
      ).not.toHaveBeenCalled();
    });

    it("rejects a caller holding only prescription:view:own", async () => {
      activePermissions = ["prescription:view:own"];

      const { res } = await runRoute(ELIGIBILITY_READ, "get");

      expect(res.status).toHaveBeenCalledWith(403);
    });

    // The distinguishing case: the dispense-request reads above also demand
    // inventory:view:any, and requiring it here would hide remaining repeats
    // from the prescriber.
    it("allows a caller holding prescription:view:any and nothing else", async () => {
      activePermissions = ["prescription:view:any"];

      const { res, reachedHandler } = await runRoute(ELIGIBILITY_READ, "get");

      expect(res.status).not.toHaveBeenCalledWith(403);
      expect(reachedHandler).toBe(true);
    });
  });
});
