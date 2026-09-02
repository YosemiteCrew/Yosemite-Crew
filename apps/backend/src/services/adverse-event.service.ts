// src/services/adverseEvent.service.ts
import { AdverseEventReport, AdverseEventStatus } from "@yosemite-crew/types";
import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma";
import { sendEmailTemplate } from "../utils/email";
import logger from "../utils/logger";

export class AdverseEventServiceError extends Error {
  constructor(
    message: string,
    public statusCode = 400,
  ) {
    super(message);
    this.name = "AdverseEventServiceError";
  }
}

const toInputJsonObject = (value: unknown): Prisma.InputJsonObject => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value;
};

const toDomainFromPrisma = (row: {
  id: string;
  organisationId: string | null;
  appointmentId: string | null;
  reporter: Prisma.JsonValue;
  patient: Prisma.JsonValue;
  companion?: Prisma.JsonValue;
  product: Prisma.JsonValue;
  destinations: Prisma.JsonValue;
  consent: Prisma.JsonValue;
  status: AdverseEventStatus;
  createdAt: Date;
  updatedAt: Date;
}): AdverseEventReport => ({
  id: row.id,
  organisationId: row.organisationId ?? undefined,
  appointmentId: row.appointmentId ?? null,
  reporter: row.reporter as unknown as AdverseEventReport["reporter"],
  patient: row.patient as unknown as AdverseEventReport["patient"],
  companion: (row.companion ??
    row.patient) as unknown as AdverseEventReport["companion"],
  product: row.product as unknown as AdverseEventReport["product"],
  destinations:
    row.destinations as unknown as AdverseEventReport["destinations"],
  consent: row.consent as unknown as AdverseEventReport["consent"],
  status: row.status,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const asText = (value: unknown): string | undefined => {
  if (typeof value === "string") return value.trim() || undefined;
  if (typeof value === "number") return String(value);
  return undefined;
};

/**
 * Tells the linked practice that a report exists.
 *
 * This is the only destination that is real. Nothing is transmitted to a
 * regulator or a manufacturer - no regulator documents a route for a platform
 * to file on an owner's behalf, and two of the eighteen we checked exclude it
 * outright (see regulatory-authority-seed.data.ts). So the practice is told
 * where the owner can file it themselves, and the filing stays with a human.
 *
 * It also matters that this is an email rather than a notification: the report
 * is stored org-scoped and reachable over the API, but apps/frontend has no
 * adverse-event screen, so without this mail nothing surfaces the report to
 * the clinic at all.
 *
 * Failure is logged and swallowed, matching appointment.service.ts and
 * public-booking.service.ts: a report that was accepted and stored must not be
 * reported back as failed because SES was unavailable.
 */
const notifyOrganisation = async (
  reportId: string,
  input: AdverseEventReport,
): Promise<void> => {
  const organisationId = input.organisationId;
  if (!organisationId) return;

  try {
    const organisation = await prisma.organization.findUnique({
      where: { id: organisationId },
      select: { name: true, email: true, country: true },
    });
    if (!organisation?.email) {
      logger.info(
        { reportId, organisationId },
        "Adverse event stored but the practice has no email on file; not notified",
      );
      return;
    }

    const product = (input.product ?? {}) as Record<string, unknown>;
    const reporter = (input.reporter ?? {}) as Record<string, unknown>;
    const patient = (input.patient ?? {}) as Record<string, unknown>;

    const countryName = asText(
      (product.manufacturingCountry as Record<string, unknown> | undefined)
        ?.name ?? organisation.country,
    );
    const authority = countryName
      ? await prisma.regulatoryAuthority.findFirst({
          where: { country: { equals: countryName, mode: "insensitive" } },
          select: { authorityName: true, website: true },
        })
      : null;

    const reporterName =
      [asText(reporter.firstName), asText(reporter.lastName)]
        .filter(Boolean)
        .join(" ") || "A pet owner";

    const quantity = [
      asText(product.quantityUsed),
      asText(product.quantityUnit),
    ]
      .filter(Boolean)
      .join(" ");

    await sendEmailTemplate({
      to: organisation.email,
      templateId: "adverseEventReported",
      templateData: {
        organisationName: asText(organisation.name),
        reporterName,
        reporterEmail: asText(reporter.email),
        reporterPhone: asText(reporter.phoneNumber),
        companionName: asText(patient.name) ?? "a companion",
        productName: asText(product.productName) ?? "an unnamed product",
        brandName: asText(product.brandName),
        batchNumber: asText(product.batchNumber),
        quantityUsed: quantity || undefined,
        administrationMethod: asText(product.administrationMethod),
        eventDate: asText(product.eventDate),
        conditionBefore: asText(product.petConditionBefore),
        conditionAfter: asText(product.petConditionAfter),
        authorityName: authority?.authorityName ?? undefined,
        authorityUrl: authority?.website ?? undefined,
      },
    });

    logger.info(
      { reportId, organisationId },
      "Adverse event notified to practice",
    );
  } catch (error) {
    logger.error(
      { err: error, reportId, organisationId },
      "Failed to notify the practice of an adverse event; the report is stored",
    );
  }
};

export const AdverseEventService = {
  async createFromMobile(
    input: AdverseEventReport,
  ): Promise<AdverseEventReport> {
    if (!input.reporter?.firstName || !input.reporter?.email) {
      throw new AdverseEventServiceError(
        "Reporter firstName and email are required",
        400,
      );
    }
    if (!input.product?.productName) {
      throw new AdverseEventServiceError("productName is required", 400);
    }
    if (!input.patient?.name) {
      throw new AdverseEventServiceError("companion name is required", 400);
    }

    const doc = await prisma.adverseEventReport.create({
      data: {
        organisationId: input.organisationId ?? undefined,
        appointmentId: input.appointmentId ?? undefined,
        reporter: toInputJsonObject(input.reporter),
        patient: toInputJsonObject(input.patient),
        product: toInputJsonObject(input.product),
        destinations: toInputJsonObject(input.destinations),
        consent: {
          agreedToContact: input.consent?.agreedToContact ?? false,
          agreedToTermsAt: input.consent?.agreedToTermsAt ?? new Date(),
        },
        status: "SUBMITTED",
      },
    });
    await notifyOrganisation(doc.id, input);

    return toDomainFromPrisma({
      ...doc,
      reporter: doc.reporter,
      patient: doc.patient,
      companion: doc.patient,
      product: doc.product,
      destinations: doc.destinations,
      consent: doc.consent,
    });
  },

  async getById(id: string): Promise<AdverseEventReport | null> {
    const row = await prisma.adverseEventReport.findUnique({ where: { id } });
    return row
      ? toDomainFromPrisma({
          ...row,
          reporter: row.reporter,
          patient: row.patient,
          companion: row.patient,
          product: row.product,
          destinations: row.destinations,
          consent: row.consent,
        })
      : null;
  },

  async listForOrganisation(
    orgId: string,
    options?: { status?: AdverseEventStatus },
  ) {
    const rows = await prisma.adverseEventReport.findMany({
      where: {
        organisationId: orgId,
        status: options?.status ?? undefined,
      },
      orderBy: { createdAt: "desc" },
    });
    return rows.map((row) =>
      toDomainFromPrisma({
        ...row,
        reporter: row.reporter,
        patient: row.patient,
        companion: row.patient,
        product: row.product,
        destinations: row.destinations,
        consent: row.consent,
      }),
    );
  },

  async updateStatus(id: string, status: AdverseEventStatus) {
    const row = await prisma.adverseEventReport.update({
      where: { id },
      data: { status },
    });
    return toDomainFromPrisma({
      ...row,
      reporter: row.reporter,
      patient: row.patient,
      companion: row.patient,
      product: row.product,
      destinations: row.destinations,
      consent: row.consent,
    });
  },
};
