import { PatientVitalsHistoryService } from "../../src/services/patient-vitals-history.service";
import { CompanionService } from "../../src/services/companion.service";
import { ClinicalArtifactService } from "../../src/services/clinical-artifact.service";
import { prisma } from "../../src/config/prisma";

jest.mock("../../src/services/companion.service");
jest.mock("../../src/services/clinical-artifact.service", () => ({
  ClinicalArtifactService: { listVitalRecordsForVisits: jest.fn() },
}));
jest.mock("../../src/utils/logger");
jest.mock("../../src/config/prisma", () => ({
  prisma: {
    patientOrganisation: { findFirst: jest.fn() },
    appointment: { findMany: jest.fn() },
    encounter: { findMany: jest.fn() },
    hospitalizationMonitoring: { findMany: jest.fn() },
  },
}));

const mockedPrisma = prisma as unknown as {
  patientOrganisation: { findFirst: jest.Mock };
  appointment: { findMany: jest.Mock };
  encounter: { findMany: jest.Mock };
  hospitalizationMonitoring: { findMany: jest.Mock };
};
const listVitalRecordsForVisits =
  ClinicalArtifactService.listVitalRecordsForVisits as jest.Mock;

const decimal = (n: number) => ({ toNumber: () => n });

const vitalRecord = (
  id: string,
  measuredAt: string,
  vitals: unknown,
  artifact: Record<string, unknown> = {},
) => ({
  artifact: {
    appointmentId: "appt-1",
    encounterId: null,
    status: "COMPLETED",
    ...artifact,
  },
  vitalRecord: {
    id,
    measuredAt: new Date(measuredAt),
    recordedBy: "user-1",
    recordedByDisplay: "Nurse Joy",
    vitals,
  },
});

const monitoringRow = (
  id: string,
  observedAt: string,
  overrides: Record<string, unknown> = {},
) => ({
  id,
  admissionId: "adm-1",
  encounterId: "enc-9",
  observedAt: new Date(observedAt),
  observedBy: "user-2",
  temperature: null,
  temperatureUnit: null,
  heartRate: null,
  respiratoryRate: null,
  spo2: null,
  bloodPressureSystolic: null,
  bloodPressureDiastolic: null,
  etco2: null,
  painScore: null,
  crtSecs: null,
  ...overrides,
});

describe("PatientVitalsHistoryService.listForPatient", () => {
  const organisationId = "org-1";
  const patientId = "pet-1";
  const base = { organisationId, patientId, limit: 10, includeInpatient: true };

  beforeEach(() => {
    jest.clearAllMocks();
    (CompanionService.getById as jest.Mock).mockResolvedValue({
      response: { id: patientId },
    });
    mockedPrisma.patientOrganisation.findFirst.mockResolvedValue({ id: "l" });
    mockedPrisma.appointment.findMany.mockResolvedValue([{ id: "appt-1" }]);
    mockedPrisma.encounter.findMany.mockResolvedValue([{ id: "enc-1" }]);
    mockedPrisma.hospitalizationMonitoring.findMany.mockResolvedValue([]);
    listVitalRecordsForVisits.mockResolvedValue([]);
  });

  it("throws 404 when the companion does not exist", async () => {
    (CompanionService.getById as jest.Mock).mockResolvedValue(null);
    await expect(
      PatientVitalsHistoryService.listForPatient(base),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(listVitalRecordsForVisits).not.toHaveBeenCalled();
  });

  it("throws 404 when the companion is not linked to the organisation", async () => {
    mockedPrisma.patientOrganisation.findFirst.mockResolvedValue(null);
    await expect(
      PatientVitalsHistoryService.listForPatient(base),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(listVitalRecordsForVisits).not.toHaveBeenCalled();
  });

  it("looks up the patient's visits in this organisation and asks for one row past the limit", async () => {
    await PatientVitalsHistoryService.listForPatient(base);

    expect(mockedPrisma.appointment.findMany).toHaveBeenCalledWith({
      where: { organisationId, patient: { path: ["id"], equals: patientId } },
      select: { id: true },
    });
    expect(mockedPrisma.encounter.findMany).toHaveBeenCalledWith({
      where: { organisationId, patientId },
      select: { id: true },
    });
    expect(listVitalRecordsForVisits).toHaveBeenCalledWith(
      organisationId,
      { appointmentIds: ["appt-1"], encounterIds: ["enc-1"] },
      11,
    );
    expect(
      mockedPrisma.hospitalizationMonitoring.findMany,
    ).toHaveBeenCalledWith({
      where: { organisationId, patientId },
      orderBy: { observedAt: "desc" },
      take: 11,
    });
  });

  it("merges visit and inpatient readings newest first, each value with its unit and source", async () => {
    listVitalRecordsForVisits.mockResolvedValue([
      vitalRecord("v-2", "2026-03-01T09:00:00.000Z", {
        weightKg: 12.4,
        tempC: 38.6,
        crtSec: "<2",
        heartRateBpm: 110,
      }),
      vitalRecord(
        "v-1",
        "2026-01-01T09:00:00.000Z",
        { weightLbs: 27 },
        { appointmentId: null, encounterId: "enc-1", status: "SIGNED" },
      ),
    ]);
    mockedPrisma.hospitalizationMonitoring.findMany.mockResolvedValue([
      monitoringRow("m-1", "2026-02-01T09:00:00.000Z", {
        temperature: decimal(101.5),
        temperatureUnit: "F",
        heartRate: 120,
        spo2: 97,
        bloodPressureSystolic: 130,
        bloodPressureDiastolic: 80,
        crtSecs: decimal(1.5),
      }),
    ]);

    const result = await PatientVitalsHistoryService.listForPatient(base);

    expect(result.truncated).toBe(false);
    expect(result.entries.map((e) => e.source.id)).toEqual([
      "v-2",
      "m-1",
      "v-1",
    ]);
    expect(result.entries[0]).toEqual({
      measuredAt: "2026-03-01T09:00:00.000Z",
      recordedBy: "user-1",
      recordedByDisplay: "Nurse Joy",
      source: {
        type: "VITAL_RECORD",
        id: "v-2",
        appointmentId: "appt-1",
        encounterId: null,
        status: "COMPLETED",
      },
      measurements: [
        { code: "weightKg", value: 12.4, unit: "kg" },
        { code: "tempC", value: 38.6, unit: "°C" },
        { code: "crtSec", value: "<2", unit: "s" },
        { code: "heartRateBpm", value: 110, unit: "beats/min" },
      ],
    });
    expect(result.entries[1]).toEqual({
      measuredAt: "2026-02-01T09:00:00.000Z",
      recordedBy: "user-2",
      recordedByDisplay: null,
      source: {
        type: "INPATIENT_MONITORING",
        id: "m-1",
        admissionId: "adm-1",
        encounterId: "enc-9",
      },
      measurements: [
        { code: "tempF", value: 101.5, unit: "°F" },
        { code: "heartRateBpm", value: 120, unit: "beats/min" },
        { code: "crtSec", value: 1.5, unit: "s" },
        { code: "spo2", value: 97, unit: "%" },
        { code: "bloodPressureSystolic", value: 130, unit: "mmHg" },
        { code: "bloodPressureDiastolic", value: 80, unit: "mmHg" },
      ],
    });
    expect(result.entries[2].measurements).toEqual([
      { code: "weightLbs", value: 27, unit: "lb" },
    ]);
    expect(result.entries[2].source).toMatchObject({
      encounterId: "enc-1",
      status: "SIGNED",
    });
  });

  it("returns a key it has no unit for with no unit rather than a guessed one", async () => {
    listVitalRecordsForVisits.mockResolvedValue([
      vitalRecord("v-1", "2026-01-01T09:00:00.000Z", {
        temperature: 38.2,
        constructor: 1,
      }),
    ]);

    const result = await PatientVitalsHistoryService.listForPatient(base);

    expect(result.entries[0].measurements).toEqual([
      { code: "temperature", value: 38.2, unit: null },
      { code: "constructor", value: 1, unit: null },
    ]);
  });

  it("reports a Celsius inpatient temperature and an unknown unit honestly", async () => {
    mockedPrisma.hospitalizationMonitoring.findMany.mockResolvedValue([
      monitoringRow("m-2", "2026-02-02T09:00:00.000Z", {
        temperature: decimal(38.1),
        temperatureUnit: "C",
      }),
      monitoringRow("m-1", "2026-02-01T09:00:00.000Z", {
        temperature: decimal(38),
        temperatureUnit: null,
      }),
    ]);

    const result = await PatientVitalsHistoryService.listForPatient(base);

    expect(result.entries.map((e) => e.measurements)).toEqual([
      [{ code: "tempC", value: 38.1, unit: "°C" }],
      [{ code: "temp", value: 38, unit: null }],
    ]);
  });

  it("drops readings that carry no usable value", async () => {
    listVitalRecordsForVisits.mockResolvedValue([
      vitalRecord("v-empty", "2026-01-02T09:00:00.000Z", {
        weightKg: "  ",
        tempC: Number.NaN,
        notes: { text: "calm" },
      }),
      vitalRecord("v-array", "2026-01-01T09:00:00.000Z", [1, 2]),
      vitalRecord("v-null", "2026-01-01T08:00:00.000Z", null),
    ]);
    mockedPrisma.hospitalizationMonitoring.findMany.mockResolvedValue([
      monitoringRow("m-empty", "2026-01-03T09:00:00.000Z"),
    ]);

    const result = await PatientVitalsHistoryService.listForPatient(base);

    expect(result.entries).toEqual([]);
  });

  it("does not read inpatient monitoring when the caller may not see it", async () => {
    await PatientVitalsHistoryService.listForPatient({
      ...base,
      includeInpatient: false,
    });

    expect(
      mockedPrisma.hospitalizationMonitoring.findMany,
    ).not.toHaveBeenCalled();
  });

  it("cuts the merged list at the limit and says it was cut", async () => {
    listVitalRecordsForVisits.mockResolvedValue([
      vitalRecord("v-2", "2026-01-02T09:00:00.000Z", { weightKg: 12 }),
      vitalRecord("v-1", "2026-01-01T09:00:00.000Z", { weightKg: 11 }),
    ]);
    mockedPrisma.hospitalizationMonitoring.findMany.mockResolvedValue([
      monitoringRow("m-1", "2026-01-03T09:00:00.000Z", { heartRate: 90 }),
    ]);

    const result = await PatientVitalsHistoryService.listForPatient({
      ...base,
      limit: 2,
    });

    expect(result.entries.map((e) => e.source.id)).toEqual(["m-1", "v-2"]);
    expect(result.truncated).toBe(true);
  });

  it("says the list was cut when a source filled its extra row even if empty rows were dropped", async () => {
    listVitalRecordsForVisits.mockResolvedValue([
      vitalRecord("v-2", "2026-01-02T09:00:00.000Z", { weightKg: 12 }),
      vitalRecord("v-1", "2026-01-01T09:00:00.000Z", {}),
    ]);

    const result = await PatientVitalsHistoryService.listForPatient({
      ...base,
      limit: 1,
    });

    expect(result.entries.map((e) => e.source.id)).toEqual(["v-2"]);
    expect(result.truncated).toBe(true);
  });

  it("says the list was cut when inpatient monitoring filled its extra row", async () => {
    mockedPrisma.hospitalizationMonitoring.findMany.mockResolvedValue([
      monitoringRow("m-2", "2026-01-02T09:00:00.000Z", { heartRate: 90 }),
      monitoringRow("m-1", "2026-01-01T09:00:00.000Z"),
    ]);

    const result = await PatientVitalsHistoryService.listForPatient({
      ...base,
      limit: 1,
    });

    expect(result.entries.map((e) => e.source.id)).toEqual(["m-2"]);
    expect(result.truncated).toBe(true);
  });

  it("says the list is complete when every row fits", async () => {
    listVitalRecordsForVisits.mockResolvedValue([
      vitalRecord("v-1", "2026-01-01T09:00:00.000Z", { weightKg: 11 }),
    ]);

    const result = await PatientVitalsHistoryService.listForPatient({
      ...base,
      limit: 1,
    });

    expect(result.truncated).toBe(false);
  });
});
