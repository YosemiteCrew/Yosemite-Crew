import { prisma } from "src/config/prisma";
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
  const sections: string[] = [
    `<h2>Referral Letter for ${patientName}</h2>`,
    letter.specialistName
      ? `<p><strong>To:</strong> ${letter.specialistName}${letter.specialistClinic ? `, ${letter.specialistClinic}` : ""}</p>`
      : "",
    referringVetName ? `<p><strong>From:</strong> ${referringVetName}</p>` : "",
    `<h3>Reason for Referral</h3><p>${letter.reasonForReferral}</p>`,
    letter.historySummary
      ? `<h3>History Summary</h3><p>${letter.historySummary}</p>`
      : "",
    letter.examFindings
      ? `<h3>Examination Findings</h3><p>${letter.examFindings}</p>`
      : "",
    letter.currentMedications
      ? `<h3>Current Medications</h3><p>${letter.currentMedications}</p>`
      : "",
    letter.additionalNotes
      ? `<h3>Additional Notes</h3><p>${letter.additionalNotes}</p>`
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

    await sendEmail({
      to: letter.specialistEmail,
      subject: `Referral: ${patientName}${letter.specialistClinic ? ` - ${letter.specialistClinic}` : ""}`,
      htmlBody,
    }).catch((sendErr: unknown) => {
      logger.error("Referral email send failed", {
        letterId: id,
        err: sendErr,
      });
      throw new ReferralLetterError("Failed to send referral email.", 502);
    });

    const updated = await prisma.referralLetter.update({
      where: { id },
      data: { status: "SENT", sentAt: new Date() },
      select: letterSelect,
    });

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
