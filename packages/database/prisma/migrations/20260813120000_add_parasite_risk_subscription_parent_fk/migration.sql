-- The subscription table shipped without a foreign key, so any row written
-- before this migration can already point at a deleted parent. The constraint
-- is validated against existing rows, so those orphans are removed first.
DELETE FROM "ParasiteRiskSubscription" s
WHERE NOT EXISTS (SELECT 1 FROM "Parent" p WHERE p."id" = s."parentId");

-- AddForeignKey
ALTER TABLE "ParasiteRiskSubscription" ADD CONSTRAINT "ParasiteRiskSubscription_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
