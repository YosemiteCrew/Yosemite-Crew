-- ATCvet: the WHO CC veterinary drug classification, added as its own code system
-- alongside the clinical vocabularies.
--
-- Values are appended BEFORE 'OTHER' so a freshly created database enumerates them
-- in the same order as schema.prisma declares them. Appending at the end instead
-- leaves fresh and migrated databases with different enum orderings, which shows up
-- much later as an unexplained ordering difference between environments.
ALTER TYPE "CodeSystem" ADD VALUE IF NOT EXISTS 'ATCVET';

ALTER TYPE "CodeType" ADD VALUE IF NOT EXISTS 'MEDICATION' BEFORE 'OTHER';
ALTER TYPE "CodeType" ADD VALUE IF NOT EXISTS 'MEDICATION_CATEGORY' BEFORE 'OTHER';
