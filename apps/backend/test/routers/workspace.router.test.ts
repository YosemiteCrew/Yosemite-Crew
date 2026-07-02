import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const authorizeCognitoMobile = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));

const WorkspaceController = {
  getAppointmentBootstrap: jest.fn(),
  getEncounterBootstrap: jest.fn(),
  getEncounterFinalizationGate: jest.fn(),
  getAppointmentDocuments: jest.fn(),
  getEncounterDocuments: jest.fn(),
  getCompanionDocuments: jest.fn(),
  getCompanionMedicalRecords: jest.fn(),
  getEncounterTreatmentItems: jest.fn(),
  createEncounterTreatmentItem: jest.fn(),
  updateTreatmentItem: jest.fn(),
  deleteTreatmentItem: jest.fn(),
  createDocumentPacket: jest.fn(),
  getEncounterDocumentPacketPdf: jest.fn(),
  getMobileEncounterDocumentPacketPdf: jest.fn(),
  getDocumentPacket: jest.fn(),
  signDocumentPacket: jest.fn(),
};

jest.mock("src/middlewares/auth", () => ({
  authorizeCognito,
  authorizeCognitoMobile,
}));

jest.mock("src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("src/controllers/web/workspace.controller", () => ({
  WorkspaceController,
}));

const workspaceRouter = jest.requireActual("../../src/routers/workspace.router")
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
    (workspaceRouter as unknown as { stack: Layer[] }).stack ?? []
  ).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );

  return layer?.route;
};

describe("workspace.router", () => {
  it("registers the workspace document and packet routes", () => {
    const appointmentRoute = findRoute(
      "/organisations/:organisationId/appointments/:appointmentId",
      "get",
    );
    const appointmentDocumentsRoute = findRoute(
      "/organisations/:organisationId/appointments/:appointmentId/documents",
      "get",
    );
    const encounterRoute = findRoute(
      "/organisations/:organisationId/encounters/:encounterId",
      "get",
    );
    const encounterDocumentsRoute = findRoute(
      "/organisations/:organisationId/encounters/:encounterId/documents",
      "get",
    );
    const finalizationGateRoute = findRoute(
      "/organisations/:organisationId/encounters/:encounterId/finalization-gate",
      "get",
    );
    const companionDocumentsRoute = findRoute(
      "/organisations/:organisationId/companions/:companionId/documents",
      "get",
    );
    const companionMedicalRoute = findRoute(
      "/organisations/:organisationId/companions/:companionId/medical-records",
      "get",
    );
    const treatmentItemsRoute = findRoute(
      "/organisations/:organisationId/encounters/:encounterId/treatment-items",
      "get",
    );
    const treatmentItemsCreateRoute = findRoute(
      "/organisations/:organisationId/encounters/:encounterId/treatment-items",
      "post",
    );
    const treatmentItemsUpdateRoute = findRoute(
      "/organisations/:organisationId/treatment-items/:itemId",
      "patch",
    );
    const treatmentItemsDeleteRoute = findRoute(
      "/organisations/:organisationId/treatment-items/:itemId",
      "delete",
    );
    const packetCreateRoute = findRoute(
      "/organisations/:organisationId/encounters/:encounterId/document-packet",
      "post",
    );
    const packetPdfRoute = findRoute(
      "/organisations/:organisationId/encounters/:encounterId/document-packet/pdf",
      "get",
    );
    const packetGetRoute = findRoute(
      "/organisations/:organisationId/document-packets/:packetId",
      "get",
    );
    const packetSignRoute = findRoute(
      "/organisations/:organisationId/document-packets/:packetId/sign",
      "post",
    );
    const mobilePacketPdfRoute = findRoute(
      "/mobile/encounters/:encounterId/document-packet/pdf",
      "get",
    );

    expect(appointmentRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(
      appointmentDocumentsRoute?.stack.map((layer) => layer.handle),
    ).toContain(authorizeCognito);
    expect(encounterRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(
      encounterDocumentsRoute?.stack.map((layer) => layer.handle),
    ).toContain(authorizeCognito);
    expect(finalizationGateRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(
      companionDocumentsRoute?.stack.map((layer) => layer.handle),
    ).toContain(authorizeCognito);
    expect(companionMedicalRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(treatmentItemsRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(
      treatmentItemsCreateRoute?.stack.map((layer) => layer.handle),
    ).toContain(authorizeCognito);
    expect(
      treatmentItemsUpdateRoute?.stack.map((layer) => layer.handle),
    ).toContain(authorizeCognito);
    expect(
      treatmentItemsDeleteRoute?.stack.map((layer) => layer.handle),
    ).toContain(authorizeCognito);
    expect(packetCreateRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(packetPdfRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(packetGetRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(packetSignRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognito,
    );
    expect(mobilePacketPdfRoute?.stack.map((layer) => layer.handle)).toContain(
      authorizeCognitoMobile,
    );
    expect(withOrgPermissions).toHaveBeenCalledTimes(16);
    expect(requirePermission).toHaveBeenCalled();
    expect(WorkspaceController.getAppointmentBootstrap).toHaveBeenCalledTimes(
      0,
    );
  });
});
