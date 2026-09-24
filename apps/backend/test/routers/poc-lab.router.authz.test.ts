import type { Request, Response, Router } from "express";
import type { Permission } from "../../src/models/role-permission";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const PocLabController = {
  list: jest.fn(),
  create: jest.fn(),
  get: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({ requireWebAuth }));
jest.mock("../../src/controllers/web/poc-lab.controller", () => ({
  PocLabController,
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

const router = jest.requireActual("../../src/routers/poc-lab.router")
  .default as Router;
const BASE = "/pms/organisation/:organisationId/poc-lab";

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{
      handle: (req: Request, res: Response, next: () => void) => void;
    }>;
  };
};

const runRoute = async (path: string, method: string) => {
  const route = ((router as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route.methods[method]),
  )?.route;
  if (!route) throw new Error(`route not found: ${method} ${path}`);
  const req = { params: { organisationId: "org-1" } } as unknown as Request;
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

describe("poc-lab.router authorization", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    activePermissions = [];
  });

  it("lets a member who can only view read the list but not record a result", async () => {
    activePermissions = ["appointments:view:any"];
    expect((await runRoute(BASE, "get")).reachedHandler).toBe(true);
    const post = await runRoute(BASE, "post");
    expect(post.res.status).toHaveBeenCalledWith(403);
    expect(post.reachedHandler).toBe(false);
  });

  it("records a result with the appointments edit permission, as the sibling clinical panels do", async () => {
    activePermissions = ["appointments:edit:any"];
    expect((await runRoute(BASE, "post")).reachedHandler).toBe(true);
  });

  it("requires web authentication before the permission check", async () => {
    activePermissions = ["appointments:edit:any"];
    await runRoute(BASE, "post");
    expect(requireWebAuth).toHaveBeenCalledTimes(1);
  });
});
