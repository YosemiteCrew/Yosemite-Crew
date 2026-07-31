import type { Express, Router } from "express";

// registerRoutes() in src/routers/index.ts imports ~60 router modules; the
// regression this test guards against (commit 88d5a234a) was a one-line swap
// where `/fhir/v1/invoice` was silently repointed from invoiceRouter to
// financeRouter, leaving invoice.router.ts's checkout-session, mark-paid,
// payment-collection-method, and credit-notes routes completely unreachable
// (a raw Express 404, not a JSON error). Every sibling router is replaced
// with an inert string marker so this test only exercises the mounting
// wiring itself, not each router's own dependency chain (prisma, stripe,
// redis, etc.). invoice.router.ts is the one router loaded for real, so its
// route table can be asserted post-mount.
const MARKER_ROUTER_MODULES = [
  "organization.router",
  "companion.router",
  "parent.router",
  "user-organization.router",
  "user.router",
  "user-profile.router",
  "availability.router",
  "speciality.router",
  "organisation-room.router",
  "organisation-invite.router",
  "authUserMobile.router",
  "coparentInvite.router",
  "parent-companion.router",
  "companion-organisation.router",
  "document.router",
  "service.router",
  "appointment.router",
  "stripe.router",
  "finance.router",
  "documenso.router",
  "organisationRating.router",
  "form.router",
  "form-assignment.router",
  "template.router",
  "template.fhir.router",
  "rendered-document.fhir.router",
  "clinical-artifact.fhir.router",
  "prescription.router",
  "expense.router",
  "deviceToken.router",
  "chat.router",
  "notification.router",
  "contact-us.router",
  "account-withdrawal.router",
  "organisation-document.router",
  "adverse-event.router",
  "task.router",
  "task.fhir.router",
  "task-schedule.fhir.router",
  "workspace.router",
  "inventory.router",
  "search.router",
  "observationTool.routes",
  "dashboard.router",
  "mobile.config.router",
  "audit-trail.router",
  "integration.router",
  "knowledge.router",
  "code.router",
  "lab-order.router",
  "lab-result.router",
  "companion-history.router",
  "auth.router",
  "catalog.router",
  "healthcare-service.router",
  "episode-of-care.router",
  "encounter.router",
  "room-unit.router",
  "room-unit-group.router",
  "marketing-unsubscribe.router",
];

for (const name of MARKER_ROUTER_MODULES) {
  jest.doMock(`../../src/routers/${name}`, () => ({
    __esModule: true,
    default: `router-marker:${name}`,
  }));
}

// invoice.router.ts is loaded for real (via jest.requireActual below), so its
// own direct dependencies are mocked the same way invoice.router.test.ts does.
jest.doMock("../../src/middlewares/auth", () => ({
  requireWebAuth: jest.fn((_req, _res, next) => next()),
  requireMobileAuth: jest.fn((_req, _res, next) => next()),
}));
jest.doMock(
  "express-rate-limit",
  () => () => (_req: unknown, _res: unknown, next: () => void) => next(),
);
jest.doMock("../../src/middlewares/rbac", () => ({
  withOrgPermissions: jest.fn(
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  ),
  withAppointmentOrgPermissions: jest.fn(
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  ),
  withInvoiceOrgPermissions: jest.fn(
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  ),
  withPaymentIntentOrgPermissions: jest.fn(
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  ),
  requirePermission: jest.fn(
    () => (_req: unknown, _res: unknown, next: () => void) => next(),
  ),
}));
jest.doMock("../../src/controllers/app/invoice.controller", () => ({
  InvoiceController: new Proxy(
    {},
    {
      get: () => jest.fn(),
    },
  ),
}));

const { registerRoutes } = jest.requireActual("../../src/routers/index") as {
  registerRoutes: (app: Express) => void;
};
const invoiceRouter = jest.requireActual("../../src/routers/invoice.router")
  .default as Router;

type RouteLayer = {
  route?: { path: string; methods: Record<string, boolean> };
};

describe("routers/index registerRoutes", () => {
  it("mounts the real invoice.router (not finance.router) at /fhir/v1/invoice", () => {
    const calls: Array<{ path: string; handler: unknown }> = [];
    const fakeApp = {
      use: (path: string, handler: unknown) => {
        calls.push({ path, handler });
      },
    } as unknown as Express;

    registerRoutes(fakeApp);

    const invoiceMount = calls.find((c) => c.path === "/fhir/v1/invoice");
    const financeMount = calls.find((c) => c.path === "/v1/finance");

    expect(invoiceMount).toBeDefined();
    expect(financeMount).toBeDefined();
    expect(invoiceMount?.handler).toBe(invoiceRouter);
    expect(financeMount?.handler).toBe("router-marker:finance.router");
    expect(invoiceMount?.handler).not.toBe(financeMount?.handler);

    // Representative endpoint: confirm the router actually mounted at
    // /fhir/v1/invoice still carries the checkout-session route used by
    // "Send to Client" (and isn't some other unrelated router instance).
    const stack = (invoiceMount?.handler as unknown as { stack: RouteLayer[] })
      .stack;
    const hasCheckoutSession = stack.some(
      (layer) =>
        layer.route?.path === "/:invoiceId/checkout-session" &&
        Boolean(layer.route?.methods?.post),
    );
    expect(hasCheckoutSession).toBe(true);
  });
});
