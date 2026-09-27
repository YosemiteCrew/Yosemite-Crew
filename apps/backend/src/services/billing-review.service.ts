import { Prisma } from "@prisma/client";
import { prisma } from "src/config/prisma";
import {
  encodeKeysetCursor,
  splitPage,
  type KeysetCursor,
} from "src/services/shared/pagination";

export type BillingReviewItem = {
  id: string;
  appointmentDate: Date;
  patientName: string | null;
  clientName: string | null;
  appointmentType: string | null;
  invoiceId: string | null;
  invoiceStatus: string | null;
  billingStatus: "MISSING_INVOICE" | "DRAFT_INVOICE" | "READY_FOR_BILLING";
};

export const BillingReviewService = {
  async list(organisationId: string, limit: number, cursor?: KeysetCursor) {
    const afterCursor = cursor
      ? Prisma.sql`AND (
          a."appointmentDate" < ${cursor.createdAt}
          OR (a."appointmentDate" = ${cursor.createdAt} AND a."id" < ${cursor.id}::uuid)
        )`
      : Prisma.empty;

    const rows = await prisma.$queryRaw<BillingReviewItem[]>(Prisma.sql`
      SELECT
        a."id",
        a."appointmentDate",
        a."patient"->>'name' AS "patientName",
        a."patient"->'parent'->>'name' AS "clientName",
        a."appointmentType"->>'name' AS "appointmentType",
        i."id" AS "invoiceId",
        i."status"::text AS "invoiceStatus",
        CASE
          WHEN i."id" IS NULL THEN 'MISSING_INVOICE'
          WHEN i."visitBillingStage" = 'DRAFT' THEN 'DRAFT_INVOICE'
          ELSE 'READY_FOR_BILLING'
        END AS "billingStatus"
      FROM "Appointment" a
      LEFT JOIN "Invoice" i
        ON i."appointmentId" = a."id"
        AND i."organisationId" = a."organisationId"
      WHERE a."organisationId" = ${organisationId}
        AND a."status" = 'COMPLETED'
        AND (
          i."id" IS NULL
          OR (
            i."visitBillingStage" <> 'SETTLED'
            AND i."status" NOT IN ('CANCELLED', 'REFUNDED')
          )
        )
        ${afterCursor}
      ORDER BY a."appointmentDate" DESC, a."id" DESC
      LIMIT ${limit + 1}
    `);

    return splitPage(rows, limit, (row) =>
      encodeKeysetCursor({ createdAt: row.appointmentDate, id: row.id }),
    );
  },
};
