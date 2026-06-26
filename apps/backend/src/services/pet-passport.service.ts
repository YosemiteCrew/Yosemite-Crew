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

// Clinical records now live as signed ClinicalArtifact children (Immunization /
// RabiesTitration / ParasiteTreatment); the attesting vet + licence come from the
// artifact's attestation. The records are written through the clinical-artifact
// workflow (appointment capture or pet-parent upload + vet verification), so this
// service only READS and assembles them onto the passport.
// TODO(passport): surface only attested (signed) artifacts and aggregate across
// practices by microchip once the attestation + cross-org read land.
type AttestationRef = {
  artifact: {
    attestation: {
      signatoryName: string | null;
      signatoryLicence: string | null;
    } | null;
  };
};

const toVaccinationDTO = (
  patientId: string,
  row: {
    id: string;
    vaccineType: VaccineType;
    vaccineName: string;
    manufacturer: string | null;
    batchNumber: string | null;
    lotNumber: string | null;
    dateAdministered: Date;
    validFrom: Date | null;
    validUntil: Date | null;
    nextDueDate: Date | null;
    site: string | null;
    route: string | null;
    notes: string | null;
    createdAt: Date;
  } & AttestationRef,
): VaccinationDTO => ({
  id: row.id,
  patientId,
  vaccineType: row.vaccineType,
  vaccineName: row.vaccineName,
  manufacturer: row.manufacturer ?? undefined,
  batchNumber: row.batchNumber ?? undefined,
  lotNumber: row.lotNumber ?? undefined,
  dateAdministered: row.dateAdministered.toISOString(),
  validFrom: row.validFrom?.toISOString(),
  validUntil: row.validUntil?.toISOString(),
  nextDueDate: row.nextDueDate?.toISOString(),
  administeringVetName: row.artifact.attestation?.signatoryName ?? undefined,
  vetLicenseNumber: row.artifact.attestation?.signatoryLicence ?? undefined,
  site: row.site ?? undefined,
  route: row.route ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: row.createdAt.toISOString(),
});

const toTreatmentDTO = (
  patientId: string,
  row: {
    id: string;
    treatmentType: ParasiteTreatmentType;
    productName: string;
    manufacturer: string | null;
    treatedAt: Date;
    notes: string | null;
    createdAt: Date;
  } & AttestationRef,
): ParasiteTreatmentDTO => ({
  id: row.id,
  patientId,
  treatmentType: row.treatmentType,
  productName: row.productName,
  manufacturer: row.manufacturer ?? undefined,
  treatedAt: row.treatedAt.toISOString(),
  administeringVetName: row.artifact.attestation?.signatoryName ?? undefined,
  notes: row.notes ?? undefined,
  createdAt: row.createdAt.toISOString(),
});

const toTitrationDTO = (
  patientId: string,
  row: {
    id: string;
    approvedLab: string;
    sampleDate: Date;
    resultIuMl: number;
    reportUrl: string | null;
    createdAt: Date;
  },
): RabiesTitrationDTO => ({
  id: row.id,
  patientId,
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

const withAttestation = {
  include: {
    artifact: {
      select: {
        attestation: {
          select: { signatoryName: true, signatoryLicence: true },
        },
      },
    },
  },
} as const;

// Assembles the full passport for a (patient, organisation). Shared by the
// authenticated getPassport and the public verification path. Clinical records
// are read from the ClinicalArtifact children linked to the patient's encounters;
// owner data is included only for authenticated callers (the public record is
// owner-free).
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

  // ClinicalArtifact has no patientId; resolve the patient's encounters in this
  // org, then read the clinical-record artifacts hung off them.
  const encounters = await prisma.encounter.findMany({
    where: { patientId, organisationId },
    select: { id: true },
  });
  const encounterIds = encounters.map((e) => e.id);
  const artifactWhere = { artifact: { encounterId: { in: encounterIds } } };

  const [
    immunizationRows,
    treatmentRows,
    titrationRows,
    passportRow,
    organisation,
  ] = await Promise.all([
    encounterIds.length
      ? prisma.immunization.findMany({
          where: artifactWhere,
          orderBy: { dateAdministered: "desc" },
          ...withAttestation,
        })
      : Promise.resolve([]),
    encounterIds.length
      ? prisma.parasiteTreatment.findMany({
          where: artifactWhere,
          orderBy: { treatedAt: "desc" },
          ...withAttestation,
        })
      : Promise.resolve([]),
    encounterIds.length
      ? prisma.rabiesTitration.findMany({
          where: artifactWhere,
          orderBy: { sampleDate: "desc" },
        })
      : Promise.resolve([]),
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
  const vaccinations = immunizationRows.map((row) =>
    toVaccinationDTO(patientId, row),
  );
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
    parasiteTreatments: treatmentRows.map((row) =>
      toTreatmentDTO(patientId, row),
    ),
    rabiesTitrations: titrationRows.map((row) =>
      toTitrationDTO(patientId, row),
    ),
    issuance,
    owner,
  };
};

export const PetPassportService = {
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

  // Assemble the multi-section passport from the source-of-truth Patient and the
  // attested clinical-record artifacts. The latest rabies dose is surfaced
  // separately (it drives validity); the rest are listed together.
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
