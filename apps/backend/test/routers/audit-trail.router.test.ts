import type { Router } from "express";

jest.mock("src/middlewares/auth", () => ({
  requireWebAuth: jest.fn((_req, _res, next) => next()),
}));
jest.mock("src/middlewares/rbac", () => ({
  ...jest.requireActual("src/middlewares/rbac"),
  withOrgPermissions: jest.fn(() => jest.fn((_req, _res, next) => next())),
}));
jest.mock("src/controllers/web/audit-trail.controller", () => ({
  AuditTrailController: {
    listForOrganisation: jest.fn((_req, res) => res.status(200).json({})),
    listForCompanion: jest.fn((_req, res) => res.status(200).json({})),
    listForAppointment: jest.fn((_req, res) => res.status(200).json({})),
  },
}));

type Handler = (req: unknown, res: unknown, next: () => void) => unknown;
type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: { handle: Handler }[];
  };
};

const loadRouter = () =>
  jest.requireActual<{ default: Router }>("src/routers/audit-trail.router")
    .default;

const runFeed = async (permissions: string[]) => {
  const route = (loadRouter().stack as unknown as Layer[]).find(
    (layer) =>
      layer.route?.path === "/organisation" && layer.route.methods.post,
  )?.route;
  if (!route) throw new Error("organisation audit route not found");
  const res = {
    statusCode: 0,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json() {
      return this;
    },
  };
  const req = { userPermissions: permissions };
  for (const { handle } of route.stack) {
    let advanced = false;
    await handle(req, res, () => {
      advanced = true;
    });
    if (!advanced) break;
  }
  return res.statusCode;
};

describe("organisation audit feed authorization", () => {
  it("allows callers with audit view permission", async () => {
    await expect(runFeed(["audit:view:any"])).resolves.toBe(200);
  });

  it.each([
    ["no permissions", []],
    ["companion access", ["companions:view:any"]],
  ])("denies %s", async (_label, permissions) => {
    await expect(runFeed(permissions)).resolves.toBe(403);
  });
});
