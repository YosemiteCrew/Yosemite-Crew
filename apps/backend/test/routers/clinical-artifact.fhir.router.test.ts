import type { Router } from "express";

const authorizeCognito = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));
const dischargeSummaryLimiter = jest.fn((_req, _res, next) => next());
const rateLimit = jest.fn(() => dischargeSummaryLimiter);

const ClinicalArtifactFhirController = {
  listSoapNotesForAppointment: jest.fn(),
  listSoapNotesForEncounter: jest.fn(),
  createSoapNote: jest.fn(),
  getSoapNote: jest.fn(),
  updateSoapNote: jest.fn(),
  finalizeSoapNote: jest.fn(),
  reopenSoapNote: jest.fn(),
  amendSoapNote: jest.fn(),
  listPrescriptionsForAppointment: jest.fn(),
  listPrescriptionsForEncounter: jest.fn(),
  createPrescription: jest.fn(),
  getPrescription: jest.fn(),
  updatePrescription: jest.fn(),
  finalizePrescription: jest.fn(),
  reopenPrescription: jest.fn(),
  amendPrescription: jest.fn(),
  listDischargeSummariesForAppointment: jest.fn(),
  listDischargeSummariesForEncounter: jest.fn(),
  createDischargeSummary: jest.fn(),
  getDischargeSummary: jest.fn(),
  updateDischargeSummary: jest.fn(),
  finalizeDischargeSummary: jest.fn(),
  reopenDischargeSummary: jest.fn(),
  amendDischargeSummary: jest.fn(),
  listVitalRecordsForAppointment: jest.fn(),
  listVitalRecordsForEncounter: jest.fn(),
  createVitalRecord: jest.fn(),
  getVitalRecord: jest.fn(),
  updateVitalRecord: jest.fn(),
  finalizeVitalRecord: jest.fn(),
  reopenVitalRecord: jest.fn(),
  amendVitalRecord: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  authorizeCognito,
}));

jest.mock("../../src/middlewares/rbac", () => ({
  withOrgPermissions,
  requirePermission,
}));

jest.mock("express-rate-limit", () => ({
  __esModule: true,
  default: rateLimit,
}));

jest.mock(
  "../../src/controllers/web/clinical-artifact.fhir.controller",
  () => ({
    ClinicalArtifactFhirController,
  }),
);

const router = jest.requireActual(
  "../../src/routers/clinical-artifact.fhir.router",
).default as Router;

type Layer = {
  route?: {
    path: string;
    methods: Record<string, boolean>;
    stack: Array<{ handle: unknown }>;
  };
};

const findRoute = (path: string, method: string) => {
  const layer = ((router as unknown as { stack: Layer[] }).stack ?? []).find(
    (entry) =>
      entry.route?.path === path && Boolean(entry.route?.methods?.[method]),
  );
  return layer?.route;
};

describe("clinical-artifact.fhir.router", () => {
  it("exposes the clinical artifact routes", () => {
    const protectedRoutes = [
      [
        "/organisation/:organisationId/appointment/:appointmentId/soap-notes",
        "post",
      ],
      [
        "/organisation/:organisationId/encounter/:encounterId/soap-notes",
        "post",
      ],
      ["/organisation/:organisationId/soap-note", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId/$finalize", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId/$reopen", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId/$amend", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId", "patch"],
      [
        "/organisation/:organisationId/appointment/:appointmentId/prescriptions",
        "post",
      ],
      [
        "/organisation/:organisationId/encounter/:encounterId/prescriptions",
        "post",
      ],
      ["/organisation/:organisationId/prescription", "post"],
      ["/organisation/:organisationId/prescription/:prescriptionId", "post"],
      [
        "/organisation/:organisationId/prescription/:prescriptionId/$finalize",
        "post",
      ],
      [
        "/organisation/:organisationId/prescription/:prescriptionId/$reopen",
        "post",
      ],
      [
        "/organisation/:organisationId/prescription/:prescriptionId/$amend",
        "post",
      ],
      ["/organisation/:organisationId/prescription/:prescriptionId", "patch"],
      [
        "/organisation/:organisationId/appointment/:appointmentId/discharge-summaries",
        "post",
      ],
      [
        "/organisation/:organisationId/encounter/:encounterId/discharge-summaries",
        "post",
      ],
      ["/organisation/:organisationId/discharge-summary", "post"],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
        "post",
      ],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId/$finalize",
        "post",
      ],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId/$reopen",
        "post",
      ],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId/$amend",
        "post",
      ],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
        "patch",
      ],
      [
        "/organisation/:organisationId/appointment/:appointmentId/vital-records",
        "post",
      ],
      [
        "/organisation/:organisationId/encounter/:encounterId/vital-records",
        "post",
      ],
      ["/organisation/:organisationId/vital-record", "post"],
      ["/organisation/:organisationId/vital-record/:vitalRecordId", "post"],
      [
        "/organisation/:organisationId/vital-record/:vitalRecordId/$finalize",
        "post",
      ],
      [
        "/organisation/:organisationId/vital-record/:vitalRecordId/$reopen",
        "post",
      ],
      [
        "/organisation/:organisationId/vital-record/:vitalRecordId/$amend",
        "post",
      ],
      ["/organisation/:organisationId/vital-record/:vitalRecordId", "patch"],
    ] as const;

    for (const [path, method] of protectedRoutes) {
      expect(findRoute(path, method)).toBeDefined();
    }
  });

  it("protects routes with auth and RBAC", () => {
    const route = findRoute(
      "/organisation/:organisationId/prescription",
      "post",
    );
    expect(route?.stack[0]?.handle).toBe(authorizeCognito);
    expect(route?.stack.length).toBeGreaterThanOrEqual(3);
    expect(requirePermission).toHaveBeenCalledWith(["prescription:edit:any"]);
    expect(requirePermission).toHaveBeenCalledWith(["forms:view:any"]);
  });

  it("rate limits every authenticated route", () => {
    const protectedRoutes = [
      [
        "/organisation/:organisationId/appointment/:appointmentId/soap-notes",
        "post",
      ],
      [
        "/organisation/:organisationId/encounter/:encounterId/soap-notes",
        "post",
      ],
      ["/organisation/:organisationId/soap-note", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId/$finalize", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId/$reopen", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId/$amend", "post"],
      ["/organisation/:organisationId/soap-note/:soapNoteId", "patch"],
      [
        "/organisation/:organisationId/appointment/:appointmentId/prescriptions",
        "post",
      ],
      [
        "/organisation/:organisationId/encounter/:encounterId/prescriptions",
        "post",
      ],
      ["/organisation/:organisationId/prescription", "post"],
      ["/organisation/:organisationId/prescription/:prescriptionId", "post"],
      [
        "/organisation/:organisationId/prescription/:prescriptionId/$finalize",
        "post",
      ],
      [
        "/organisation/:organisationId/prescription/:prescriptionId/$reopen",
        "post",
      ],
      [
        "/organisation/:organisationId/prescription/:prescriptionId/$amend",
        "post",
      ],
      ["/organisation/:organisationId/prescription/:prescriptionId", "patch"],
      [
        "/organisation/:organisationId/appointment/:appointmentId/discharge-summaries",
        "post",
      ],
      [
        "/organisation/:organisationId/encounter/:encounterId/discharge-summaries",
        "post",
      ],
      ["/organisation/:organisationId/discharge-summary", "post"],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
        "post",
      ],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId/$finalize",
        "post",
      ],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId/$reopen",
        "post",
      ],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId/$amend",
        "post",
      ],
      [
        "/organisation/:organisationId/discharge-summary/:dischargeSummaryId",
        "patch",
      ],
      [
        "/organisation/:organisationId/appointment/:appointmentId/vital-records",
        "post",
      ],
      [
        "/organisation/:organisationId/encounter/:encounterId/vital-records",
        "post",
      ],
      ["/organisation/:organisationId/vital-record", "post"],
      ["/organisation/:organisationId/vital-record/:vitalRecordId", "post"],
      [
        "/organisation/:organisationId/vital-record/:vitalRecordId/$finalize",
        "post",
      ],
      [
        "/organisation/:organisationId/vital-record/:vitalRecordId/$reopen",
        "post",
      ],
      [
        "/organisation/:organisationId/vital-record/:vitalRecordId/$amend",
        "post",
      ],
      ["/organisation/:organisationId/vital-record/:vitalRecordId", "patch"],
    ] as const;

    for (const [path, method] of protectedRoutes) {
      const route = findRoute(path, method);
      expect(route?.stack.map((layer) => layer.handle)).toContain(
        authorizeCognito,
      );
      expect(route?.stack.map((layer) => layer.handle)).toContain(
        dischargeSummaryLimiter,
      );
    }

    expect(rateLimit).toHaveBeenCalledTimes(1);
  });
});
