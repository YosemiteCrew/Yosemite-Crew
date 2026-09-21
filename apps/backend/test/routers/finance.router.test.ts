import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const requireMobileAuth = jest.fn((_req, _res, next) => next());
const financeAppointmentLimiter = jest.fn((_req, _res, next) => next());
const withOrgPermissionsMiddleware = jest.fn((_req, _res, next) => next());
const withAppointmentOrgPermissionsMiddleware = jest.fn((_req, _res, next) =>
  next(),
);
const withInvoiceOrgPermissionsMiddleware = jest.fn((_req, _res, next) =>
  next(),
);
const withPaymentOrgPermissionsMiddleware = jest.fn((_req, _res, next) =>
  next(),
);
const withPaymentIntentOrgPermissionsMiddleware = jest.fn((_req, _res, next) =>
  next(),
);
/**
 * One middleware per permission, memoised, rather than one shared by all of
 * them.
 *
 * With a single stand-in, `expect(handlers).toContain(requirePermissionMiddleware)`
 * holds for every guarded route no matter which permission it was guarded
 * with, and `expect(requirePermission).toHaveBeenCalledWith(...)` is satisfied
 * by any OTHER route in the file having asked for it. Keyed this way the
 * handler a route carries identifies the permission it is actually behind.
 */
const permissionMiddlewares = new Map<
  string,
  jest.Mock<void, [unknown, unknown, () => void]>
>();
const permissionMiddleware = (permission: string) => {
  const existing = permissionMiddlewares.get(permission);
  if (existing) return existing;
  const created = jest.fn((_req: unknown, _res: unknown, next: () => void) =>
    next(),
  );
  permissionMiddlewares.set(permission, created);
  return created;
};

/** What every route in this file guarded by the billing READ permission carries. */
const requirePermissionMiddleware = permissionMiddleware("billing:view:any");

const withOrgPermissions = jest.fn(() => withOrgPermissionsMiddleware);
const withAppointmentOrgPermissions = jest.fn(
  () => withAppointmentOrgPermissionsMiddleware,
);
const withInvoiceOrgPermissions = jest.fn(
  () => withInvoiceOrgPermissionsMiddleware,
);
const withPaymentOrgPermissions = jest.fn(
  () => withPaymentOrgPermissionsMiddleware,
);
const withPaymentIntentOrgPermissions = jest.fn(
  () => withPaymentIntentOrgPermissionsMiddleware,
);
const requirePermission = jest.fn((permission: string) =>
  permissionMiddleware(permission),
);

const FinanceController = {
  webhook: jest.fn(),
  getDiscountSettings: jest.fn(),
  listProviderReceipts: jest.fn(),
  auditProviderReceipts: jest.fn(),
  updateDiscountSettings: jest.fn(),
  listInvoices: jest.fn(),
  createInvoice: jest.fn(),
  addInvoiceItems: jest.fn(),
  getInvoiceById: jest.fn(),
  retrievePaymentIntent: jest.fn(),
  listInvoicesForAppointment: jest.fn(),
  listInvoicesForParent: jest.fn(),
  bootstrapInvoiceForAppointment: jest.fn(),
  finalizeInvoice: jest.fn(),
  settleInvoiceAtCloseout: jest.fn(),
  previewInvoiceTax: jest.fn(),
  voidInvoice: jest.fn(),
  supplementInvoice: jest.fn(),
  createInvoicePaymentSession: jest.fn(),
  createMobileInvoicePaymentSession: jest.fn(),
  recordInvoicePayment: jest.fn(),
  refundPayment: jest.fn(),
  getSubscriptionOverview: jest.fn(),
  getSubscriptionSeatSyncPlan: jest.fn(),
  getUsageOverview: jest.fn(),
  recordSubscriptionCustomer: jest.fn(),
  recordSubscriptionCheckoutCompleted: jest.fn(),
  recordSubscriptionUpdated: jest.fn(),
  recordSubscriptionDeleted: jest.fn(),
  recordSubscriptionInvoicePaid: jest.fn(),
  recordSubscriptionInvoiceFailed: jest.fn(),
  getCurrentSubscription: jest.fn(),
  upsertSubscription: jest.fn(),
  recordUsageEvent: jest.fn(),
  captureUsageSnapshot: jest.fn(),
  getUsageSnapshots: jest.fn(),
  recordVisitMilestone: jest.fn(),
  markAppointmentReadyForBilling: jest.fn(),
  reverseAppointmentReadyForBilling: jest.fn(),
};

const rateLimit = jest.fn(() => financeAppointmentLimiter);

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
  requireMobileAuth,
}));

jest.mock("express-rate-limit", () => rateLimit);

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  withAppointmentOrgPermissions,
  withInvoiceOrgPermissions,
  withPaymentOrgPermissions,
  withPaymentIntentOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/app/finance.controller", () => ({
  FinanceController,
}));

const financeRouter = jest.requireActual("../../src/routers/finance.router")
  .default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = (
    (financeRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("finance.router", () => {
  it("puts the reconciliation queue behind web auth, org scope and a permission", () => {
    // Read-only, so the permission is the billing VIEW one. The route carries
    // unattributed captures, which have no organisation of their own - the org
    // middleware is what keeps one tenant's queue out of another's.
    const route = findRoute(
      "/organisation/:organisationId/provider-receipts",
      "get",
    );
    const handlers = route?.stack.map((layer) => layer.handle);

    expect(handlers).toContain(FinanceController.listProviderReceipts);
    expect(handlers).toContain(requireWebAuth);
    expect(handlers).toContain(withOrgPermissionsMiddleware);
    expect(handlers).toContain(requirePermissionMiddleware);
    expect(requirePermission).toHaveBeenCalledWith("billing:view:any");
  });

  it("puts the historical mismatch audit behind web auth, org scope and a permission", () => {
    const route = findRoute(
      "/organisation/:organisationId/provider-receipts/audit",
      "get",
    );
    const handlers = route?.stack.map((layer) => layer.handle);

    expect(handlers).toContain(FinanceController.auditProviderReceipts);
    expect(handlers).toContain(requireWebAuth);
    expect(handlers).toContain(withOrgPermissionsMiddleware);
    expect(handlers).toContain(requirePermissionMiddleware);
    expect(requirePermission).toHaveBeenCalledWith("billing:view:any");
  });

  it("mounts no route that could repair what the audit reports", () => {
    // The issue is explicit that the historical audit performs no automatic
    // guessed repair. Nothing under the audit path may accept a write, so a
    // later correction endpoint has to be argued for rather than appearing
    // beside the read that found the mismatch.
    const writes = (
      (financeRouter as unknown as { stack: Layer[] }).stack ?? []
    )
      .filter((entry) => entry.route?.path?.includes("provider-receipts/audit"))
      .flatMap((entry) => Object.keys(entry.route?.methods ?? {}));

    expect(writes).toEqual(["get"]);
  });

  it("routes payment and refund endpoints through finance handlers", () => {
    const sessionRoute = findRoute(
      "/invoices/:invoiceId/payments/sessions",
      "post",
    );
    const paymentRoute = findRoute("/invoices/:invoiceId/payments", "post");
    const refundRoute = findRoute("/payments/:paymentId/refunds", "post");
    const listInvoicesRoute = findRoute("/invoices", "get");
    const createInvoiceRoute = findRoute("/invoices", "post");
    const mobileParentRoute = findRoute(
      "/mobile/parents/:parentId/invoices",
      "get",
    );
    const mobileAppointmentRoute = findRoute(
      "/mobile/appointments/:appointmentId/invoices",
      "post",
    );
    const mobilePaymentSessionRoute = findRoute(
      "/mobile/invoices/:invoiceId/payments/sessions",
      "post",
    );

    expect(sessionRoute?.stack.map((layer) => layer.handle)).toContain(
      FinanceController.createInvoicePaymentSession,
    );
    expect(sessionRoute?.stack.map((layer) => layer.handle)).toContain(
      requireWebAuth,
    );
    expect(sessionRoute?.stack.map((layer) => layer.handle)).toContain(
      financeAppointmentLimiter,
    );
    expect(sessionRoute?.stack.map((layer) => layer.handle)).toContain(
      withInvoiceOrgPermissionsMiddleware,
    );
    expect(sessionRoute?.stack.map((layer) => layer.handle)).toContain(
      permissionMiddleware("billing:edit:any"),
    );
    expect(
      findRoute("/invoices/payment-intent/:paymentIntentId", "get")?.stack.map(
        (layer) => layer.handle,
      ),
    ).toContain(FinanceController.retrievePaymentIntent);
    expect(paymentRoute?.stack.map((layer) => layer.handle)).toContain(
      FinanceController.recordInvoicePayment,
    );
    expect(refundRoute?.stack.map((layer) => layer.handle)).toContain(
      FinanceController.refundPayment,
    );
    expect(refundRoute?.stack.map((layer) => layer.handle)).toContain(
      withPaymentOrgPermissionsMiddleware,
    );
    expect(listInvoicesRoute?.stack.map((layer) => layer.handle)).toContain(
      withOrgPermissionsMiddleware,
    );
    expect(createInvoiceRoute?.stack.map((layer) => layer.handle)).toContain(
      withOrgPermissionsMiddleware,
    );
    expect(listInvoicesRoute?.stack.map((layer) => layer.handle)).toContain(
      FinanceController.listInvoices,
    );
    expect(createInvoiceRoute?.stack.map((layer) => layer.handle)).toContain(
      FinanceController.createInvoice,
    );
    expect(mobileParentRoute?.stack.map((layer) => layer.handle)).toContain(
      requireMobileAuth,
    );
    expect(
      mobileAppointmentRoute?.stack.map((layer) => layer.handle),
    ).toContain(requireMobileAuth);
    expect(
      mobileAppointmentRoute?.stack.map((layer) => layer.handle),
    ).toContain(financeAppointmentLimiter);
    expect(
      mobilePaymentSessionRoute?.stack.map((layer) => layer.handle),
    ).toContain(requireMobileAuth);
    expect(
      mobilePaymentSessionRoute?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.createMobileInvoicePaymentSession);
    expect(
      findRoute("/:invoiceId", "get")?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireWebAuth,
      financeAppointmentLimiter,
      withInvoiceOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      FinanceController.getInvoiceById,
    ]);
    expect(
      findRoute("/mobile/payment-intent/:paymentIntentId", "get")?.stack.map(
        (layer) => layer.handle,
      ),
    ).toContain(FinanceController.retrievePaymentIntent);
    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(requirePermission).toHaveBeenCalledWith("billing:view:any");
    expect(requirePermission).toHaveBeenCalledWith("billing:edit:any");
  });

  it("guards the discount settings routes with billing permissions", () => {
    expect(
      findRoute(
        "/organisation/:organisationId/discount-settings",
        "get",
      )?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      requirePermissionMiddleware,
      FinanceController.getDiscountSettings,
    ]);
    expect(
      findRoute(
        "/organisation/:organisationId/discount-settings",
        "put",
      )?.stack.map((layer) => layer.handle),
    ).toEqual([
      requireWebAuth,
      withOrgPermissionsMiddleware,
      // `org:edit`, not a billing permission: the cap a discount is checked
      // against lives on the organisation record, so anyone who could edit it
      // could raise their own ceiling first.
      permissionMiddleware("org:edit"),
      FinanceController.updateDiscountSettings,
    ]);
  });

  it("exposes the remaining finance contract routes", () => {
    expect(
      findRoute("/organisation/:organisationId/usage", "get"),
    ).toBeUndefined();
    expect(
      findRoute("/organisation/:organisationId/usage/events", "post"),
    ).toBeUndefined();
    expect(
      findRoute("/organisation/:organisationId/usage/snapshots", "post"),
    ).toBeUndefined();
    expect(
      findRoute("/appointments/:appointmentId/charges", "post"),
    ).toBeUndefined();
    expect(
      findRoute("/appointments/:appointmentId/bootstrap", "post"),
    ).toBeUndefined();
    expect(
      findRoute("/pms/appointment/:appointmentId/bootstrap", "post"),
    ).toBeUndefined();
    expect(findRoute("/:invoiceId/checkout-session", "post")).toBeUndefined();
    expect(findRoute("/:invoiceId/mark-paid", "post")).toBeUndefined();
    expect(
      findRoute("/:invoiceId/payment-collection-method", "patch"),
    ).toBeUndefined();
    expect(findRoute("/:invoiceId/credit-notes", "post")).toBeUndefined();
    expect(
      findRoute("/:invoiceId/credit-notes/:creditNoteId/void", "post"),
    ).toBeUndefined();
    expect(
      findRoute("/invoices", "get")?.stack.map((layer) => layer.handle),
    ).toContain(withOrgPermissionsMiddleware);
    expect(
      findRoute("/invoices", "get")?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.listInvoices);
    expect(
      findRoute("/invoices", "post")?.stack.map((layer) => layer.handle),
    ).toContain(withOrgPermissionsMiddleware);
    expect(
      findRoute("/invoices", "post")?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.createInvoice);

    expect(
      findRoute("/subscriptions/current", "get")?.stack.map(
        (layer) => layer.handle,
      ),
    ).toContain(FinanceController.getCurrentSubscription);
    expect(
      findRoute("/subscriptions", "post")?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.upsertSubscription);
    expect(
      findRoute("/usage-events", "post")?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.recordUsageEvent);
    expect(
      findRoute("/usage-snapshots", "get")?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.getUsageSnapshots);
    expect(
      findRoute("/visits/:visitId/milestones", "post")?.stack.map(
        (layer) => layer.handle,
      ),
    ).toContain(FinanceController.recordVisitMilestone);
    expect(
      findRoute(
        "/appointments/:appointmentId/ready-for-billing",
        "post",
      )?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.markAppointmentReadyForBilling);
    expect(
      findRoute(
        "/appointments/:appointmentId/ready-for-billing",
        "delete",
      )?.stack.map((layer) => layer.handle),
    ).toContain(FinanceController.reverseAppointmentReadyForBilling);
    expect(
      findRoute("/invoices/:invoiceId/closeout", "post")?.stack.map(
        (layer) => layer.handle,
      ),
    ).toContain(FinanceController.settleInvoiceAtCloseout);
  });
});
