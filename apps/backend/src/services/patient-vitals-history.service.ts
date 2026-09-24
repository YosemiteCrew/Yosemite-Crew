import { prisma } from "src/config/prisma";
import { CompanionService } from "src/services/companion.service";
import { ClinicalArtifactService } from "src/services/clinical-artifact.service";
import {
  CompanionHistoryServiceError,
  ensureCompanionVisible,
} from "src/services/companion-history.service";

/**
 * Units by storage key. A vital record names its unit in the key (see
 * VITAL_UNITS in @yosemite-crew/types), so a value under a key missing here is
 * returned with no unit rather than a guessed one.
 */
const VITAL_RECORD_UNITS: Record<string, string> = {
  tempC: "°C",
  tempF: "°F",
  weightKg: "kg",
  weightLbs: "lb",
  heartRateBpm: "beats/min",
  respRateBpm: "breaths/min",
  crtSec: "s",
  bcs: "score",
  painScore: "score",
};

export type VitalMeasurement = {
  code: string;
  value: number | string;
  unit: string | null;
};

export type VitalsHistorySource =
  | {
      type: "VITAL_RECORD";
      id: string;
      appointmentId: string | null;
      encounterId: string | null;
      status: string;
    }
  | {
      type: "INPATIENT_MONITORING";
      id: string;
      admissionId: string | null;
      encounterId: string | null;
    };

export type VitalsHistoryEntry = {
  measuredAt: string;
  recordedBy: string | null;
  recordedByDisplay: string | null;
  source: VitalsHistorySource;
  measurements: VitalMeasurement[];
};

export type VitalsHistoryResult = {
  entries: VitalsHistoryEntry[];
  truncated: boolean;
};

const unitFor = (code: string) =>
  Object.prototype.hasOwnProperty.call(VITAL_RECORD_UNITS, code)
    ? VITAL_RECORD_UNITS[code]
    : null;

const readMeasurement = (
  code: string,
  raw: unknown,
): VitalMeasurement | null => {
  if (typeof raw === "number") {
    return Number.isFinite(raw)
      ? { code, value: raw, unit: unitFor(code) }
      : null;
  }
  if (typeof raw === "string" && raw.trim() !== "") {
    return { code, value: raw.trim(), unit: unitFor(code) };
  }
  return null;
};

const measurementsFromVitals = (vitals: unknown): VitalMeasurement[] => {
  if (!vitals || typeof vitals !== "object" || Array.isArray(vitals)) return [];
  return Object.entries(vitals as Record<string, unknown>)
    .map(([code, raw]) => readMeasurement(code, raw))
    .filter((m): m is VitalMeasurement => m !== null);
};

type MonitoringRow = {
  id: string;
  admissionId: string | null;
  encounterId: string | null;
  observedAt: Date;
  observedBy: string | null;
  temperature: { toNumber(): number } | null;
  temperatureUnit: string | null;
  heartRate: number | null;
  respiratoryRate: number | null;
  spo2: number | null;
  bloodPressureSystolic: number | null;
  bloodPressureDiastolic: number | null;
  etco2: number | null;
  painScore: number | null;
  crtSecs: { toNumber(): number } | null;
};

const temperatureCode = (unit: string | null) => {
  if (unit === "C") return { code: "tempC", unit: "°C" };
  if (unit === "F") return { code: "tempF", unit: "°F" };
  return { code: "temp", unit: null };
};

const measurementsFromMonitoring = (row: MonitoringRow): VitalMeasurement[] => {
  const out: VitalMeasurement[] = [];
  const push = (code: string, value: number | null, unit: string | null) => {
    if (value !== null && Number.isFinite(value))
      out.push({ code, value, unit });
  };
  const temp = temperatureCode(row.temperatureUnit);
  push(temp.code, row.temperature?.toNumber() ?? null, temp.unit);
  push("heartRateBpm", row.heartRate, "beats/min");
  push("respRateBpm", row.respiratoryRate, "breaths/min");
  push("crtSec", row.crtSecs?.toNumber() ?? null, "s");
  push("painScore", row.painScore, "score");
  push("spo2", row.spo2, "%");
  push("bloodPressureSystolic", row.bloodPressureSystolic, "mmHg");
  push("bloodPressureDiastolic", row.bloodPressureDiastolic, "mmHg");
  push("etco2", row.etco2, "mmHg");
  return out;
};

const listVisitIds = async (organisationId: string, patientId: string) => {
  const [appointments, encounters] = await Promise.all([
    prisma.appointment.findMany({
      where: { organisationId, patient: { path: ["id"], equals: patientId } },
      select: { id: true },
    }),
    prisma.encounter.findMany({
      where: { organisationId, patientId },
      select: { id: true },
    }),
  ]);
  return {
    appointmentIds: appointments.map((a) => a.id),
    encounterIds: encounters.map((e) => e.id),
  };
};

export const PatientVitalsHistoryService = {
  /**
   * A patient's weight and vital signs across visits, newest first, each value
   * with its unit and the record it came from. Inpatient monitoring is only
   * included when the caller may see appointments.
   */
  async listForPatient(params: {
    organisationId: string;
    patientId: string;
    limit: number;
    includeInpatient: boolean;
  }): Promise<VitalsHistoryResult> {
    const { organisationId, patientId, limit, includeInpatient } = params;

    const companion = await CompanionService.getById(patientId);
    if (!companion?.response) {
      throw new CompanionHistoryServiceError("Companion not found", 404);
    }
    if (!(await ensureCompanionVisible(organisationId, patientId))) {
      throw new CompanionHistoryServiceError("Companion not found", 404);
    }

    // One extra row per source says whether anything was cut off.
    const take = limit + 1;
    const visits = await listVisitIds(organisationId, patientId);
    const [vitalRecords, monitoring] = await Promise.all([
      ClinicalArtifactService.listVitalRecordsForVisits(
        organisationId,
        visits,
        take,
      ),
      includeInpatient
        ? prisma.hospitalizationMonitoring.findMany({
            where: { organisationId, patientId },
            orderBy: { observedAt: "desc" },
            take,
          })
        : Promise.resolve([] as MonitoringRow[]),
    ]);

    const entries: VitalsHistoryEntry[] = [
      ...vitalRecords.map(({ artifact, vitalRecord }) => ({
        measuredAt: vitalRecord.measuredAt.toISOString(),
        recordedBy: vitalRecord.recordedBy,
        recordedByDisplay: vitalRecord.recordedByDisplay ?? null,
        source: {
          type: "VITAL_RECORD" as const,
          id: vitalRecord.id,
          appointmentId: artifact.appointmentId ?? null,
          encounterId: artifact.encounterId ?? null,
          status: artifact.status,
        },
        measurements: measurementsFromVitals(vitalRecord.vitals),
      })),
      ...monitoring.map((row) => ({
        measuredAt: row.observedAt.toISOString(),
        recordedBy: row.observedBy,
        recordedByDisplay: null,
        source: {
          type: "INPATIENT_MONITORING" as const,
          id: row.id,
          admissionId: row.admissionId,
          encounterId: row.encounterId,
        },
        measurements: measurementsFromMonitoring(row),
      })),
    ]
      .filter((entry) => entry.measurements.length > 0)
      .sort((a, b) => b.measuredAt.localeCompare(a.measuredAt));

    return {
      entries: entries.slice(0, limit),
      truncated:
        entries.length > limit ||
        vitalRecords.length === take ||
        monitoring.length === take,
    };
  },
};
