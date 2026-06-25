import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { AuditActorType } from "../models/audit-trail";
import type {
  RecordVaccinationRequestDTO,
  VaccinationDTO,
  VaccineType,
} from "@yosemite-crew/types";

export class PetPassportServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PetPassportServiceError";
  }
}

export type PassportActor = { type: AuditActorType; id?: string | null };

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
const MIN_RABIES_AGE_WEEKS = 12; // EU: animal at least 12 weeks at vaccination.
const RABIES_VALIDITY_START_DAYS = 21; // EU: valid from 21 days after a primary dose.

const addDays = (date: Date, days: number): Date =>
  new Date(date.getTime() + days * 24 * 60 * 60 * 1000);

const parseDate = (value: string, field: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PetPassportServiceError(`Invalid ${field}.`, 400);
  }
  return date;
};

// EU pet passport rabies rules (Annex III, Reg 576/2013): the animal must be at
// least 12 weeks old, and the dose cannot pre-date the microchip - a vaccination
// applied before marking cannot be attributed to the animal.
const assertRabiesEligibility = (
  patient: { dateOfBirth: Date; microchipImplantedAt: Date | null },
  administeredAt: Date,
): void => {
  if (
    administeredAt.getTime() - patient.dateOfBirth.getTime() <
    MIN_RABIES_AGE_WEEKS * WEEK_MS
  ) {
    throw new PetPassportServiceError(
      "A rabies vaccination requires the animal to be at least 12 weeks old.",
      400,
    );
  }
  if (
    patient.microchipImplantedAt &&
    administeredAt.getTime() < patient.microchipImplantedAt.getTime()
  ) {
    throw new PetPassportServiceError(
      "A rabies vaccination cannot pre-date the microchip implant.",
      400,
    );
  }
};

// Patient reads are not org-scoped, so a write must confirm the companion belongs
// to the caller's org or it leaks across tenants.
const assertOrgMembership = async (
  patientId: string,
  organisationId: string,
): Promise<void> => {
  const membership = await prisma.patientOrganisation.findFirst({
    where: { patientId, organisationId, status: { in: ["ACTIVE", "PENDING"] } },
    select: { id: true },
  });
  if (!membership) {
    throw new PetPassportServiceError("Companion not found.", 404);
  }
};

const toVaccinationDTO = (row: {
  id: string;
  patientId: string;
  vaccineType: VaccineType;
  vaccineName: string;
  manufacturer: string | null;
  batchNumber: string | null;
  lotNumber: string | null;
  dateAdministered: Date;
  validFrom: Date | null;
  validUntil: Date | null;
  nextDueDate: Date | null;
  administeringVetName: string | null;
  vetLicenseNumber: string | null;
  site: string | null;
  route: string | null;
  notes: string | null;
  createdAt: Date;
}): VaccinationDTO => ({
  id: row.id,
  patientId: row.patientId,
  vaccineType: row.vaccineType,
  vaccineName: row.vaccineName,
  manufacturer: row.manufacturer ?? undefined,
  batchNumber: row.batchNumber ?? undefined,
  lotNumber: row.lotNumber ?? undefined,
  dateAdministered: row.dateAdministered.toISOString(),
  validFrom: row.validFrom?.toISOString(),
  validUntil: row.validUntil?.toISOString(),
  nextDueDate: row.nextDueDate?.toISOString(),
  administeringVetName: row.administeringVetName ?? undefined,
  vetLicenseNumber: row.vetLicenseNumber ?? undefined,
  site: row.site ?? undefined,
  route: row.route ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: row.createdAt.toISOString(),
});

export const PetPassportService = {
  async recordVaccination(params: {
    patientId: string;
    organisationId: string;
    actor: PassportActor;
    input: RecordVaccinationRequestDTO;
  }): Promise<VaccinationDTO> {
    const { patientId, organisationId, actor, input } = params;

    await assertOrgMembership(patientId, organisationId);

    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { id: true, dateOfBirth: true, microchipImplantedAt: true },
    });
    if (!patient) {
      throw new PetPassportServiceError("Companion not found.", 404);
    }

    const administeredAt = parseDate(
      input.dateAdministered,
      "dateAdministered",
    );
    if (input.vaccineType === "RABIES") {
      assertRabiesEligibility(patient, administeredAt);
    }

    // A rabies primary dose is valid from 21 days after administration; default
    // that window when the caller has not supplied an explicit validFrom.
    let validFrom: Date | null = null;
    if (input.validFrom) {
      validFrom = parseDate(input.validFrom, "validFrom");
    } else if (input.vaccineType === "RABIES") {
      validFrom = addDays(administeredAt, RABIES_VALIDITY_START_DAYS);
    }

    const row = await prisma.vaccination.create({
      data: {
        patientId,
        organisationId,
        vaccineType: input.vaccineType,
        vaccineName: input.vaccineName,
        manufacturer: input.manufacturer ?? null,
        batchNumber: input.batchNumber ?? null,
        lotNumber: input.lotNumber ?? null,
        dateAdministered: administeredAt,
        validFrom,
        validUntil: input.validUntil
          ? parseDate(input.validUntil, "validUntil")
          : null,
        nextDueDate: input.nextDueDate
          ? parseDate(input.nextDueDate, "nextDueDate")
          : null,
        administeringVetId: actor.id ?? null,
        administeringVetName: input.administeringVetName ?? null,
        vetLicenseNumber: input.vetLicenseNumber ?? null,
        site: input.site ?? null,
        route: input.route ?? null,
        notes: input.notes ?? null,
      },
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "VACCINATION_RECORDED",
      actorType: actor.type,
      actorId: actor.id ?? null,
      entityType: "COMPANION",
      entityId: row.id,
      metadata: {
        vaccineType: input.vaccineType,
        vaccineName: input.vaccineName,
      },
    });

    return toVaccinationDTO(row);
  },

  async listVaccinations(
    patientId: string,
    organisationId: string,
  ): Promise<VaccinationDTO[]> {
    const rows = await prisma.vaccination.findMany({
      where: { patientId, organisationId },
      orderBy: { dateAdministered: "desc" },
    });
    return rows.map(toVaccinationDTO);
  },
};
