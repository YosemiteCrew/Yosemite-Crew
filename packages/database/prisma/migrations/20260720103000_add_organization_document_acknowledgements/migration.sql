-- CreateTable
CREATE TABLE "OrganizationDocumentAcknowledgements" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "category" "OrgDocumentCategory" NOT NULL,
    "version" INTEGER NOT NULL,
    "userId" TEXT NOT NULL,
    "acknowledgedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationDocumentAcknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationDocumentAcknowledgements_userId_organisationId_documentId_category_version_key" ON "OrganizationDocumentAcknowledgements"("userId", "organisationId", "documentId", "category", "version");

-- CreateIndex
CREATE INDEX "OrganizationDocumentAcknowledgements_organisationId_documentId_category_idx" ON "OrganizationDocumentAcknowledgements"("organisationId", "documentId", "category");

-- CreateIndex
CREATE INDEX "OrganizationDocumentAcknowledgements_userId_organisationId_idx" ON "OrganizationDocumentAcknowledgements"("userId", "organisationId");
