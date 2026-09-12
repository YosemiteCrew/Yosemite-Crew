-- Records a deterministic supplied-text-to-draft-form conversion (#3055).
-- Additive only; the existing Form/FormVersion publish path is untouched.

-- CreateTable
CREATE TABLE "FormDraftImport" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "sourceFormId" TEXT,
    "sourceFormVersionAtImport" INTEGER,
    "sourceFormUpdatedAtImport" TIMESTAMP(3),
    "draftFormId" TEXT NOT NULL,
    "suppliedText" TEXT NOT NULL,
    "unsupportedConstructs" JSONB NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FormDraftImport_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FormDraftImport_draftFormId_key" ON "FormDraftImport"("draftFormId");

-- CreateIndex
CREATE INDEX "FormDraftImport_organisationId_idx" ON "FormDraftImport"("organisationId");

-- CreateIndex
CREATE INDEX "FormDraftImport_sourceFormId_idx" ON "FormDraftImport"("sourceFormId");

-- AddForeignKey
ALTER TABLE "FormDraftImport" ADD CONSTRAINT "FormDraftImport_sourceFormId_fkey" FOREIGN KEY ("sourceFormId") REFERENCES "Form"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormDraftImport" ADD CONSTRAINT "FormDraftImport_draftFormId_fkey" FOREIGN KEY ("draftFormId") REFERENCES "Form"("id") ON DELETE CASCADE ON UPDATE CASCADE;
