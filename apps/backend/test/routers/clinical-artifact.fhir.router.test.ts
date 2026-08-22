import type { Router } from "express";

const requireWebAuth = jest.fn((_req, _res, next) => next());
const withOrgPermissions = jest.fn(() => jest.fn((_req, _res, next) => next()));
const requirePermission = jest.fn(() => jest.fn((_req, _res, next) => next()));
const dischargeSummaryLimiter = jest.fn((_req, _res, next) => next());

type LimiterRequest = {
  params: Record<string, string | undefined>;
  headers: Record<string, string | undefined>;
  userId?: string;
};

type LimiterOptions = {
  windowMs: number;
  max: number;
  standardHeaders: boolean;
  legacyHeaders: boolean;
  keyGenerator: (req: LimiterRequest) => string;
};

const rateLimit = jest.fn(
  (_options: LimiterOptions) => dischargeSummaryLimiter,
);

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
  deletePrescription: jest.fn(),
  cancelPrescription: jest.fn(),
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
  listImmunizationsForAppointment: jest.fn(),
  listImmunizationsForEncounter: jest.fn(),
  listRabiesTitrationsForAppointment: jest.fn(),
  listRabiesTitrationsForEncounter: jest.fn(),
  listParasiteTreatmentsForAppointment: jest.fn(),
  listParasiteTreatmentsForEncounter: jest.fn(),
  listClinicalExaminationsForAppointment: jest.fn(),
  listClinicalExaminationsForEncounter: jest.fn(),
};

jest.mock("../../src/middlewares/auth", () => ({
  requireWebAuth,
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

const protectedRoutes = [
  [
    "/organisation/:organisationId/appointment/:appointmentId/soap-notes",
    "post",
  ],
  ["/organisation/:organisationId/encounter/:encounterId/soap-notes", "post"],
  ["/organisation/:organisationId/soap-note", "post"],
  ["/organisation/:organisationId/soap-note/:soapNoteId", "post"],
  [
    String.raw`/organisation/:organisationId/soap-note/:soapNoteId/\$finalize`,
    "post",
  ],
  [
    String.raw`/organisation/:organisationId/soap-note/:soapNoteId/\$reopen`,
    "post",
  ],
  [
    String.raw`/organisation/:organisationId/soap-note/:soapNoteId/\$amend`,
    "post",
  ],
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
    String.raw`/organisation/:organisationId/prescription/:prescriptionId/\$finalize`,
    "post",
  ],
  [
    String.raw`/organisation/:organisationId/prescription/:prescriptionId/\$cancel`,
    "post",
  ],
  [
    String.raw`/organisation/:organisationId/prescription/:prescriptionId/\$reopen`,
    "post",
  ],
  [
    String.raw`/organisation/:organisationId/prescription/:prescriptionId/\$amend`,
    "post",
  ],
  ["/organisation/:organisationId/prescription/:prescriptionId", "patch"],
  ["/organisation/:organisationId/prescription/:prescriptionId", "delete"],
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
    String.raw`/organisation/:organisationId/discharge-summary/:dischargeSummaryId/\$finalize`,
    "post",
  ],
  [
    String.raw`/organisation/:organisationId/discharge-summary/:dischargeSummaryId/\$reopen`,
    "post",
  ],
  [
    String.raw`/organisation/:organisationId/discharge-summary/:dischargeSummaryId/\$amend`,
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
    String.raw`/organisation/:organisationId/vital-record/:vitalRecordId/\$finalize`,
    "post",
  ],
  [
    String.raw`/organisation/:organisationId/vital-record/:vitalRecordId/\$reopen`,
    "post",
  ],
  [
    String.raw`/organisation/:organisationId/vital-record/:vitalRecordId/\$amend`,
    "post",
  ],
  ["/organisation/:organisationId/vital-record/:vitalRecordId", "patch"],
  [
    "/organisation/:organisationId/appointment/:appointmentId/immunizations",
    "post",
  ],
  [
    "/organisation/:organisationId/encounter/:encounterId/immunizations",
    "post",
  ],
  [
    "/organisation/:organisationId/appointment/:appointmentId/rabies-titrations",
    "post",
  ],
  [
    "/organisation/:organisationId/encounter/:encounterId/rabies-titrations",
    "post",
  ],
  [
    "/organisation/:organisationId/appointment/:appointmentId/parasite-treatments",
    "post",
  ],
  [
    "/organisation/:organisationId/encounter/:encounterId/parasite-treatments",
    "post",
  ],
  [
    "/organisation/:organisationId/appointment/:appointmentId/clinical-examinations",
    "post",
  ],
  [
    "/organisation/:organisationId/encounter/:encounterId/clinical-examinations",
    "post",
  ],
] as const;

const passportReadRoutes = [
  [
    "/organisation/:organisationId/appointment/:appointmentId/immunizations",
    "post",
    "listImmunizationsForAppointment",
  ],
  [
    "/organisation/:organisationId/encounter/:encounterId/immunizations",
    "post",
    "listImmunizationsForEncounter",
  ],
  [
    "/organisation/:organisationId/appointment/:appointmentId/rabies-titrations",
    "post",
    "listRabiesTitrationsForAppointment",
  ],
  [
    "/organisation/:organisationId/encounter/:encounterId/rabies-titrations",
    "post",
    "listRabiesTitrationsForEncounter",
  ],
  [
    "/organisation/:organisationId/appointment/:appointmentId/parasite-treatments",
    "post",
    "listParasiteTreatmentsForAppointment",
  ],
  [
    "/organisation/:organisationId/encounter/:encounterId/parasite-treatments",
    "post",
    "listParasiteTreatmentsForEncounter",
  ],
  [
    "/organisation/:organisationId/appointment/:appointmentId/clinical-examinations",
    "post",
    "listClinicalExaminationsForAppointment",
  ],
  [
    "/organisation/:organisationId/encounter/:encounterId/clinical-examinations",
    "post",
    "listClinicalExaminationsForEncounter",
  ],
] as const;

describe("clinical-artifact.fhir.router", () => {
  it("exposes the clinical artifact routes", () => {
    for (const [path, method] of protectedRoutes) {
      expect(findRoute(path, method)).toBeDefined();
    }
  });

  it("protects routes with auth and RBAC", () => {
    const route = findRoute(
      "/organisation/:organisationId/prescription",
      "post",
    );
    expect(route?.stack[0]?.handle).toBe(requireWebAuth);
    expect(route?.stack.length).toBeGreaterThanOrEqual(3);
    expect(requirePermission).toHaveBeenCalledWith([
      "prescription:edit:any",
      "prescription:edit:own",
    ]);
    expect(requirePermission).toHaveBeenCalledWith(["forms:view:any"]);
  });

  it("rate limits every authenticated route", () => {
    for (const [path, method] of protectedRoutes) {
      const route = findRoute(path, method);
      expect(route?.stack.map((layer) => layer.handle)).toContain(
        requireWebAuth,
      );
      expect(route?.stack.map((layer) => layer.handle)).toContain(
        dischargeSummaryLimiter,
      );
    }

    expect(rateLimit).toHaveBeenCalledTimes(1);
  });

  it("keeps the limit generous enough for staff PMS use", () => {
    const limiterOptions = rateLimit.mock.calls[0]?.[0];

    expect(limiterOptions?.windowMs).toBe(15 * 60 * 1000);
    expect(limiterOptions?.max).toBe(120);
    expect(limiterOptions?.standardHeaders).toBe(true);
    expect(limiterOptions?.legacyHeaders).toBe(false);
  });

  it("scopes the limiter key to the organisation and the caller", () => {
    const keyGenerator = rateLimit.mock.calls[0]?.[0].keyGenerator;

    expect(
      keyGenerator?.({
        params: { organisationId: "org-1" },
        headers: {},
        userId: "user-1",
      }),
    ).toBe("org-1:user-1");
    // The `x-org-id` header is deliberately NOT part of the key. The limiter
    // runs before any org validation, so a client-settable header let one
    // session mint a fresh bucket per value and sail past the limit.
    expect(
      keyGenerator?.({
        params: {},
        headers: { "x-org-id": "org-2" },
        userId: "user-2",
      }),
    ).toBe("unknown-org:user-2");
    expect(keyGenerator?.({ params: {}, headers: {} })).toBe(
      "unknown-org:unknown-user",
    );
  });

  it("rate limits and delegates every passport read route", () => {
    for (const [path, method, controllerMethod] of passportReadRoutes) {
      const handlers =
        findRoute(path, method)?.stack.map((layer) => layer.handle) ?? [];

      expect(handlers).toContain(requireWebAuth);
      expect(handlers).toContain(dischargeSummaryLimiter);
      expect(handlers.indexOf(dischargeSummaryLimiter)).toBeGreaterThan(
        handlers.indexOf(requireWebAuth),
      );

      const req = { path };
      const res = {};
      (handlers.at(-1) as (req: unknown, res: unknown) => void)(req, res);

      expect(
        ClinicalArtifactFhirController[controllerMethod],
      ).toHaveBeenCalledWith(req, res);
    }
  });
});
