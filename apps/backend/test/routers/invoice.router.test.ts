import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());
const invoiceActionLimiter = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const withAppointmentOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const withInvoiceOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const withPaymentIntentOrgPermissions = jest.fn(() =>
  jest.fn((_req, _res, next) => next()),
);
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const InvoiceController = {
  listInvoicesForAppointment: jest.fn(),
  getInvoiceByPaymentIntentId: jest.fn(),
  getInvoiceById: jest.fn(),
  addChargesToAppointment: jest.fn(),
  listInvoicesForOrganisation: jest.fn(),
  createCheckoutSessionForInvoice: jest.fn(),
  bootstrapInvoiceForAppointment: jest.fn(),
  markInvoicePaidManually: jest.fn(),
  updatePaymentCollectionMethod: jest.fn(),
  issueCreditNote: jest.fn(),
  voidCreditNote: jest.fn(),
};

const rateLimit = jest.fn(() => invoiceActionLimiter);

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("express-rate-limit", () => rateLimit);

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  withAppointmentOrgPermissions,
  withInvoiceOrgPermissions,
  withPaymentIntentOrgPermissions,
  requirePermission,
}));

jest.mock("../../src/controllers/app/invoice.controller", () => ({
  InvoiceController,
}));

const invoiceRouter = jest.requireActual("../../src/routers/invoice.router")
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
    (invoiceRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("invoice.router", () => {
  it("protects PMS invoice appointment, payment-intent, and organisation routes with RBAC", () => {
    const mobileAppointmentRoute = findRoute(
      "/mobile/appointment/:appointmentId",
      "post",
    );
    const addChargesRoute = findRoute(
      "/appointment/:appointmentId/charges",
      "post",
    );
    const appointmentListRoute = findRoute(
      "/appointment/:appointmentId",
      "post",
    );
    const paymentIntentRoute = findRoute(
      "/payment-intent/:paymentIntentId",
      "get",
    );
    const organisationListRoute = findRoute(
      "/organisation/:organisationId/list",
      "get",
    );
    const creditNoteRoute = findRoute("/:invoiceId/credit-notes", "post");
    const voidCreditNoteRoute = findRoute(
      "/:invoiceId/credit-notes/:creditNoteId/void",
      "post",
    );

    expect(
      mobileAppointmentRoute?.stack.map((layer) => layer.handle),
    ).toContain(authorizeCognitoMobile);
    expect(
      mobileAppointmentRoute?.stack.map((layer) => layer.handle),
    ).toContain(invoiceActionLimiter);
    expect(addChargesRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(appointmentListRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(appointmentListRoute?.stack.map((layer) => layer.handle)).toContain(
      invoiceActionLimiter,
    );
    expect(paymentIntentRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(organisationListRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(creditNoteRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(creditNoteRoute?.stack.map((layer) => layer.handle)).toContain(
      invoiceActionLimiter,
    );
    expect(voidCreditNoteRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(voidCreditNoteRoute?.stack.map((layer) => layer.handle)).toContain(
      invoiceActionLimiter,
    );

    expect(rateLimit).toHaveBeenCalledTimes(1);
    expect(withAppointmentOrgPermissions).toHaveBeenCalledTimes(3);
    expect(withPaymentIntentOrgPermissions).toHaveBeenCalledTimes(1);
    expect(withOrgPermissions).toHaveBeenCalledTimes(1);
    expect(withInvoiceOrgPermissions).toHaveBeenCalledTimes(4);
    expect(requirePermission).toHaveBeenCalledWith("billing:edit:any");
    expect(requirePermission).toHaveBeenCalledWith("billing:view:any");
  });
});
