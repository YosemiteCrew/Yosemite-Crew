import { prisma } from "src/config/prisma";
import { findParentIdForAuthUser } from "./shared/parent-identity";
import { assertPatientOrgMembership } from "./shared/patient-org-membership";
import { AuditTrailService } from "./audit-trail.service";
import { NotificationTemplates } from "../utils/notificationTemplates";
import {
  notifyPatientOwner,
  passportLinkEmail,
} from "src/services/shared/owner-notification";
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

// Only a practice with an ACTIVE link to the companion may ask to share it.
const assertOrgMembership = (
  patientId: string,
  organisationId: string,
): Promise<void> =>
  assertPatientOrgMembership(patientId, organisationId, () => {
    throw new PassportConsentError("Companion not found.", 404);
  });

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

/**
 * The consent a pet owner may grant: one at this practice, for a pet the
 * signed-in caller is the ACTIVE primary parent of. Consent for cross-practice
 * disclosure of clinical records is the owner's to give (GDPR Art. 6/9), so a
 * staff session never qualifies.
 *
 * Ownership is part of the lookup, so a consent that does not exist, sits at
 * another practice, or is for someone else's pet all answer the same.
 *
 * The caller's id is an auth provider id, so it is resolved to a parent through
 * AuthUser rather than compared against Parent.linkedUserId, which holds an
 * AuthUser primary key.
 */
const loadOwnConsentOrThrow = async (
  consentId: string,
  organisationId: string,
  grantingUserId: string | null,
) => {
  const parentId = grantingUserId
    ? await findParentIdForAuthUser(grantingUserId)
    : null;
  const ownPets = parentId
    ? await prisma.parentPatient.findMany({
        where: { parentId, role: "PRIMARY", status: "ACTIVE" },
        select: { patientId: true },
      })
    : [];
  const consent =
    parentId && ownPets.length
      ? await prisma.passportShareConsent.findFirst({
          where: {
            id: consentId,
            patientId: { in: ownPets.map((link) => link.patientId) },
            OR: [
              { ownerOrganisationId: organisationId },
              { recipientOrganisationId: organisationId },
            ],
          },
        })
      : null;
  if (!parentId || !consent) {
    throw new PassportConsentError("Consent not found.", 404);
  }
  return { consent, parentId };
};

const notifyOwnerOfConsentRequest = (patientId: string): Promise<void> =>
  notifyPatientOwner({
    patientId,
    label: "Consent-request",
    buildPayload: (patientName) =>
      NotificationTemplates.Care.CONSENT_REQUESTED(patientName),
    buildEmail: passportLinkEmail(
      (patientName) => `Passport sharing request for ${patientName}`,
    ),
  });

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
  /**
   * Records the pet parent's consent, making the cross-practice share active.
   *
   * `grantingUserId` is the authenticated principal and MUST be the pet's
   * primary parent. A practice cannot authorise its own access: without this
   * check any staff member at either the owning OR the recipient organisation
   * could flip a PENDING share to GRANTED with `passport:edit:any` (a
   * permission every staff role holds) and read the other practice's signed
   * clinical records.
   */
  async grantConsent(params: {
    consentId: string;
    organisationId: string;
    method: PassportConsentMethod;
    grantingUserId: string | null;
    actor?: Actor;
  }): Promise<PassportConsentDTO> {
    const { consentId, organisationId, method, grantingUserId } = params;
    const { consent, parentId } = await loadOwnConsentOrThrow(
      consentId,
      organisationId,
      grantingUserId,
    );

    // A share the parent (or the owning practice) already revoked must not be
    // resurrected by re-granting it.
    if (consent.status !== "PENDING") {
      throw new PassportConsentError(
        "Only a pending consent can be granted.",
        409,
      );
    }

    const row = await prisma.passportShareConsent.update({
      where: { id: consent.id },
      data: {
        status: "GRANTED",
        consentMethod: method,
        // Derived from the authenticated parent link, never from the request
        // body, so the audit trail cannot be attributed to a fabricated parent.
        parentId,
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
