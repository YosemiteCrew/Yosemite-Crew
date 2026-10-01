import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  encodeKeysetCursor,
  splitPage,
  type KeysetCursor,
} from "src/services/shared/pagination";

export type BillingReviewStatus =
  "MISSING_INVOICE" | "DRAFT_INVOICE" | "UNBILLED_CHARGES";

export type BillingReviewItem = {
  id: string;
  appointmentDate: Date;
  patientName: string | null;
  clientName: string | null;
  appointmentType: string | null;
  invoiceId: string | null;
  invoiceStatus: string | null;
  invoiceTotal: number | null;
  currency: string | null;
  billingStatus: BillingReviewStatus;
};

/*
 * A completed visit needs billing review when any of these holds:
 *   MISSING_INVOICE  - no invoice was raised for the visit;
 *   DRAFT_INVOICE    - its invoice is still a draft (not cancelled or refunded);
 *   UNBILLED_CHARGES - a priced treatment charge on the visit is on no invoice
 *                      line, matched by line id or by line name the same way
 *                      the workspace bill builder dedupes lines.
 * The first matching reason is reported. Amounts stay per invoice in the
 * invoice's own currency; nothing here totals across visits.
 */
const INVOICE_LINES = Prisma.sql`jsonb_array_elements(
  CASE WHEN jsonb_typeof(i."items") = 'array' THEN i."items" ELSE '[]'::jsonb END
)`;

const HAS_UNBILLED_CHARGES = Prisma.sql`EXISTS (
  SELECT 1
  FROM "WorkspaceTreatmentItem" t
  WHERE t."organisationId" = a."organisationId"
    AND t."appointmentId" = a."id"
    AND t."billingStatus" = 'UNBILLED'
    AND t."settledInvoiceId" IS NULL
    AND jsonb_typeof(t."priceSnapshot"->'unitPrice') = 'number'
    AND (t."priceSnapshot"->>'unitPrice')::numeric > 0
    AND NOT EXISTS (
      SELECT 1
      FROM ${INVOICE_LINES} AS line
      WHERE line->>'id' = t."invoiceRowId"
        OR lower(btrim(line->>'name')) = lower(btrim(COALESCE(
          t."priceSnapshot"->>'name',
          t."productSnapshot"->>'name',
          ''
        )))
    )
)`;

const IS_DRAFT_INVOICE = Prisma.sql`(
  i."visitBillingStage" = 'DRAFT'
  AND i."status" NOT IN ('CANCELLED', 'REFUNDED')
)`;

export const BillingReviewService = {
  async list(organisationId: string, limit: number, cursor?: KeysetCursor) {
    // appointmentDate is a timestamp without time zone holding UTC, so the
    // cursor instant is converted to UTC wall time explicitly; comparing it
    // as-is would shift by the session time zone and repeat or skip pages.
    const cursorAt = cursor
      ? Prisma.sql`(${cursor.createdAt}::timestamptz AT TIME ZONE 'UTC')`
      : Prisma.empty;
    const afterCursor = cursor
      ? Prisma.sql`AND (
          a."appointmentDate" < ${cursorAt}
          OR (a."appointmentDate" = ${cursorAt} AND a."id" < ${cursor.id})
        )`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<BillingReviewItem[]>(Prisma.sql`
      SELECT
        visit."id",
        visit."appointmentDate",
        visit."patientName",
        visit."clientName",
        visit."appointmentType",
        visit."invoiceId",
        visit."invoiceStatus",
        visit."invoiceTotal",
        visit."currency",
        visit."billingStatus"
      FROM (
        SELECT
          a."id",
          a."appointmentDate",
          a."patient"->>'name' AS "patientName",
          a."patient"->'parent'->>'name' AS "clientName",
          a."appointmentType"->>'name' AS "appointmentType",
          i."id" AS "invoiceId",
          i."status"::text AS "invoiceStatus",
          i."totalAmount" AS "invoiceTotal",
          i."currency" AS "currency",
          CASE
            WHEN i."id" IS NULL THEN 'MISSING_INVOICE'
            WHEN ${IS_DRAFT_INVOICE} THEN 'DRAFT_INVOICE'
            WHEN ${HAS_UNBILLED_CHARGES} THEN 'UNBILLED_CHARGES'
          END AS "billingStatus"
        FROM "Appointment" a
        LEFT JOIN "Invoice" i
          ON i."appointmentId" = a."id"
          AND i."organisationId" = a."organisationId"
        WHERE a."organisationId" = ${organisationId}
          AND a."status" = 'COMPLETED'
          ${afterCursor}
      ) visit
      WHERE visit."billingStatus" IS NOT NULL
      ORDER BY visit."appointmentDate" DESC, visit."id" DESC
      LIMIT ${limit + 1}
    `);

    return splitPage(rows, limit, (row) =>
      encodeKeysetCursor({ createdAt: row.appointmentDate, id: row.id }),
    );
  },
};
