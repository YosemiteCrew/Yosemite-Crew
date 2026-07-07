-- CreateEnum
CREATE TYPE "TemplatePackStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUSPENDED');

-- CreateTable
CREATE TABLE "TemplatePacks" (
    "id" TEXT NOT NULL,
    "publisherOrganisationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "status" "TemplatePackStatus" NOT NULL DEFAULT 'DRAFT',
    "priceCents" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TemplatePacks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplatePackItems" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "snapshotVersion" INTEGER NOT NULL,
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TemplatePackItems_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TemplatePackInstalls" (
    "id" TEXT NOT NULL,
    "packId" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "installedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "materializedTemplateIds" TEXT[],

    CONSTRAINT "TemplatePackInstalls_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "TemplatePacks_slug_key" ON "TemplatePacks"("slug");

-- CreateIndex
CREATE INDEX "TemplatePacks_publisherOrganisationId_idx" ON "TemplatePacks"("publisherOrganisationId");

-- CreateIndex
CREATE INDEX "TemplatePacks_status_createdAt_idx" ON "TemplatePacks"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TemplatePackItems_packId_templateId_key" ON "TemplatePackItems"("packId", "templateId");

-- CreateIndex
CREATE INDEX "TemplatePackItems_templateId_idx" ON "TemplatePackItems"("templateId");

-- CreateIndex
CREATE UNIQUE INDEX "TemplatePackInstalls_packId_organisationId_key" ON "TemplatePackInstalls"("packId", "organisationId");

-- CreateIndex
CREATE INDEX "TemplatePackInstalls_organisationId_idx" ON "TemplatePackInstalls"("organisationId");

-- AddForeignKey
ALTER TABLE "TemplatePackItems" ADD CONSTRAINT "TemplatePackItems_packId_fkey" FOREIGN KEY ("packId") REFERENCES "TemplatePacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TemplatePackInstalls" ADD CONSTRAINT "TemplatePackInstalls_packId_fkey" FOREIGN KEY ("packId") REFERENCES "TemplatePacks"("id") ON DELETE CASCADE ON UPDATE CASCADE;
