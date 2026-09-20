import type { Request, Response, Router } from "express";
import { ROLE_PERMISSIONS } from "../../src/models/role-permission";
import type { Permission } from "../../src/models/role-permission";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const ControlledSubstanceLogController = {
  list: jest.fn(),
  create: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({ requireWebAuth }));
jest.mock(
  "../../src/controllers/web/controlled-substance-log.controller",
  () => ({
    ControlledSubstanceLogController,
  }),
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

const router = jest.requireActual(
  "../../src/routers/controlled-substance-log.router",
).default as Router;
const BASE = "/pms/organisation/:organisationId/controlled-substance-logs";

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
      entry.route?.path === path && Boolean(entry.route.methods[method]),
  )?.route;

const runRoute = async (path: string, method: string) => {
  const route = findRoute(path, method);
  if (!route) throw new Error(`route not found: ${method} ${path}`);
  const req = {
    params: { organisationId: "org-1", logId: "log-1" },
  } as unknown as Request;
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as unknown as Response & { status: jest.Mock };
  let executed = 0;
  for (const layer of route.stack) {
    let advanced = false;
    executed += 1;
    await layer.handle(req, res, () => {
      advanced = true;
    });
    if (!advanced) break;
  }
  return { res, reachedHandler: executed === route.stack.length };
};

describe("controlled-substance-log.router authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activePermissions = [];
  });

  it.each([
    [BASE, "get"],
    [`${BASE}/:logId`, "get"],
  ])("requires the register read permission for %s", async (path, method) => {
    activePermissions = ["appointments:view:any", "prescription:view:any"];
    expect((await runRoute(path, method)).res.status).toHaveBeenCalledWith(403);

    activePermissions = ["controlled-drug-register:read"];
    expect((await runRoute(path, method)).reachedHandler).toBe(true);
  });

  it("requires record permission to append an entry", async () => {
    activePermissions = ["prescription:edit:any"];
    expect((await runRoute(BASE, "post")).res.status).toHaveBeenCalledWith(403);

    activePermissions = ["controlled-drug-register:record"];
    expect((await runRoute(BASE, "post")).reachedHandler).toBe(true);
  });

  it.each(["put", "delete"])(
    "requires correct permission for %s",
    async (method) => {
      activePermissions = ["controlled-drug-register:record"];
      expect(
        (await runRoute(`${BASE}/:logId`, method)).res.status,
      ).toHaveBeenCalledWith(403);

      activePermissions = ["controlled-drug-register:correct"];
      expect((await runRoute(`${BASE}/:logId`, method)).reachedHandler).toBe(
        true,
      );
    },
  );

  it("keeps role defaults least-privileged", () => {
    expect(ROLE_PERMISSIONS.VETERINARIAN).toEqual(
      expect.arrayContaining([
        "controlled-drug-register:read",
        "controlled-drug-register:record",
      ]),
    );
    expect(ROLE_PERMISSIONS.VETERINARIAN).not.toContain(
      "controlled-drug-register:correct",
    );
    expect(ROLE_PERMISSIONS.TECHNICIAN).toContain(
      "controlled-drug-register:read",
    );
    expect(ROLE_PERMISSIONS.TECHNICIAN).not.toContain(
      "controlled-drug-register:record",
    );
    expect(ROLE_PERMISSIONS.ASSISTANT).not.toContain(
      "controlled-drug-register:read",
    );
    expect(ROLE_PERMISSIONS.RECEPTIONIST).not.toContain(
      "controlled-drug-register:read",
    );
  });
});
