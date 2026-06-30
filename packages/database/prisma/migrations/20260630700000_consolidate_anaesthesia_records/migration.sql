-- Drop duplicate AnesthesiaRecord table and its enum (superseded by AnaesthesiaRecord)
DROP TABLE IF EXISTS "AnesthesiaRecord";
DROP TYPE IF EXISTS "AnesthesiaStatus";

-- Add encounterId to AnaesthesiaRecord
ALTER TABLE "AnaesthesiaRecord" ADD COLUMN "encounterId" TEXT;

-- Add anesthesiaType to AnaesthesiaRecord (reuses existing AnesthesiaType enum from SurgicalProcedure)
ALTER TABLE "AnaesthesiaRecord" ADD COLUMN "anesthesiaType" "AnesthesiaType";

-- Change oxygenFlowLpm from DOUBLE PRECISION to DECIMAL for precision
ALTER TABLE "AnaesthesiaRecord"
  ALTER COLUMN "oxygenFlowLpm" TYPE DECIMAL(65,30) USING "oxygenFlowLpm"::DECIMAL(65,30);
