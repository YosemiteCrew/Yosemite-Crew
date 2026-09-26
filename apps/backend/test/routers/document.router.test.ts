import type { Router } from "express";

const passThrough = () =>
  jest.fn((_req: unknown, _res: unknown, next: () => void) => next());

const requireMobileAuth = passThrough();
const requireWebAuth = passThrough();
const companionGuard = passThrough();
const requireCompanionPermission = jest.fn(() => companionGuard);

// Each handler reports its own name, so a test can see which one a request
// reached.
let reached: (name: string) => void = () => undefined;
const handler = (name: string) =>
  jest.fn(() => {
    reached(name);
  });

const DocumentController = Object.fromEntries(
  [
    "getUploadUrl",
    "searchDocumentMobile",
    "createDocument",
    "listDocumentsForParent",
    "updateDocument",
    "listForAppointment",
    "getDocumentDownloadUrl",
    "getSignedDownloadUrl",
    "deleteForParent",
    "searchDocument",
    "createDocumentPms",
    "listForPms",
    "listConsentForPms",
    "getForPms",
  ].map((name) => [name, handler(name)]),
);

jest.mock("../../src/middlewares/auth", () => ({
  requireMobileAuth,
  requireWebAuth,
}));
jest.mock("../../src/middlewares/rbac", () => ({
  withAppointmentOrgPermissions: () => passThrough(),
  withOrgPermissions: () => passThrough(),
  requirePermission: () => passThrough(),
}));
jest.mock("../../src/middlewares/companion-access", () => ({
  requireCompanionPermission,
}));
jest.mock("../../src/controllers/app/document.controller", () => ({
  DocumentController,
}));

const router = jest.requireActual("../../src/routers/document.router")
  .default as unknown as (
  req: unknown,
  res: unknown,
  next: (err?: unknown) => void,
) => void;

// Recorded once, when the router module builds its routes.
const guardedFeatures = requireCompanionPermission.mock.calls.map(
  (call) => call as unknown[],
);

// Runs a request through the real router and names the handler it reached.
const dispatch = (method: string, url: string) =>
  new Promise<string>((resolve, reject) => {
    reached = resolve;
    (router as unknown as Router & typeof router)(
      { method, url, headers: {} },
      {},
      (err?: unknown) => (err ? reject(err) : resolve("no route")),
    );
  });

beforeEach(() => {
  jest.clearAllMocks();
});

describe("document.router mobile routes", () => {
  it("serves POST /mobile/view with the signed download handler", async () => {
    await expect(dispatch("POST", "/mobile/view")).resolves.toBe(
      "getSignedDownloadUrl",
    );
    expect(requireMobileAuth).toHaveBeenCalledTimes(1);
    expect(companionGuard).not.toHaveBeenCalled();
  });

  it.each([
    ["POST", "/mobile/upload-url", "getUploadUrl"],
    ["POST", "/mobile/companion-1", "createDocument"],
    ["GET", "/mobile/companion-1", "listDocumentsForParent"],
    ["GET", "/mobile/view/doc-1", "getDocumentDownloadUrl"],
    ["DELETE", "/mobile/doc-1", "deleteForParent"],
  ])("routes %s %s to %s", async (method, url, expected) => {
    await expect(dispatch(method, url)).resolves.toBe(expected);
  });

  it("guards the companion document routes with the documents permission", async () => {
    await dispatch("POST", "/mobile/companion-1");

    expect(companionGuard).toHaveBeenCalledTimes(1);
    expect(guardedFeatures).toContainEqual(["documents", "patientId"]);
  });
});
