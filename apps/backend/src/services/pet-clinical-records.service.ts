import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import type { AuditActorType } from "../models/audit-trail";
import type {
  ParasiteTreatmentDTO,
  RabiesTitrationDTO,
  RecordParasiteTreatmentRequestDTO,
  RecordRabiesTitrationRequestDTO,
  RecordVaccinationRequestDTO,
  VaccinationDTO,
} from "@yosemite-crew/types";

// Capture path for the passport's clinical records. Each record is created as a
// ClinicalArtifact child (Immunization / RabiesTitration / ParasiteTreatment)
// hung off the appointment's encounter, with a provisional attestation that
// records the administering vet. Documenso signing flips the artifact to SIGNED
// later; until then the record exists but is not yet legally attested.
export class PetClinicalRecordError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PetClinicalRecordError";
  }
}

type Actor = { type: AuditActorType; id?: string | null };

export type CaptureContext = {
  patientId: string;
  organisationId: string;
  encounterId: string;
  actor: Actor;
};

const parseDate = (value: string, field: string): Date => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new PetClinicalRecordError(`Invalid ${field}.`, 400);
  }
  return date;
};

const optionalDate = (value: string | undefined, field: string): Date | null =>
  value ? parseDate(value, field) : null;

// Confirm the encounter belongs to the patient in the caller's org before
// hanging a clinical record off it (prevents cross-tenant / cross-pet writes).
const assertEncounter = async (ctx: CaptureContext): Promise<void> => {
  const encounter = await prisma.encounter.findFirst({
    where: {
      id: ctx.encounterId,
      patientId: ctx.patientId,
      organisationId: ctx.organisationId,
    },
    select: { id: true },
  });
  if (!encounter) {
    throw new PetClinicalRecordError("Encounter not found for companion.", 404);
  }
};

// The administering vet is the provisional attestation signatory; primarySource
// is true because the record originates in our appointment workflow.
const attestationOf = (
  ctx: CaptureContext,
  signatoryName: string | undefined,
  signatoryLicence: string | undefined,
) => ({
  create: {
    primarySource: true,
    signatoryUserId: ctx.actor.id ?? null,
    signatoryName: signatoryName ?? null,
    signatoryLicence: signatoryLicence ?? null,
  },
});

const vetOf = (
  attestation: {
    signatoryName: string | null;
    signatoryLicence: string | null;
  } | null,
) => ({
  administeringVetName: attestation?.signatoryName ?? undefined,
  vetLicenseNumber: attestation?.signatoryLicence ?? undefined,
});

const audit = async (
  ctx: CaptureContext,
  eventType:
    | "VACCINATION_RECORDED"
    | "TREATMENT_RECORDED"
    | "TITRATION_RECORDED",
  entityId: string,
  metadata: Record<string, unknown>,
): Promise<void> => {
  await AuditTrailService.recordSafely({
    organisationId: ctx.organisationId,
    patientId: ctx.patientId,
    eventType,
    actorType: ctx.actor.type,
    actorId: ctx.actor.id ?? null,
    entityType: "COMPANION",
    entityId,
    metadata,
  });
};

export const PetClinicalRecordService = {
  async recordImmunization(
    ctx: CaptureContext,
    input: RecordVaccinationRequestDTO,
  ): Promise<VaccinationDTO> {
    await assertEncounter(ctx);
    const artifact = await prisma.clinicalArtifact.create({
      data: {
        organisationId: ctx.organisationId,
        encounterId: ctx.encounterId,
        kind: "IMMUNIZATION",
        status: "DRAFT",
        authorId: ctx.actor.id ?? null,
        immunization: {
          create: {
            vaccineType: input.vaccineType,
            vaccineName: input.vaccineName,
            manufacturer: input.manufacturer ?? null,
            batchNumber: input.batchNumber ?? null,
            lotNumber: input.lotNumber ?? null,
            dateAdministered: parseDate(
              input.dateAdministered,
              "dateAdministered",
            ),
            validFrom: optionalDate(input.validFrom, "validFrom"),
            validUntil: optionalDate(input.validUntil, "validUntil"),
            nextDueDate: optionalDate(input.nextDueDate, "nextDueDate"),
            site: input.site ?? null,
            route: input.route ?? null,
            notes: input.notes ?? null,
          },
        },
        attestation: attestationOf(
          ctx,
          input.administeringVetName,
          input.vetLicenseNumber,
        ),
      },
      include: { immunization: true, attestation: true },
    });
    const row = artifact.immunization;
    if (!row) {
      throw new PetClinicalRecordError("Immunization not persisted.", 500);
    }
    await audit(ctx, "VACCINATION_RECORDED", row.id, {
      vaccineType: input.vaccineType,
      vaccineName: input.vaccineName,
    });
    return {
      id: row.id,
      patientId: ctx.patientId,
      vaccineType: row.vaccineType,
      vaccineName: row.vaccineName,
      manufacturer: row.manufacturer ?? undefined,
      batchNumber: row.batchNumber ?? undefined,
      lotNumber: row.lotNumber ?? undefined,
      dateAdministered: row.dateAdministered.toISOString(),
      validFrom: row.validFrom?.toISOString(),
      validUntil: row.validUntil?.toISOString(),
      nextDueDate: row.nextDueDate?.toISOString(),
      site: row.site ?? undefined,
      route: row.route ?? undefined,
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      ...vetOf(artifact.attestation),
    };
  },

  async recordParasiteTreatment(
    ctx: CaptureContext,
    input: RecordParasiteTreatmentRequestDTO,
  ): Promise<ParasiteTreatmentDTO> {
    await assertEncounter(ctx);
    const artifact = await prisma.clinicalArtifact.create({
      data: {
        organisationId: ctx.organisationId,
        encounterId: ctx.encounterId,
        kind: "PARASITE_TREATMENT",
        status: "DRAFT",
        authorId: ctx.actor.id ?? null,
        parasiteTreatment: {
          create: {
            treatmentType: input.treatmentType,
            productName: input.productName,
            manufacturer: input.manufacturer ?? null,
            treatedAt: parseDate(input.treatedAt, "treatedAt"),
            notes: input.notes ?? null,
          },
        },
        attestation: attestationOf(ctx, input.administeringVetName, undefined),
      },
      include: { parasiteTreatment: true, attestation: true },
    });
    const row = artifact.parasiteTreatment;
    if (!row) {
      throw new PetClinicalRecordError("Treatment not persisted.", 500);
    }
    await audit(ctx, "TREATMENT_RECORDED", row.id, {
      treatmentType: input.treatmentType,
      productName: input.productName,
    });
    return {
      id: row.id,
      patientId: ctx.patientId,
      treatmentType: row.treatmentType,
      productName: row.productName,
      manufacturer: row.manufacturer ?? undefined,
      treatedAt: row.treatedAt.toISOString(),
      notes: row.notes ?? undefined,
      createdAt: row.createdAt.toISOString(),
      ...vetOf(artifact.attestation),
    };
  },

  async recordRabiesTitration(
    ctx: CaptureContext,
    input: RecordRabiesTitrationRequestDTO,
  ): Promise<RabiesTitrationDTO> {
    await assertEncounter(ctx);
    if (input.resultIuMl < 0) {
      throw new PetClinicalRecordError(
        "A titration result cannot be negative.",
        400,
      );
    }
    const artifact = await prisma.clinicalArtifact.create({
      data: {
        organisationId: ctx.organisationId,
        encounterId: ctx.encounterId,
        kind: "RABIES_TITRATION",
        status: "DRAFT",
        authorId: ctx.actor.id ?? null,
        rabiesTitration: {
          create: {
            approvedLab: input.approvedLab,
            sampleDate: parseDate(input.sampleDate, "sampleDate"),
            resultIuMl: input.resultIuMl,
            reportUrl: input.reportUrl ?? null,
          },
        },
        attestation: attestationOf(ctx, undefined, undefined),
      },
      include: { rabiesTitration: true },
    });
    const row = artifact.rabiesTitration;
    if (!row) {
      throw new PetClinicalRecordError("Titration not persisted.", 500);
    }
    await audit(ctx, "TITRATION_RECORDED", row.id, {
      approvedLab: input.approvedLab,
      resultIuMl: input.resultIuMl,
    });
    return {
      id: row.id,
      patientId: ctx.patientId,
      approvedLab: row.approvedLab,
      sampleDate: row.sampleDate.toISOString(),
      resultIuMl: row.resultIuMl,
      reportUrl: row.reportUrl ?? undefined,
      createdAt: row.createdAt.toISOString(),
    };
  },

  // A verified vet attests a recorded clinical artifact, which flips it to SIGNED
  // (the state the passport surfaces). The Documenso e-signature over the rendered
  // record hardens this later; for now the authenticated vet action is the
  // attestation and the signatory + licence are captured on the attestation row.
  async attestRecord(params: {
    artifactId: string;
    patientId: string;
    organisationId: string;
    actor: Actor;
    signatoryName?: string;
    signatoryLicence?: string;
  }): Promise<{ artifactId: string; status: "SIGNED"; signedAt: string }> {
    const { artifactId, patientId, organisationId, actor } = params;
    const artifact = await prisma.clinicalArtifact.findFirst({
      where: {
        id: artifactId,
        organisationId,
        kind: {
          in: ["IMMUNIZATION", "RABIES_TITRATION", "PARASITE_TREATMENT"],
        },
      },
      select: { id: true, status: true },
    });
    if (!artifact) {
      throw new PetClinicalRecordError("Clinical record not found.", 404);
    }
    if (artifact.status === "SIGNED") {
      throw new PetClinicalRecordError(
        "Clinical record is already attested.",
        409,
      );
    }
    const signedAt = new Date();
    const attestationData = {
      primarySource: true,
      signatoryUserId: actor.id ?? null,
      signatoryName: params.signatoryName ?? null,
      signatoryLicence: params.signatoryLicence ?? null,
      signingStatus: "SIGNED",
      signedAt,
      revokedAt: null,
      revokedReason: null,
    };
    await prisma.clinicalArtifact.update({
      where: { id: artifactId },
      data: {
        status: "SIGNED",
        signedBy: actor.id ?? null,
        signedAt,
        attestation: {
          upsert: { create: attestationData, update: attestationData },
        },
      },
    });
    await audit(
      { patientId, organisationId, encounterId: "", actor },
      "VACCINATION_RECORDED",
      artifactId,
      { attested: true },
    );
    return { artifactId, status: "SIGNED", signedAt: signedAt.toISOString() };
  },

  // Revoke an attestation (error, lapsed, fraud). The artifact drops out of the
  // passport and the wallet / public page reflect it on next read.
  async revokeRecord(params: {
    artifactId: string;
    organisationId: string;
    reason?: string;
  }): Promise<{ artifactId: string; status: "VOID" }> {
    const { artifactId, organisationId } = params;
    const artifact = await prisma.clinicalArtifact.findFirst({
      where: {
        id: artifactId,
        organisationId,
        kind: {
          in: ["IMMUNIZATION", "RABIES_TITRATION", "PARASITE_TREATMENT"],
        },
      },
      select: { id: true },
    });
    if (!artifact) {
      throw new PetClinicalRecordError("Clinical record not found.", 404);
    }
    await prisma.clinicalArtifact.update({
      where: { id: artifactId },
      data: {
        status: "VOID",
        attestation: {
          update: {
            signingStatus: "REVOKED",
            revokedAt: new Date(),
            revokedReason: params.reason ?? null,
          },
        },
      },
    });
    return { artifactId, status: "VOID" };
  },
};
