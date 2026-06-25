import { randomBytes, createHash } from "node:crypto";
import { prisma } from "src/config/prisma";
import logger from "src/utils/logger";
import { AuditTrailService } from "./audit-trail.service";
import { NotificationService } from "./notification.service";
import { AppointmentService } from "./appointment.service";
import type { AuditActorType } from "../models/audit-trail";
import type {
  CompanionAlertSummary,
  CompanionCardAudience,
  CompanionCardDTO,
  CompanionCardMedical,
  CompanionCardOwnerContact,
  ShareTokenResponseDTO,
  IssueShareTokenResultDTO,
} from "@yosemite-crew/types";

export class CompanionCardServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number,
  ) {
    super(message);
    this.name = "CompanionCardServiceError";
  }
}

export type ShareActor = { type: AuditActorType; id?: string | null };

const DAY = 24 * 60 * 60;

// Per-audience token lifetime policy (seconds). null = no hard expiry: a PUBLIC
// collar-tag must keep working and is controlled by revoke + rotate instead.
const TTL_DEFAULT_SECONDS: Record<CompanionCardAudience, number | null> = {
  PUBLIC: null,
  REFERRAL_CLINIC: 14 * DAY,
  OWNER: DAY,
  STAFF: DAY,
};
const TTL_MAX_SECONDS: Record<CompanionCardAudience, number | null> = {
  PUBLIC: null,
  REFERRAL_CLINIC: 30 * DAY,
  OWNER: DAY,
  STAFF: DAY,
};

// Field-redaction policy: the single source of truth for what each audience may
// see. A whitelist (build only what the policy permits) so a new field defaults
// to hidden rather than leaked.
type FieldPolicy = {
  passport: boolean;
  dateOfBirth: boolean;
  alerts: "all" | "safety" | "none";
  ownerContact: "full" | "nameAndPhone" | "phoneOptIn" | "none";
  medical: "full" | "safety" | "none";
  insurance: boolean;
  latestVisit: "full" | "statusOnly" | "none";
};

const POLICY: Record<CompanionCardAudience, FieldPolicy> = {
  STAFF: {
    passport: true,
    dateOfBirth: true,
    alerts: "all",
    ownerContact: "full",
    medical: "full",
    insurance: true,
    latestVisit: "full",
  },
  OWNER: {
    passport: true,
    dateOfBirth: true,
    alerts: "all",
    ownerContact: "full",
    medical: "full",
    insurance: true,
    latestVisit: "full",
  },
  REFERRAL_CLINIC: {
    passport: true,
    dateOfBirth: true,
    alerts: "all",
    ownerContact: "nameAndPhone",
    medical: "full",
    insurance: true,
    latestVisit: "statusOnly",
  },
  PUBLIC: {
    passport: false,
    dateOfBirth: false,
    alerts: "safety",
    ownerContact: "phoneOptIn",
    medical: "safety",
    insurance: false,
    latestVisit: "none",
  },
};

const SAFETY_SEVERITIES = new Set<CompanionAlertSummary["severity"]>([
  "critical",
  "high",
]);

const hashToken = (raw: string): string =>
  createHash("sha256").update(raw).digest("hex");

const generateRawToken = (): string => randomBytes(32).toString("base64url");

const buildQrPayload = (rawToken: string): string => {
  const base = process.env.PUBLIC_CARD_BASE_URL ?? "";
  return `${base}/card/${rawToken}`;
};

const isSeverity = (
  value: unknown,
): value is CompanionAlertSummary["severity"] =>
  value === "critical" ||
  value === "high" ||
  value === "medium" ||
  value === "low";

const parseAlerts = (raw: unknown): CompanionAlertSummary[] => {
  if (!Array.isArray(raw)) return [];
  const alerts: CompanionAlertSummary[] = [];
  for (const entry of raw) {
    if (typeof entry !== "object" || entry === null) continue;
    const record = entry as Record<string, unknown>;
    const title = typeof record.title === "string" ? record.title : "";
    if (!title) continue;
    const severity = isSeverity(record.severity) ? record.severity : "medium";
    alerts.push({ title, severity });
  }
  return alerts;
};

const parseInsuranceCompany = (raw: unknown): string | undefined => {
  if (typeof raw !== "object" || raw === null) return undefined;
  const company = (raw as Record<string, unknown>).companyName;
  return typeof company === "string" ? company : undefined;
};

type OwnerSource = {
  firstName: string;
  lastName: string | null;
  phoneNumber: string | null;
  email: string;
  linkedUserId: string | null;
};

type CardSource = {
  patient: NonNullable<Awaited<ReturnType<typeof prisma.patient.findUnique>>>;
  owner: OwnerSource | null;
  insuranceCompany?: string;
  latestVisitStatus?: string;
  latestVisitAt?: string;
};

const buildAlerts = (
  mode: FieldPolicy["alerts"],
  raw: unknown,
): CompanionAlertSummary[] => {
  if (mode === "none") return [];
  const alerts = parseAlerts(raw);
  if (mode === "safety") {
    return alerts.filter((alert) => SAFETY_SEVERITIES.has(alert.severity));
  }
  return alerts;
};

const buildOwner = (
  mode: FieldPolicy["ownerContact"],
  owner: OwnerSource | null,
  showOwnerPhone: boolean,
): CompanionCardOwnerContact | undefined => {
  if (mode === "none" || !owner) return undefined;
  if (mode === "full") {
    return {
      firstName: owner.firstName,
      lastName: owner.lastName ?? undefined,
      phoneNumber: owner.phoneNumber ?? undefined,
      email: owner.email,
    };
  }
  if (mode === "nameAndPhone") {
    return {
      firstName: owner.firstName,
      lastName: owner.lastName ?? undefined,
      phoneNumber: owner.phoneNumber ?? undefined,
    };
  }
  // phoneOptIn (PUBLIC): only a reachable phone, and only if the issuer opted in.
  if (!showOwnerPhone || !owner.phoneNumber) return undefined;
  return { firstName: owner.firstName, phoneNumber: owner.phoneNumber };
};

const buildMedical = (
  mode: FieldPolicy["medical"],
  patient: CardSource["patient"],
): CompanionCardMedical | undefined => {
  if (mode === "none") return undefined;
  const safety: CompanionCardMedical = {
    allergy: patient.allergy ?? undefined,
    bloodGroup: patient.bloodGroup ?? undefined,
  };
  if (mode === "safety") {
    if (!safety.allergy && !safety.bloodGroup) return undefined;
    return safety;
  }
  return {
    ...safety,
    currentWeight: patient.currentWeight ?? undefined,
    isNeutered: patient.isNeutered ?? undefined,
  };
};

const buildLatestVisit = (
  mode: FieldPolicy["latestVisit"],
  source: CardSource,
): CompanionCardDTO["latestVisit"] => {
  if (mode === "none" || !source.latestVisitStatus) return undefined;
  if (mode === "statusOnly") return { status: source.latestVisitStatus };
  return { status: source.latestVisitStatus, occurredAt: source.latestVisitAt };
};

const buildCard = (
  audience: CompanionCardAudience,
  source: CardSource,
  showOwnerPhone: boolean,
): CompanionCardDTO => {
  const policy = POLICY[audience];
  const { patient } = source;

  const card: CompanionCardDTO = {
    audience,
    identity: {
      id: patient.id,
      name: patient.name,
      type: patient.type,
      breed: patient.breed,
      colour: patient.colour ?? undefined,
      photoUrl: patient.photoUrl ?? undefined,
      microchipNumber: patient.microchipNumber ?? undefined,
    },
  };

  if (policy.passport && patient.passportNumber) {
    card.passportNumber = patient.passportNumber;
  }
  if (policy.dateOfBirth && patient.dateOfBirth) {
    card.dateOfBirth = patient.dateOfBirth.toISOString();
  }
  const alerts = buildAlerts(policy.alerts, patient.alerts);
  if (alerts.length > 0) card.alerts = alerts;

  const owner = buildOwner(policy.ownerContact, source.owner, showOwnerPhone);
  if (owner) card.ownerContact = owner;

  const medical = buildMedical(policy.medical, patient);
  if (medical) card.medical = medical;

  if (policy.insurance) {
    card.insurance = {
      isInsured: patient.isInsured,
      companyName: source.insuranceCompany,
    };
  }

  const latestVisit = buildLatestVisit(policy.latestVisit, source);
  if (latestVisit) card.latestVisit = latestVisit;

  return card;
};

const needsOwner = (audience: CompanionCardAudience): boolean =>
  POLICY[audience].ownerContact !== "none";

const needsLatestVisit = (audience: CompanionCardAudience): boolean =>
  POLICY[audience].latestVisit !== "none";

const loadOwner = async (patientId: string): Promise<OwnerSource | null> => {
  const link = await prisma.parentPatient.findFirst({
    where: { patientId, role: "PRIMARY", status: "ACTIVE" },
    select: { parentId: true },
  });
  if (!link) return null;
  const parent = await prisma.parent.findUnique({
    where: { id: link.parentId },
    select: {
      firstName: true,
      lastName: true,
      phoneNumber: true,
      email: true,
      linkedUserId: true,
    },
  });
  return parent;
};

const loadLatestVisit = async (
  patientId: string,
  organisationId: string,
): Promise<{ status?: string; at?: string }> => {
  try {
    const appointments =
      await AppointmentService.getAppointmentsForCompanionByOrganisation(
        patientId,
        organisationId,
      );
    const latest = appointments[0];
    if (!latest) return {};
    return {
      status: latest.status ?? undefined,
      at: latest.start ?? undefined,
    };
  } catch (error) {
    logger.warn("Companion card latest-visit lookup failed", error);
    return {};
  }
};

const loadSource = async (
  patientId: string,
  organisationId: string,
  audience: CompanionCardAudience,
): Promise<CardSource> => {
  const patient = await prisma.patient.findUnique({ where: { id: patientId } });
  if (!patient) {
    throw new CompanionCardServiceError("Companion not found.", 404);
  }

  const owner = needsOwner(audience) ? await loadOwner(patientId) : null;
  const visit = needsLatestVisit(audience)
    ? await loadLatestVisit(patientId, organisationId)
    : {};

  return {
    patient,
    owner,
    insuranceCompany: parseInsuranceCompany(patient.insurance),
    latestVisitStatus: visit.status,
    latestVisitAt: visit.at,
  };
};

// CompanionService.getById is NOT org-scoped, so a STAFF card request must
// confirm the companion belongs to the caller's org or it leaks across tenants.
const assertOrgMembership = async (
  patientId: string,
  organisationId: string,
): Promise<void> => {
  const membership = await prisma.patientOrganisation.findFirst({
    where: {
      patientId,
      organisationId,
      status: { in: ["ACTIVE", "PENDING"] },
    },
    select: { id: true },
  });
  if (!membership) {
    throw new CompanionCardServiceError("Companion not found.", 404);
  }
};

const toResponseDTO = (row: {
  id: string;
  audience: CompanionCardAudience;
  showOwnerPhone: boolean;
  expiresAt: Date | null;
  revokedAt: Date | null;
  lastViewedAt: Date | null;
  viewCount: number;
  createdAt: Date;
}): ShareTokenResponseDTO => ({
  id: row.id,
  audience: row.audience,
  showOwnerPhone: row.showOwnerPhone,
  expiresAt: row.expiresAt?.toISOString() ?? null,
  revokedAt: row.revokedAt?.toISOString() ?? null,
  lastViewedAt: row.lastViewedAt?.toISOString() ?? null,
  viewCount: row.viewCount,
  createdAt: row.createdAt.toISOString(),
});

const resolveExpiry = (
  audience: CompanionCardAudience,
  ttlSeconds?: number,
): Date | null => {
  const max = TTL_MAX_SECONDS[audience];
  const fallback = TTL_DEFAULT_SECONDS[audience];
  if (max === null) return null; // PUBLIC: no hard expiry
  const requested =
    ttlSeconds && ttlSeconds > 0 ? ttlSeconds : (fallback ?? max);
  const capped = Math.min(requested, max);
  return new Date(Date.now() + capped * 1000);
};

const notifyOwnerSafely = async (
  patientId: string,
  title: string,
  body: string,
): Promise<void> => {
  try {
    const owner = await loadOwner(patientId);
    if (!owner?.linkedUserId) return;
    await NotificationService.sendToUser(owner.linkedUserId, { title, body });
  } catch (error) {
    logger.warn("Companion card owner notification failed", error);
  }
};

export const CompanionCardService = {
  // Authenticated staff render. Org-scoped to prevent cross-tenant leakage.
  async getStaffCard(
    patientId: string,
    organisationId: string,
  ): Promise<CompanionCardDTO> {
    await assertOrgMembership(patientId, organisationId);
    const source = await loadSource(patientId, organisationId, "STAFF");
    return buildCard("STAFF", source, false);
  },

  async issueShareToken(params: {
    patientId: string;
    organisationId: string;
    audience: CompanionCardAudience;
    ttlSeconds?: number;
    showOwnerPhone?: boolean;
    actor: ShareActor;
  }): Promise<IssueShareTokenResultDTO> {
    const {
      patientId,
      organisationId,
      audience,
      ttlSeconds,
      showOwnerPhone = false,
      actor,
    } = params;

    await assertOrgMembership(patientId, organisationId);

    // One live PUBLIC token per companion: regenerating revokes the old QR.
    if (audience === "PUBLIC") {
      await prisma.companionShareToken.updateMany({
        where: { patientId, audience: "PUBLIC", revokedAt: null },
        data: { revokedAt: new Date(), revokedById: actor.id ?? null },
      });
    }

    const rawToken = generateRawToken();
    const row = await prisma.companionShareToken.create({
      data: {
        patientId,
        organisationId,
        tokenHash: hashToken(rawToken),
        audience,
        issuedByType: actor.type,
        issuedById: actor.id ?? null,
        showOwnerPhone,
        expiresAt: resolveExpiry(audience, ttlSeconds),
      },
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId,
      eventType: "COMPANION_CARD_SHARE_ISSUED",
      actorType: actor.type,
      actorId: actor.id ?? null,
      entityType: "COMPANION",
      entityId: row.id,
      metadata: { audience, showOwnerPhone },
    });

    await notifyOwnerSafely(
      patientId,
      "A card for your companion was shared",
      `A ${audience.toLowerCase().replace("_", " ")} card was created. You can review or revoke it anytime.`,
    );

    return {
      token: rawToken,
      qrPayload: buildQrPayload(rawToken),
      share: toResponseDTO(row),
    };
  },

  async listTokens(
    patientId: string,
    organisationId: string,
  ): Promise<ShareTokenResponseDTO[]> {
    const rows = await prisma.companionShareToken.findMany({
      where: { patientId, organisationId },
      orderBy: { createdAt: "desc" },
    });
    return rows.map(toResponseDTO);
  },

  async revokeToken(
    tokenId: string,
    organisationId: string,
    actor: ShareActor,
  ): Promise<ShareTokenResponseDTO> {
    const row = await prisma.companionShareToken.findFirst({
      where: { id: tokenId, organisationId },
    });
    if (!row) {
      throw new CompanionCardServiceError("Share token not found.", 404);
    }
    if (row.revokedAt) return toResponseDTO(row);

    const updated = await prisma.companionShareToken.update({
      where: { id: tokenId },
      data: { revokedAt: new Date(), revokedById: actor.id ?? null },
    });

    await AuditTrailService.recordSafely({
      organisationId,
      patientId: row.patientId,
      eventType: "COMPANION_CARD_SHARE_REVOKED",
      actorType: actor.type,
      actorId: actor.id ?? null,
      entityType: "COMPANION",
      entityId: row.id,
      metadata: { audience: row.audience },
    });

    await notifyOwnerSafely(
      row.patientId,
      "A shared companion card was revoked",
      "A previously shared card for your companion is no longer accessible.",
    );

    return toResponseDTO(updated);
  },

  // Public, unauthenticated resolve. Uniform not-found for missing/expired/revoked
  // so the surface cannot be enumerated. Org scope comes from the token row only.
  async resolveByRawToken(rawToken: string): Promise<CompanionCardDTO> {
    if (!rawToken || typeof rawToken !== "string") {
      throw new CompanionCardServiceError("Card not found.", 404);
    }
    const row = await prisma.companionShareToken.findUnique({
      where: { tokenHash: hashToken(rawToken) },
    });
    const now = Date.now();
    const expired = row?.expiresAt ? row.expiresAt.getTime() < now : false;
    if (!row || row.revokedAt || expired) {
      throw new CompanionCardServiceError("Card not found.", 404);
    }

    await prisma.companionShareToken.update({
      where: { id: row.id },
      data: { viewCount: { increment: 1 }, lastViewedAt: new Date() },
    });

    const source = await loadSource(
      row.patientId,
      row.organisationId,
      row.audience,
    );
    const card = buildCard(row.audience, source, row.showOwnerPhone);

    await AuditTrailService.recordSafely({
      organisationId: row.organisationId,
      patientId: row.patientId,
      eventType: "COMPANION_CARD_VIEWED",
      actorType: "SYSTEM",
      entityType: "COMPANION",
      entityId: row.id,
      metadata: { audience: row.audience },
    });

    return card;
  },
};
