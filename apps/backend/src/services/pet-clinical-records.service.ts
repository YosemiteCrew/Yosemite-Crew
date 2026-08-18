import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import { DocumensoService } from "./documenso.service";
import {
  buildPassportRecordPdf,
  type RecordPdfField,
} from "./passport-record-pdf";
import { NotificationTemplates } from "../utils/notificationTemplates";
import {
  notifyPatientOwner,
  passportLinkEmail,
} from "src/services/shared/owner-notification";
import type { AuditActorType } from "../models/audit-trail";
import type {
  ClinicalExamDTO,
  ParasiteTreatmentDTO,
  RabiesTitrationDTO,
  RecordClinicalExamRequestDTO,
  RecordParasiteTreatmentRequestDTO,
  RecordRabiesTitrationRequestDTO,
  RecordVaccinationRequestDTO,
  VaccinationDTO,
} from "@yosemite-crew/types";

const PASSPORT_RECORD_KINDS = [
  "IMMUNIZATION",
  "RABIES_TITRATION",
  "PARASITE_TREATMENT",
  "CLINICAL_EXAM",
] as const;

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

type PassportRecordKind = (typeof PASSPORT_RECORD_KINDS)[number];

type PassportAuditEvent =
  | "VACCINATION_RECORDED"
  | "TREATMENT_RECORDED"
  | "TITRATION_RECORDED"
  | "EXAM_RECORDED";

/**
 * Compliance history has to name the operation that actually happened - a
 * signed rabies titration is not a vaccination.
 */
const AUDIT_EVENT_BY_KIND: Record<PassportRecordKind, PassportAuditEvent> = {
  IMMUNIZATION: "VACCINATION_RECORDED",
  RABIES_TITRATION: "TITRATION_RECORDED",
  PARASITE_TREATMENT: "TREATMENT_RECORDED",
  CLINICAL_EXAM: "EXAM_RECORDED",
};

/**
 * Resolves a passport artifact and proves it belongs to the patient named in
 * the route, not merely to the caller's organisation.
 *
 * Without this, pairing pet A's record id with pet B's URL signs A's artifact
 * while the audit row, the owner notification and the rendered PDF all say B.
 * `ClinicalArtifact.encounterId` is a loose column with no relation, so the
 * patient is resolved through a second lookup.
 */
const assertArtifactBelongsToPatient = async (
  encounterId: string | null,
  patientId: string,
): Promise<void> => {
  const encounter = encounterId
    ? await prisma.encounter.findUnique({
        where: { id: encounterId },
        select: { patientId: true },
      })
    : null;

  // Same uniform 404 as a missing record: a caller must not be able to probe
  // which record ids exist in the org by comparing error codes.
  if (encounter?.patientId !== patientId) {
    throw new PetClinicalRecordError("Clinical record not found.", 404);
  }
};

const loadPassportArtifactForPatient = async <T extends object>(params: {
  artifactId: string;
  patientId: string;
  organisationId: string;
  select: T;
}) => {
  const artifact = (await prisma.clinicalArtifact.findFirst({
    where: {
      id: params.artifactId,
      organisationId: params.organisationId,
      kind: { in: [...PASSPORT_RECORD_KINDS] },
    },
    select: { ...params.select, encounterId: true, kind: true },
  })) as
    | (Record<string, unknown> & {
        encounterId: string | null;
        kind: PassportRecordKind;
      })
    | null;

  if (!artifact) {
    throw new PetClinicalRecordError("Clinical record not found.", 404);
  }

  await assertArtifactBelongsToPatient(artifact.encounterId, params.patientId);

  return artifact;
};

/**
 * VOID is terminal. A revoked record was pulled for error or fraud, so neither a
 * fresh attestation nor a new e-signature run may resurrect it - both write
 * `status: "SIGNED"` and would republish it to the owner, the wallet pass and
 * the public QR page with its revocation history erased.
 */
const assertArtifactNotRevoked = (status: unknown, action: string): void => {
  if (status === "VOID") {
    throw new PetClinicalRecordError(
      `A revoked clinical record cannot be ${action}.`,
      409,
    );
  }
};

const audit = async (
  ctx: CaptureContext,
  eventType: PassportAuditEvent,
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

const resolveSignerEmail = async (signerId: string): Promise<string | null> => {
  const user = await prisma.user.findFirst({
    where: { userId: signerId },
    select: { email: true },
  });
  return user?.email ?? null;
};

const dateOnly = (value: Date | null | undefined): string | undefined =>
  value ? value.toISOString().slice(0, 10) : undefined;

// Builds the PDF title + fields for an attested record so it can be e-signed.
const recordPdfContent = (
  artifact: {
    immunization: {
      vaccineName: string;
      vaccineType: string;
      manufacturer: string | null;
      batchNumber: string | null;
      dateAdministered: Date;
      validUntil: Date | null;
    } | null;
    rabiesTitration: {
      approvedLab: string;
      sampleDate: Date;
      resultIuMl: number;
    } | null;
    parasiteTreatment: {
      treatmentType: string;
      productName: string;
      treatedAt: Date;
    } | null;
    clinicalExamination: {
      examinedAt: Date;
      fitForTravel: boolean;
      weightKg: number | null;
      temperatureC: number | null;
    } | null;
  },
  pet: { name: string; microchipNumber: string | null },
): { title: string; subtitle: string; fields: RecordPdfField[] } => {
  const subtitle = pet.microchipNumber
    ? `${pet.name} · microchip ${pet.microchipNumber}`
    : pet.name;
  const field = (label: string, value: string | undefined): RecordPdfField[] =>
    value ? [{ label, value }] : [];

  if (artifact.immunization) {
    const v = artifact.immunization;
    return {
      title: "Vaccination record",
      subtitle,
      fields: [
        { label: "Vaccine", value: v.vaccineName },
        ...field("Type", v.vaccineType),
        ...field("Manufacturer", v.manufacturer ?? undefined),
        ...field("Batch", v.batchNumber ?? undefined),
        ...field("Administered", dateOnly(v.dateAdministered)),
        ...field("Valid until", dateOnly(v.validUntil)),
      ],
    };
  }
  if (artifact.rabiesTitration) {
    const t = artifact.rabiesTitration;
    return {
      title: "Rabies antibody titration",
      subtitle,
      fields: [
        { label: "Laboratory", value: t.approvedLab },
        { label: "Result", value: `${t.resultIuMl} IU/ml` },
        ...field("Sample date", dateOnly(t.sampleDate)),
      ],
    };
  }
  if (artifact.parasiteTreatment) {
    const p = artifact.parasiteTreatment;
    return {
      title: "Anti-parasite treatment",
      subtitle,
      fields: [
        { label: "Product", value: p.productName },
        { label: "Type", value: p.treatmentType },
        ...field("Treated", dateOnly(p.treatedAt)),
      ],
    };
  }
  const e = artifact.clinicalExamination;
  return {
    title: "Clinical examination",
    subtitle,
    fields: [
      { label: "Fit to travel", value: e?.fitForTravel ? "Yes" : "No" },
      ...field("Examined", dateOnly(e?.examinedAt)),
      ...field("Weight", e?.weightKg != null ? `${e.weightKg} kg` : undefined),
      ...field(
        "Temperature",
        e?.temperatureC != null ? `${e.temperatureC}°C` : undefined,
      ),
    ],
  };
};

// Vitals are attested into the passport and printed onto the signed PDF, so a
// negative or physiologically impossible value must not be persistable. The
// bounds bracket the largest patients a practice records (equine) and the
// survivable temperature range, hypothermia through severe hyperthermia.
const MAX_WEIGHT_KG = 200;
const MIN_TEMPERATURE_C = 15;
const MAX_TEMPERATURE_C = 45;

const assertExamVitalsInRange = (input: {
  weightKg?: number;
  temperatureC?: number;
}): void => {
  if (input.weightKg !== undefined) {
    if (input.weightKg <= 0) {
      throw new PetClinicalRecordError(
        "Weight must be greater than zero.",
        400,
      );
    }
    if (input.weightKg > MAX_WEIGHT_KG) {
      throw new PetClinicalRecordError(
        `Weight must not exceed ${MAX_WEIGHT_KG} kg.`,
        400,
      );
    }
  }
  if (input.temperatureC !== undefined) {
    if (
      input.temperatureC < MIN_TEMPERATURE_C ||
      input.temperatureC > MAX_TEMPERATURE_C
    ) {
      throw new PetClinicalRecordError(
        `Temperature must be between ${MIN_TEMPERATURE_C} and ${MAX_TEMPERATURE_C} °C.`,
        400,
      );
    }
  }
};

// Notifies the pet's owner that their passport gained a new verified record so
// they can view it or refresh their wallet pass (mirrors the post-visit
// certificate email pattern). Best-effort: never blocks or fails the signing
// flow, and silently no-ops when the pet has no linked/owner contact.
export const notifyOwnerOfPassportUpdate = (patientId: string): Promise<void> =>
  notifyPatientOwner({
    patientId,
    label: "Passport-update",
    buildPayload: (patientName) =>
      NotificationTemplates.Care.PASSPORT_UPDATED(patientName),
    buildEmail: passportLinkEmail(
      (patientName) => `${patientName}'s pet passport was updated`,
    ),
  });

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

  async recordClinicalExam(
    ctx: CaptureContext,
    input: RecordClinicalExamRequestDTO,
  ): Promise<ClinicalExamDTO> {
    await assertEncounter(ctx);
    assertExamVitalsInRange(input);
    const artifact = await prisma.clinicalArtifact.create({
      data: {
        organisationId: ctx.organisationId,
        encounterId: ctx.encounterId,
        kind: "CLINICAL_EXAM",
        status: "DRAFT",
        authorId: ctx.actor.id ?? null,
        clinicalExamination: {
          create: {
            examinedAt: parseDate(input.examinedAt, "examinedAt"),
            fitForTravel: input.fitForTravel,
            findings: input.findings ?? null,
            weightKg: input.weightKg ?? null,
            temperatureC: input.temperatureC ?? null,
          },
        },
        attestation: attestationOf(ctx, undefined, undefined),
      },
      include: { clinicalExamination: true, attestation: true },
    });
    const row = artifact.clinicalExamination;
    if (!row) {
      throw new PetClinicalRecordError("Clinical exam not persisted.", 500);
    }
    await audit(ctx, "EXAM_RECORDED", row.id, {
      fitForTravel: input.fitForTravel,
    });
    return {
      id: row.id,
      patientId: ctx.patientId,
      examinedAt: row.examinedAt.toISOString(),
      fitForTravel: row.fitForTravel,
      findings: row.findings ?? undefined,
      weightKg: row.weightKg ?? undefined,
      temperatureC: row.temperatureC ?? undefined,
      createdAt: row.createdAt.toISOString(),
      examiningVetName: artifact.attestation?.signatoryName ?? undefined,
      vetLicenseNumber: artifact.attestation?.signatoryLicence ?? undefined,
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
    const artifact = await loadPassportArtifactForPatient({
      artifactId,
      patientId,
      organisationId,
      select: { id: true, status: true },
    });
    assertArtifactNotRevoked(artifact.status, "re-attested");
    if (artifact.status === "SIGNED") {
      throw new PetClinicalRecordError(
        "Clinical record is already attested.",
        409,
      );
    }
    const signedAt = new Date();
    // `revokedAt`/`revokedReason` are deliberately not cleared here: VOID is
    // terminal (guarded above), so an attestation can never wipe a revocation.
    const attestationData = {
      primarySource: true,
      signatoryUserId: actor.id ?? null,
      signatoryName: params.signatoryName ?? null,
      signatoryLicence: params.signatoryLicence ?? null,
      signingStatus: "SIGNED",
      signedAt,
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
      AUDIT_EVENT_BY_KIND[artifact.kind],
      artifactId,
      { attested: true },
    );
    await notifyOwnerOfPassportUpdate(patientId);
    return { artifactId, status: "SIGNED", signedAt: signedAt.toISOString() };
  },

  // Revoke an attestation (error, lapsed, fraud). The artifact drops out of the
  // passport and the wallet / public page reflect it on next read.
  async revokeRecord(params: {
    artifactId: string;
    patientId: string;
    organisationId: string;
    actor: Actor;
    reason?: string;
  }): Promise<{ artifactId: string; status: "VOID" }> {
    const { artifactId, patientId, organisationId, actor } = params;
    // Same patient scoping as attestRecord: without it, pairing pet B's URL
    // with pet A's record id voids A's signed passport record.
    const artifact = await loadPassportArtifactForPatient({
      artifactId,
      patientId,
      organisationId,
      select: { id: true, status: true },
    });
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
    // Revocations are as clinically significant as attestations, so they get the
    // same PATIENT-scoped audit row rather than vanishing silently.
    await audit(
      { patientId, organisationId, encounterId: "", actor },
      AUDIT_EVENT_BY_KIND[artifact.kind],
      artifactId,
      { revoked: true, ...(params.reason ? { reason: params.reason } : {}) },
    );
    return { artifactId, status: "VOID" };
  },

  // Initiate a Documenso e-signature for a recorded clinical artifact: render it
  // to a PDF and send it to the practice's Documenso instance for the vet to
  // sign. The record stays IN_PROGRESS until the Documenso webhook reports it
  // complete (which flips it to SIGNED, the state the passport surfaces).
  async requestRecordSignature(params: {
    artifactId: string;
    patientId: string;
    organisationId: string;
    actor: Actor;
    signatoryName?: string;
    signatoryLicence?: string;
  }): Promise<{
    artifactId: string;
    status: "IN_PROGRESS";
    documensoDocumentId: string;
  }> {
    const { artifactId, patientId, organisationId, actor } = params;
    const artifact = await prisma.clinicalArtifact.findFirst({
      where: {
        id: artifactId,
        organisationId,
        kind: { in: [...PASSPORT_RECORD_KINDS] },
      },
      include: {
        immunization: true,
        rabiesTitration: true,
        parasiteTreatment: true,
        clinicalExamination: true,
        attestation: true,
      },
    });
    if (!artifact) {
      throw new PetClinicalRecordError("Clinical record not found.", 404);
    }
    await assertArtifactBelongsToPatient(artifact.encounterId, patientId);
    assertArtifactNotRevoked(artifact.status, "sent for signature");
    if (artifact.status === "SIGNED") {
      throw new PetClinicalRecordError(
        "Clinical record is already attested.",
        409,
      );
    }
    // Idempotent: a signing request already in flight is returned as-is rather
    // than minting a second Documenso document, which would mail the vet a
    // duplicate request and orphan the first document id.
    const inFlight = artifact.attestation;
    if (
      inFlight?.signingStatus === "IN_PROGRESS" &&
      inFlight.documensoDocumentId
    ) {
      return {
        artifactId,
        status: "IN_PROGRESS",
        documensoDocumentId: inFlight.documensoDocumentId,
      };
    }
    const apiKey =
      await DocumensoService.resolveOrganisationApiKey(organisationId);
    const signerId = actor.id ?? null;
    const signerEmail = signerId ? await resolveSignerEmail(signerId) : null;
    if (!apiKey || !signerId || !signerEmail) {
      throw new PetClinicalRecordError(
        "Documenso signing is not configured for this practice or signer.",
        400,
      );
    }
    const pet = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { name: true, microchipNumber: true },
    });
    const content = recordPdfContent(
      artifact,
      pet ?? { name: "Companion", microchipNumber: null },
    );
    const pdf = await buildPassportRecordPdf(content);
    const document = await DocumensoService.createDocument({
      pdf,
      signerEmail,
      signerName: params.signatoryName,
      apiKey,
      title: content.title,
    });
    if (!document?.id) {
      throw new PetClinicalRecordError(
        "Failed to create the signing document.",
        502,
      );
    }
    const documensoDocumentId = String(document.id);
    const attestationData = {
      primarySource: true,
      signatoryUserId: signerId,
      signatoryName: params.signatoryName ?? null,
      signatoryLicence: params.signatoryLicence ?? null,
      signingStatus: "IN_PROGRESS",
      documensoDocumentId,
      revokedAt: null,
      revokedReason: null,
    };
    // Persist BEFORE distributing. The webhook can only match a completion on
    // the stored documensoDocumentId, so distributing first and failing to write
    // would mail the vet a live request whose DOCUMENT_COMPLETED is dropped,
    // stranding the record in DRAFT forever. This order leaves a recoverable
    // IN_PROGRESS record whose id is known and safe to re-distribute.
    await prisma.clinicalArtifact.update({
      where: { id: artifactId },
      data: {
        status: "IN_PROGRESS",
        attestation: {
          upsert: { create: attestationData, update: attestationData },
        },
      },
    });
    await DocumensoService.distributeDocument({
      documentId: Number(document.id),
      apiKey,
    });
    return { artifactId, status: "IN_PROGRESS", documensoDocumentId };
  },
};
