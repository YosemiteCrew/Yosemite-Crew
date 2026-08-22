import { prisma } from "src/config/prisma";
import { assertPatientOrgMembership } from "./shared/patient-org-membership";
import { escapeHtml } from "src/utils/email-templates";
import { AuditTrailService } from "./audit-trail.service";
import { sendEmail } from "src/utils/email";
import logger from "src/utils/logger";
import type { Prisma } from "@prisma/client";

export class ReferralLetterError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "ReferralLetterError";
  }
}

export interface CreateReferralLetterParams {
  organisationId: string;
  patientId: string;
  encounterId?: string;
  referringVetId?: string;
  specialistName?: string;
  specialistClinic?: string;
  specialistEmail?: string;
  reasonForReferral: string;
  historySummary?: string;
  examFindings?: string;
  currentMedications?: string;
  additionalNotes?: string;
}

export interface UpdateReferralLetterParams {
  specialistName?: string;
  specialistClinic?: string;
  specialistEmail?: string;
  reasonForReferral?: string;
  historySummary?: string;
  examFindings?: string;
  currentMedications?: string;
  additionalNotes?: string;
}

export interface ListReferralLettersParams {
  organisationId: string;
  patientId?: string;
  status?: "DRAFT" | "SIGNED" | "SENT" | "ACKNOWLEDGED" | "CANCELLED";
}

const letterSelect = {
  id: true,
  organisationId: true,
  patientId: true,
  encounterId: true,
  referringVetId: true,
  specialistName: true,
  specialistClinic: true,
  specialistEmail: true,
  reasonForReferral: true,
  historySummary: true,
  examFindings: true,
  currentMedications: true,
  additionalNotes: true,
  status: true,
  signedAt: true,
  sentAt: true,
  documensoEnvelopeId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.ReferralLetterSelect;

const assertLetter = async (id: string, organisationId: string) => {
  const letter = await prisma.referralLetter.findFirst({
    where: { id, organisationId },
    select: letterSelect,
  });
  if (!letter) {
    throw new ReferralLetterError("Referral letter not found.", 404);
  }
  return letter;
};

const buildEmailBody = (
  letter: Awaited<ReturnType<typeof assertLetter>>,
  patientName: string,
  referringVetName: string | null,
) => {
  // Every field below is clinician free text or a name someone typed, and the
  // result is sent as email HTML - escape before interpolating.
  const clinicSuffix = letter.specialistClinic
    ? `, ${escapeHtml(letter.specialistClinic)}`
    : "";
  const specialistLine = letter.specialistName
    ? `<p><strong>To:</strong> ${escapeHtml(letter.specialistName)}${clinicSuffix}</p>`
    : "";

  const sections: string[] = [
    `<h2>Referral Letter for ${escapeHtml(patientName)}</h2>`,
    specialistLine,
    referringVetName
      ? `<p><strong>From:</strong> ${escapeHtml(referringVetName)}</p>`
      : "",
    `<h3>Reason for Referral</h3><p>${escapeHtml(letter.reasonForReferral)}</p>`,
    letter.historySummary
      ? `<h3>History Summary</h3><p>${escapeHtml(letter.historySummary)}</p>`
      : "",
    letter.examFindings
      ? `<h3>Examination Findings</h3><p>${escapeHtml(letter.examFindings)}</p>`
      : "",
    letter.currentMedications
      ? `<h3>Current Medications</h3><p>${escapeHtml(letter.currentMedications)}</p>`
      : "",
    letter.additionalNotes
      ? `<h3>Additional Notes</h3><p>${escapeHtml(letter.additionalNotes)}</p>`
      : "",
  ];
  return sections.filter(Boolean).join("\n");
};

export const ReferralLetterService = {
  async create(params: CreateReferralLetterParams) {
    const {
      organisationId,
      patientId,
      encounterId,
      referringVetId,
      specialistName,
      specialistClinic,
      specialistEmail,
      reasonForReferral,
      historySummary,
      examFindings,
      currentMedications,
      additionalNotes,
    } = params;

    // `patientId` arrives in the request body while RBAC only authorised the
    // organisation, so a caller could file a referral letter against another
    // tenant's companion. Same uniform 404 as elsewhere so this cannot be used
    // to probe which companion ids exist.
    await assertPatientOrgMembership(patientId, organisationId, () => {
      throw new ReferralLetterError("Companion not found.", 404);
    });

    const letter = await prisma.referralLetter.create({
      data: {
        organisationId,
        patientId,
        encounterId: encounterId ?? null,
        referringVetId: referringVetId ?? null,
        specialistName: specialistName ?? null,
        specialistClinic: specialistClinic ?? null,
        specialistEmail: specialistEmail ?? null,
        reasonForReferral,
        historySummary: historySummary ?? null,
        examFindings: examFindings ?? null,
        currentMedications: currentMedications ?? null,
        additionalNotes: additionalNotes ?? null,
        status: "DRAFT",
      },
      select: letterSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "REFERRAL_LETTER_CREATED",
      actorType: "PMS_USER",
      actorId: referringVetId ?? null,
      entityType: "COMPANION",
      entityId: letter.id,
      metadata: { specialistName, specialistClinic, encounterId },
    });

    return letter;
  },

  async get(id: string, organisationId: string) {
    return assertLetter(id, organisationId);
  },

  async list(params: ListReferralLettersParams) {
    const { organisationId, patientId, status } = params;
    return prisma.referralLetter.findMany({
      where: {
        organisationId,
        ...(patientId ? { patientId } : {}),
        ...(status ? { status } : {}),
      },
      select: letterSelect,
      orderBy: { createdAt: "desc" },
    });
  },

  async update(
    id: string,
    organisationId: string,
    params: UpdateReferralLetterParams,
  ) {
    const letter = await assertLetter(id, organisationId);
    if (letter.status !== "DRAFT") {
      throw new ReferralLetterError("Only DRAFT letters can be updated.", 409);
    }
    return prisma.referralLetter.update({
      where: { id },
      data: {
        ...(params.specialistName !== undefined
          ? { specialistName: params.specialistName }
          : {}),
        ...(params.specialistClinic !== undefined
          ? { specialistClinic: params.specialistClinic }
          : {}),
        ...(params.specialistEmail !== undefined
          ? { specialistEmail: params.specialistEmail }
          : {}),
        ...(params.reasonForReferral !== undefined
          ? { reasonForReferral: params.reasonForReferral }
          : {}),
        ...(params.historySummary !== undefined
          ? { historySummary: params.historySummary }
          : {}),
        ...(params.examFindings !== undefined
          ? { examFindings: params.examFindings }
          : {}),
        ...(params.currentMedications !== undefined
          ? { currentMedications: params.currentMedications }
          : {}),
        ...(params.additionalNotes !== undefined
          ? { additionalNotes: params.additionalNotes }
          : {}),
      },
      select: letterSelect,
    });
  },

  async sign(id: string, organisationId: string, signedBy?: string) {
    const letter = await assertLetter(id, organisationId);
    if (letter.status !== "DRAFT") {
      throw new ReferralLetterError("Only DRAFT letters can be signed.", 409);
    }

    const updated = await prisma.referralLetter.update({
      where: { id },
      data: { status: "SIGNED", signedAt: new Date() },
      select: letterSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: letter.patientId,
      eventType: "REFERRAL_LETTER_SIGNED",
      actorType: "PMS_USER",
      actorId: signedBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {},
    });

    return updated;
  },

  async send(id: string, organisationId: string, sentBy?: string) {
    const letter = await assertLetter(id, organisationId);
    if (letter.status !== "SIGNED" && letter.status !== "DRAFT") {
      throw new ReferralLetterError(
        "Only DRAFT or SIGNED letters can be sent.",
        409,
      );
    }
    if (!letter.specialistEmail) {
      throw new ReferralLetterError(
        "Specialist email is required to send a referral.",
        422,
      );
    }

    const patient = await prisma.patient
      .findUnique({ where: { id: letter.patientId }, select: { name: true } })
      .catch(() => null);

    const patientName = patient?.name ?? "the patient";
    const htmlBody = buildEmailBody(letter, patientName, null);

    const subjectClinicSuffix = letter.specialistClinic
      ? ` - ${letter.specialistClinic}`
      : "";

    // Claim the send before performing it. Mailing first and persisting after
    // leaves a window where a failed write keeps the letter re-sendable, so a
    // retry mails the specialist a duplicate referral.
    const claimed = await prisma.referralLetter.updateMany({
      where: { id, status: { in: ["DRAFT", "SIGNED"] } },
      data: { status: "SENT", sentAt: new Date() },
    });
    if (claimed.count === 0) {
      return assertLetter(id, organisationId);
    }

    await sendEmail({
      to: letter.specialistEmail,
      subject: `Referral: ${patientName}${subjectClinicSuffix}`,
      htmlBody,
    }).catch(async (sendErr: unknown) => {
      logger.error("Referral email send failed", {
        letterId: id,
        err: sendErr,
      });
      await prisma.referralLetter.update({
        where: { id },
        data: { status: letter.status, sentAt: null },
      });
      throw new ReferralLetterError("Failed to send referral email.", 502);
    });

    const updated = await assertLetter(id, organisationId);

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: letter.patientId,
      eventType: "REFERRAL_LETTER_SENT",
      actorType: "PMS_USER",
      actorId: sentBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: { specialistEmail: letter.specialistEmail },
    });

    return updated;
  },

  async cancel(id: string, organisationId: string, cancelledBy?: string) {
    const letter = await assertLetter(id, organisationId);
    if (letter.status === "CANCELLED") {
      throw new ReferralLetterError("Letter is already cancelled.", 409);
    }
    if (letter.status === "SENT" || letter.status === "ACKNOWLEDGED") {
      throw new ReferralLetterError(
        "Sent or acknowledged letters cannot be cancelled.",
        409,
      );
    }

    const updated = await prisma.referralLetter.update({
      where: { id },
      data: { status: "CANCELLED" },
      select: letterSelect,
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: letter.patientId,
      eventType: "REFERRAL_LETTER_CANCELLED",
      actorType: "PMS_USER",
      actorId: cancelledBy ?? null,
      entityType: "COMPANION",
      entityId: id,
      metadata: {},
    });

    return updated;
  },
};
