-- CreateTable
CREATE TABLE "DeveloperSandboxes" (
    "id" TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "sandboxOrganisationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeveloperSandboxes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeveloperSandboxes_organisationId_key" ON "DeveloperSandboxes"("organisationId");

-- CreateIndex
CREATE INDEX "DeveloperSandboxes_sandboxOrganisationId_idx" ON "DeveloperSandboxes"("sandboxOrganisationId");
