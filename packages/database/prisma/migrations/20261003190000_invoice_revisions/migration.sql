BEGIN;

LOCK TABLE "Invoice" IN SHARE ROW EXCLUSIVE MODE;

CREATE TABLE "InvoiceRevision" (
    "id" BIGSERIAL NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "organisationId" TEXT,
    "parentId" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL,
    "finalizedAt" TIMESTAMP(3),
    "dueAt" TIMESTAMP(3),
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "baseline" BOOLEAN NOT NULL DEFAULT false,
    CONSTRAINT "InvoiceRevision_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "InvoiceRevision_organisationId_parentId_recordedAt_idx"
ON "InvoiceRevision"("organisationId", "parentId", "recordedAt");

CREATE INDEX "InvoiceRevision_invoiceId_id_idx"
ON "InvoiceRevision"("invoiceId", "id");

ALTER TABLE "InvoiceRevision" ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION record_invoice_revision() RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND
       ROW(OLD."organisationId", OLD."parentId", OLD."totalAmount", OLD."currency",
           OLD."status", OLD."finalizedAt", OLD."dueAt") IS NOT DISTINCT FROM
       ROW(NEW."organisationId", NEW."parentId", NEW."totalAmount", NEW."currency",
           NEW."status", NEW."finalizedAt", NEW."dueAt") THEN
        RETURN NEW;
    END IF;

    EXECUTE pg_catalog.format('INSERT INTO %I."InvoiceRevision"
        ("invoiceId", "organisationId", "parentId", "totalAmount", "currency",
         "status", "finalizedAt", "dueAt", "recordedAt")
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)', TG_TABLE_SCHEMA)
    USING NEW."id", NEW."organisationId", NEW."parentId", NEW."totalAmount", NEW."currency",
          NEW."status", NEW."finalizedAt", NEW."dueAt", clock_timestamp() AT TIME ZONE 'UTC';
    RETURN NEW;
END;
$$;

CREATE TRIGGER invoice_revision_after_write
AFTER INSERT OR UPDATE OF "organisationId", "parentId", "totalAmount", "currency",
    "status", "finalizedAt", "dueAt" ON "Invoice"
FOR EACH ROW EXECUTE FUNCTION record_invoice_revision();

INSERT INTO "InvoiceRevision"
    ("invoiceId", "organisationId", "parentId", "totalAmount", "currency",
     "status", "finalizedAt", "dueAt", "recordedAt", "baseline")
SELECT "id", "organisationId", "parentId", "totalAmount", "currency",
       "status", "finalizedAt", "dueAt", clock_timestamp() AT TIME ZONE 'UTC', true
FROM "Invoice";

COMMIT;

-- deployed-code-survives: Existing invoice features remain unchanged; dated revisions are additional records.
