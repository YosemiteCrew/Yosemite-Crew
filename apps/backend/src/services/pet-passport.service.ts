import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { AuditActorType } from "../models/audit-trail";
import type {
  IssuePassportRequestDTO,
  ParasiteTreatmentDTO,
  ParasiteTreatmentType,
  PetPassportDTO,
  PetPassportOwner,
  PetPassportIssuanceDTO,
  RabiesTitrationDTO,
  RecordParasiteTreatmentRequestDTO,
  RecordRabiesTitrationRequestDTO,
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

const toTreatmentDTO = (row: {
  id: string;
  patientId: string;
  treatmentType: ParasiteTreatmentType;
  productName: string;
  manufacturer: string | null;
  treatedAt: Date;
  administeringVetName: string | null;
  notes: string | null;
  createdAt: Date;
}): ParasiteTreatmentDTO => ({
  id: row.id,
  patientId: row.patientId,
  treatmentType: row.treatmentType,
  productName: row.productName,
  manufacturer: row.manufacturer ?? undefined,
  treatedAt: row.treatedAt.toISOString(),
  administeringVetName: row.administeringVetName ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: row.createdAt.toISOString(),
});

const toTitrationDTO = (row: {
  id: string;
  patientId: string;
  approvedLab: string;
  sampleDate: Date;
  resultIuMl: number;
  reportUrl: string | null;
  createdAt: Date;
}): RabiesTitrationDTO => ({
  id: row.id,
  patientId: row.patientId,
  approvedLab: row.approvedLab,
  sampleDate: row.sampleDate.toISOString(),
  resultIuMl: row.resultIuMl,
  reportUrl: row.reportUrl ?? undefined,
  createdAt: row.createdAt.toISOString(),
});

const toIssuanceDTO = (row: {
  passportNumber: string;
  issuingCountry: string | null;
  issuingAuthority: string | null;
  issuingVetName: string | null;
  issuingVetLicense: string | null;
  issueDate: Date;
  status: string | null;
}): PetPassportIssuanceDTO => ({
  passportNumber: row.passportNumber,
  issuingCountry: row.issuingCountry ?? undefined,
  issuingAuthority: row.issuingAuthority ?? undefined,
  issuingVetName: row.issuingVetName ?? undefined,
  issuingVetLicense: row.issuingVetLicense ?? undefined,
  issueDate: row.issueDate.toISOString(),
  status: row.status ?? undefined,
});

// The registered primary owner/holder. Authenticated views only.
const loadPassportOwner = async (
  patientId: string,
): Promise<PetPassportOwner | undefined> => {
  const link = await prisma.parentPatient.findFirst({
    where: { patientId, role: "PRIMARY", status: "ACTIVE" },
    select: { parentId: true },
  });
  if (!link) return undefined;
  const parent = await prisma.parent.findUnique({
    where: { id: link.parentId },
    select: { firstName: true, lastName: true, email: true, phoneNumber: true },
  });
  if (!parent) return undefined;
  const name = [parent.firstName, parent.lastName]
    .filter((part): part is string => Boolean(part))
    .join(" ");
  return {
    name,
    email: parent.email ?? undefined,
    phone: parent.phoneNumber ?? undefined,
  };
};

// Assembles the full passport for a (patient, organisation). Shared by the
// authenticated getPassport and the public verification path. Owner data is
// included only for authenticated callers (the public record is owner-free).
const assemblePassport = async (
  patientId: string,
  organisationId: string,
  includeOwner = false,
): Promise<PetPassportDTO> => {
  const owner = includeOwner ? await loadPassportOwner(patientId) : undefined;
  const patient = await prisma.patient.findUnique({
    where: { id: patientId },
    select: {
      id: true,
      name: true,
      type: true,
      breed: true,
      gender: true,
      colour: true,
      photoUrl: true,
      dateOfBirth: true,
      microchipNumber: true,
      microchipImplantedAt: true,
      microchipLocation: true,
      passportNumber: true,
      physicalAttribute: true,
    },
  });
  if (!patient) {
    throw new PetPassportServiceError("Companion not found.", 404);
  }

  // physicalAttribute is an unstructured Json column; read the markings field
  // defensively for the description's "distinguishing marks".
  const physical = patient.physicalAttribute as { markings?: unknown } | null;
  const distinguishingMarks =
    typeof physical?.markings === "string" && physical.markings.length > 0
      ? physical.markings
      : undefined;

  const [
    vaccinationRows,
    treatmentRows,
    titrationRows,
    passportRow,
    organisation,
  ] = await Promise.all([
    prisma.vaccination.findMany({
      where: { patientId, organisationId },
      orderBy: { dateAdministered: "desc" },
    }),
    prisma.parasiteTreatment.findMany({
      where: { patientId, organisationId },
      orderBy: { treatedAt: "desc" },
    }),
    prisma.rabiesTitration.findMany({
      where: { patientId, organisationId },
      orderBy: { sampleDate: "desc" },
    }),
    prisma.petPassport.findFirst({
      where: { patientId, organisationId },
      orderBy: { issueDate: "desc" },
    }),
    prisma.organization.findUnique({
      where: { id: organisationId },
      select: { name: true },
    }),
  ]);
  const issuance = passportRow
    ? { ...toIssuanceDTO(passportRow), issuingPractice: organisation?.name }
    : undefined;
  const vaccinations = vaccinationRows.map(toVaccinationDTO);
  const rabies = vaccinations.find((v) => v.vaccineType === "RABIES");
  const others = vaccinations.filter((v) => v.vaccineType !== "RABIES");

  return {
    identity: {
      id: patient.id,
      name: patient.name,
      species: patient.type,
      breed: patient.breed,
      sex: patient.gender,
      dateOfBirth: patient.dateOfBirth.toISOString(),
      colour: patient.colour ?? undefined,
      distinguishingMarks,
      photoUrl: patient.photoUrl ?? undefined,
    },
    microchip: patient.microchipNumber
      ? {
          number: patient.microchipNumber,
          implantedAt: patient.microchipImplantedAt?.toISOString(),
          location: patient.microchipLocation ?? undefined,
        }
      : undefined,
    passportNumber:
      issuance?.passportNumber ?? patient.passportNumber ?? undefined,
    rabies,
    vaccinations: others,
    parasiteTreatments: treatmentRows.map(toTreatmentDTO),
    rabiesTitrations: titrationRows.map(toTitrationDTO),
    issuance,
    owner,
  };
};

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

  async recordParasiteTreatment(params: {
    patientId: string;
    organisationId: string;
    actor: PassportActor;
    input: RecordParasiteTreatmentRequestDTO;
  }): Promise<ParasiteTreatmentDTO> {
    const { patientId, organisationId, actor, input } = params;
    await assertOrgMembership(patientId, organisationId);

    const row = await prisma.parasiteTreatment.create({
      data: {
        patientId,
        organisationId,
        treatmentType: input.treatmentType,
        productName: input.productName,
        manufacturer: input.manufacturer ?? null,
        treatedAt: parseDate(input.treatedAt, "treatedAt"),
        administeringVetId: actor.id ?? null,
        administeringVetName: input.administeringVetName ?? null,
        notes: input.notes ?? null,
      },
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "TREATMENT_RECORDED",
      actorType: actor.type,
      actorId: actor.id ?? null,
      entityType: "COMPANION",
      entityId: row.id,
      metadata: {
        treatmentType: input.treatmentType,
        productName: input.productName,
      },
    });

    return toTreatmentDTO(row);
  },

  async listParasiteTreatments(
    patientId: string,
    organisationId: string,
  ): Promise<ParasiteTreatmentDTO[]> {
    const rows = await prisma.parasiteTreatment.findMany({
      where: { patientId, organisationId },
      orderBy: { treatedAt: "desc" },
    });
    return rows.map(toTreatmentDTO);
  },

  async recordRabiesTitration(params: {
    patientId: string;
    organisationId: string;
    actor: PassportActor;
    input: RecordRabiesTitrationRequestDTO;
  }): Promise<RabiesTitrationDTO> {
    const { patientId, organisationId, actor, input } = params;
    await assertOrgMembership(patientId, organisationId);

    if (input.resultIuMl < 0) {
      throw new PetPassportServiceError(
        "A titration result cannot be negative.",
        400,
      );
    }

    const row = await prisma.rabiesTitration.create({
      data: {
        patientId,
        organisationId,
        approvedLab: input.approvedLab,
        sampleDate: parseDate(input.sampleDate, "sampleDate"),
        resultIuMl: input.resultIuMl,
        reportUrl: input.reportUrl ?? null,
      },
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "TITRATION_RECORDED",
      actorType: actor.type,
      actorId: actor.id ?? null,
      entityType: "COMPANION",
      entityId: row.id,
      metadata: {
        approvedLab: input.approvedLab,
        resultIuMl: input.resultIuMl,
      },
    });

    return toTitrationDTO(row);
  },

  async listRabiesTitrations(
    patientId: string,
    organisationId: string,
  ): Promise<RabiesTitrationDTO[]> {
    const rows = await prisma.rabiesTitration.findMany({
      where: { patientId, organisationId },
      orderBy: { sampleDate: "desc" },
    });
    return rows.map(toTitrationDTO);
  },

  async issuePassport(params: {
    patientId: string;
    organisationId: string;
    actor: PassportActor;
    input: IssuePassportRequestDTO;
  }): Promise<PetPassportIssuanceDTO> {
    const { patientId, organisationId, actor, input } = params;
    await assertOrgMembership(patientId, organisationId);

    const row = await prisma.petPassport.create({
      data: {
        patientId,
        organisationId,
        passportNumber: input.passportNumber,
        issuingCountry: input.issuingCountry ?? null,
        issuingAuthority: input.issuingAuthority ?? null,
        issuingVetId: actor.id ?? null,
        issuingVetName: input.issuingVetName ?? null,
        issuingVetLicense: input.issuingVetLicense ?? null,
      },
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "PASSPORT_ISSUED",
      actorType: actor.type,
      actorId: actor.id ?? null,
      entityType: "COMPANION",
      entityId: row.id,
      metadata: { passportNumber: input.passportNumber },
    });

    return toIssuanceDTO(row);
  },

  // Assemble the multi-section passport from the source-of-truth Patient and its
  // vaccination rows. The latest rabies dose is surfaced separately (it drives
  // validity); the rest are listed together.
  async getPassport(
    patientId: string,
    organisationId: string,
  ): Promise<PetPassportDTO> {
    await assertOrgMembership(patientId, organisationId);
    return assemblePassport(patientId, organisationId, true);
  },

  // Public, unauthenticated verification. Only formally-issued passports are
  // exposed: the issuing organisation is resolved from the latest passport row,
  // and the assembled DTO carries no owner/contact data.
  async getPublicPassport(patientId: string): Promise<PetPassportDTO> {
    const row = await prisma.petPassport.findFirst({
      where: { patientId },
      orderBy: { issueDate: "desc" },
      select: { organisationId: true },
    });
    if (!row) {
      throw new PetPassportServiceError("Passport not found.", 404);
    }
    return assemblePassport(patientId, row.organisationId);
  },
};
