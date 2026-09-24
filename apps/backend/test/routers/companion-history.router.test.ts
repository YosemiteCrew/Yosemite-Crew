import type { Router } from "express";

jest.mock("src/middlewares/auth", () => ({
  requireWebAuth: jest.fn((_req, _res, next) => next()),
}));
jest.mock("src/middlewares/rbac", () => ({
  ...jest.requireActual("src/middlewares/rbac"),
  withOrgPermissions: jest.fn(() => jest.fn((_req, _res, next) => next())),
}));
jest.mock("src/controllers/web/companion-history.controller", () => ({
  CompanionHistoryController: {
    listForCompanion: jest.fn((_req, res) => res.status(200).json({})),
    listVitalsForCompanion: jest.fn((_req, res) => res.status(200).json({})),
  },
}));

type Handler = (req: unknown, res: unknown, next: () => void) => unknown;
type Layer = {
  route?: { path: string; stack: { handle: Handler }[] };
};

const loadRouter = () =>
  jest.requireActual<{ default: Router }>(
    "src/routers/companion-history.router",
  ).default;

// Runs a route's middleware chain in order, stopping where a handler answers
// without calling next - which is what a refused permission does.
const run = async (path: string, userPermissions: string[]) => {
  const layer = (loadRouter().stack as unknown as Layer[]).find(
    (l) => l.route?.path === path,
  );
  if (!layer?.route) throw new Error(`no route ${path}`);
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
  const req = { params: {}, query: {}, userPermissions };
  for (const { handle } of layer.route.stack) {
    let advanced = false;
    await handle(req, res, () => {
      advanced = true;
    });
    if (!advanced) break;
  }
  return res.statusCode;
};

const VITALS = "/pms/organisation/:organisationId/companion/:patientId/vitals";

describe("companion history router: vitals", () => {
  it("serves the history to a caller who may see companions and forms", async () => {
    expect(await run(VITALS, ["companions:view:any", "forms:view:any"])).toBe(
      200,
    );
  });

  it.each([
    ["companion access alone", ["companions:view:any"]],
    ["forms access alone", ["forms:view:any"]],
    ["no access", []],
  ])("refuses %s", async (_label, perms) => {
    expect(await run(VITALS, perms)).toBe(403);
  });
});
