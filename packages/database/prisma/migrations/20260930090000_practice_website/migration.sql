-- A practice's clinic website, built from a template in the website builder.
-- Additive: a new table, nothing existing is altered, and `published` defaults
-- to false so no practice becomes reachable because this migration ran.

-- CreateTable
CREATE TABLE "PracticeWebsite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "templateId" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "tagline" TEXT,
    "about" TEXT,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PracticeWebsite_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PracticeWebsite_organizationId_key" ON "PracticeWebsite"("organizationId");

-- AddForeignKey
ALTER TABLE "PracticeWebsite" ADD CONSTRAINT "PracticeWebsite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Every new table enables row level security, like the booking tables before it.
-- deployed-code-survives: "PracticeWebsite" is created above in this same
-- migration, so no deployed code reads it yet.
ALTER TABLE "PracticeWebsite" ENABLE ROW LEVEL SECURITY;
