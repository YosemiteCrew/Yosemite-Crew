import { prisma } from "src/config/prisma";
import { AuditTrailService } from "./audit-trail.service";
import { NotificationService } from "./notification.service";
import { NotificationTemplates } from "../utils/notificationTemplates";
import { sendEmail } from "../utils/email";
import logger from "../utils/logger";
import type { AuditActorType } from "../models/audit-trail";
import type {
  PassportConsentDTO,
  PassportConsentMethod,
} from "@yosemite-crew/types";

// Cross-practice sharing consent for a pet's attested passport records. Consent
// is per recipient practice and keyed to the pet by microchip. A record owned by
// practice O is visible to practice R only when a GRANTED consent O->R exists for
// the pet; the pet parent (owner) sees the full record without a gate.
export class PassportConsentError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "PassportConsentError";
  }
}

type Actor = { type: AuditActorType; id?: string | null };

const toDTO = (row: {
  id: string;
  microchipNumber: string;
  patientId: string;
  ownerOrganisationId: string;
  recipientOrganisationId: string;
  status: string;
  purpose: string | null;
  parentId: string | null;
  consentMethod: string | null;
  consentedAt: Date | null;
  createdAt: Date;
}): PassportConsentDTO => ({
  id: row.id,
  microchipNumber: row.microchipNumber,
  patientId: row.patientId,
  ownerOrganisationId: row.ownerOrganisationId,
  recipientOrganisationId: row.recipientOrganisationId,
  status: row.status as PassportConsentDTO["status"],
  purpose: row.purpose ?? undefined,
  parentId: row.parentId ?? undefined,
  consentMethod:
    (row.consentMethod as PassportConsentMethod | null) ?? undefined,
  consentedAt: row.consentedAt?.toISOString(),
  createdAt: row.createdAt.toISOString(),
});

const assertOrgMembership = async (
  patientId: string,
  organisationId: string,
): Promise<void> => {
  const membership = await prisma.patientOrganisation.findFirst({
    where: { patientId, organisationId, status: { in: ["ACTIVE", "PENDING"] } },
    select: { id: true },
  });
  if (!membership) {
    throw new PassportConsentError("Companion not found.", 404);
  }
};

const loadConsentOrThrow = async (
  consentId: string,
  organisationId: string,
) => {
  const consent = await prisma.passportShareConsent.findUnique({
    where: { id: consentId },
  });
  if (
    !consent ||
    (consent.ownerOrganisationId !== organisationId &&
      consent.recipientOrganisationId !== organisationId)
  ) {
    throw new PassportConsentError("Consent not found.", 404);
  }
  return consent;
};

const notifyOwnerOfConsentRequest = async (
  patientId: string,
): Promise<void> => {
  try {
    const link = await prisma.parentPatient.findFirst({
      where: { patientId, role: "PRIMARY", status: "ACTIVE" },
      select: { parentId: true },
    });
    if (!link) return;
    const [parent, patient] = await Promise.all([
      prisma.parent.findUnique({
        where: { id: link.parentId },
        select: { linkedUserId: true, email: true },
      }),
      prisma.patient.findUnique({
        where: { id: patientId },
        select: { name: true },
      }),
    ]);
    if (!parent || !patient) return;

    const payload = NotificationTemplates.Care.CONSENT_REQUESTED(patient.name);

    if (parent.linkedUserId) {
      await NotificationService.sendToUser(parent.linkedUserId, payload).catch(
        (error) =>
          logger.error(
            `Consent-request push failed for patient ${patientId}`,
            error,
          ),
      );
    }

    if (parent.email) {
      const base = (
        process.env.PUBLIC_PASSPORT_BASE_URL ??
        process.env.PUBLIC_CARD_BASE_URL ??
        ""
      ).replace(/\/+$/, "");
      const passportUrl = `${base}/passport/${patientId}`;
      await sendEmail({
        to: parent.email,
        subject: `Passport sharing request for ${patient.name}`,
        htmlBody: `<p>${payload.body}</p><p><a href="${passportUrl}">View ${patient.name}'s passport</a></p>`,
      }).catch((error) =>
        logger.error(
          `Consent-request email failed for patient ${patientId}`,
          error,
        ),
      );
    }
  } catch (error) {
    logger.error(
      `Failed to notify owner of consent request for patient ${patientId}`,
      error,
    );
  }
};

export const PassportConsentService = {
  // The owning practice requests to share a pet's records with a recipient
  // practice. Recorded PENDING until the pet parent consents (mobile/email).
  async requestConsent(params: {
    patientId: string;
    organisationId: string;
    recipientOrganisationId: string;
    purpose?: string;
    actor: Actor;
  }): Promise<PassportConsentDTO> {
    const { patientId, organisationId, recipientOrganisationId, actor } =
      params;
    if (recipientOrganisationId === organisationId) {
      throw new PassportConsentError(
        "Cannot share with the owning practice.",
        400,
      );
    }
    await assertOrgMembership(patientId, organisationId);
    const patient = await prisma.patient.findUnique({
      where: { id: patientId },
      select: { microchipNumber: true },
    });
    if (!patient?.microchipNumber) {
      throw new PassportConsentError(
        "Companion has no microchip to key sharing on.",
        400,
      );
    }
    const fields = {
      status: "PENDING" as const,
      purpose: params.purpose ?? null,
      requestedBy: actor.id ?? null,
      revokedAt: null,
      revokedReason: null,
    };
    const row = await prisma.passportShareConsent.upsert({
      where: {
        microchipNumber_ownerOrganisationId_recipientOrganisationId: {
          microchipNumber: patient.microchipNumber,
          ownerOrganisationId: organisationId,
          recipientOrganisationId,
        },
      },
      create: {
        microchipNumber: patient.microchipNumber,
        patientId,
        ownerOrganisationId: organisationId,
        recipientOrganisationId,
        ...fields,
      },
      update: fields,
    });
    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "PASSPORT_CONSENT_REQUESTED",
      actorType: actor.type,
      actorId: actor.id ?? null,
      entityType: "COMPANION",
      entityId: row.id,
      metadata: {
        microchipNumber: patient.microchipNumber,
        recipientOrganisationId,
        purpose: params.purpose ?? null,
      },
    });
    void notifyOwnerOfConsentRequest(patientId);
    return toDTO(row);
  },

  // The pet parent grants consent (via the mobile app or an email link), which
  // makes the share active.
  async grantConsent(params: {
    consentId: string;
    organisationId: string;
    method: PassportConsentMethod;
    parentId?: string;
    actor?: Actor;
  }): Promise<PassportConsentDTO> {
    const { consentId, organisationId, method } = params;
    const consent = await loadConsentOrThrow(consentId, organisationId);
    const row = await prisma.passportShareConsent.update({
      where: { id: consent.id },
      data: {
        status: "GRANTED",
        consentMethod: method,
        parentId: params.parentId ?? consent.parentId,
        consentedAt: new Date(),
        revokedAt: null,
        revokedReason: null,
      },
    });
    await AuditTrailService.recordSafely({
      organisationId,
      patientId: consent.patientId,
      eventType: "PASSPORT_CONSENT_GRANTED",
      actorType: params.actor?.type ?? "PMS_USER",
      actorId: params.actor?.id ?? null,
      entityType: "COMPANION",
      entityId: row.id,
      metadata: {
        microchipNumber: consent.microchipNumber,
        consentMethod: method,
        ownerOrganisationId: consent.ownerOrganisationId,
        recipientOrganisationId: consent.recipientOrganisationId,
      },
    });
    return toDTO(row);
  },

  // Either practice (or the parent, via their own flow) revokes the share.
  async revokeConsent(params: {
    consentId: string;
    organisationId: string;
    reason?: string;
    actor?: Actor;
  }): Promise<PassportConsentDTO> {
    const consent = await loadConsentOrThrow(
      params.consentId,
      params.organisationId,
    );
    const row = await prisma.passportShareConsent.update({
      where: { id: consent.id },
      data: {
        status: "REVOKED",
        revokedAt: new Date(),
        revokedReason: params.reason ?? null,
      },
    });
    await AuditTrailService.recordSafely({
      organisationId: params.organisationId,
      patientId: consent.patientId,
      eventType: "PASSPORT_CONSENT_REVOKED",
      actorType: params.actor?.type ?? "PMS_USER",
      actorId: params.actor?.id ?? null,
      entityType: "COMPANION",
      entityId: row.id,
      metadata: {
        microchipNumber: consent.microchipNumber,
        ownerOrganisationId: consent.ownerOrganisationId,
        recipientOrganisationId: consent.recipientOrganisationId,
        reason: params.reason ?? null,
      },
    });
    return toDTO(row);
  },

  async listConsents(organisationId: string): Promise<{
    outgoing: PassportConsentDTO[];
    incoming: PassportConsentDTO[];
  }> {
    const [outgoing, incoming] = await Promise.all([
      prisma.passportShareConsent.findMany({
        where: { ownerOrganisationId: organisationId },
        orderBy: { createdAt: "desc" },
      }),
      prisma.passportShareConsent.findMany({
        where: { recipientOrganisationId: organisationId },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    return { outgoing: outgoing.map(toDTO), incoming: incoming.map(toDTO) };
  },

  // The owner organisations whose records a recipient practice may see for a pet
  // (used by the cross-practice passport read).
  async grantedOwnerOrgs(
    microchipNumber: string,
    recipientOrganisationId: string,
  ): Promise<string[]> {
    const rows = await prisma.passportShareConsent.findMany({
      where: { microchipNumber, recipientOrganisationId, status: "GRANTED" },
      select: { ownerOrganisationId: true },
    });
    return rows.map((r) => r.ownerOrganisationId);
  },
};
