-- CreateEnum
CREATE TYPE "MaintenanceType" AS ENUM (
    'ROUTINE_SERVICE','CALIBRATION','REPAIR','INSPECTION',
    'CLEANING','REPLACEMENT','SOFTWARE_UPDATE'
);
CREATE TYPE "EquipmentStatus" AS ENUM (
    'OPERATIONAL','UNDER_MAINTENANCE','DECOMMISSIONED','AWAITING_REPAIR'
);

-- Add AuditEventType values
ALTER TYPE "AuditEventType" ADD VALUE IF NOT EXISTS 'EQUIPMENT_MAINTENANCE_LOGGED';

-- CreateTable: ClinicEquipment
CREATE TABLE "ClinicEquipment" (
    "id"             TEXT NOT NULL,
    "organisationId" TEXT NOT NULL,
    "name"           TEXT NOT NULL,
    "model"          TEXT,
    "serialNumber"   TEXT,
    "manufacturer"   TEXT,
    "purchasedAt"    TIMESTAMP(3),
    "warrantyExpiry" TIMESTAMP(3),
    "status"         "EquipmentStatus" NOT NULL DEFAULT 'OPERATIONAL',
    "locationNotes"  TEXT,
    "notes"          TEXT,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ClinicEquipment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ClinicEquipment_organisationId_idx" ON "ClinicEquipment"("organisationId");

-- CreateTable: EquipmentMaintenanceLog
CREATE TABLE "EquipmentMaintenanceLog" (
    "id"              TEXT NOT NULL,
    "equipmentId"     TEXT NOT NULL,
    "maintenanceType" "MaintenanceType" NOT NULL,
    "performedBy"     TEXT,
    "vendor"          TEXT,
    "scheduledAt"     TIMESTAMP(3),
    "performedAt"     TIMESTAMP(3) NOT NULL,
    "nextDueAt"       TIMESTAMP(3),
    "cost"            DOUBLE PRECISION,
    "currency"        TEXT,
    "passed"          BOOLEAN,
    "notes"           TEXT,
    "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EquipmentMaintenanceLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EquipmentMaintenanceLog_equipmentId_idx"            ON "EquipmentMaintenanceLog"("equipmentId");
CREATE INDEX "EquipmentMaintenanceLog_equipmentId_performedAt_idx" ON "EquipmentMaintenanceLog"("equipmentId", "performedAt");

ALTER TABLE "EquipmentMaintenanceLog"
    ADD CONSTRAINT "EquipmentMaintenanceLog_equipmentId_fkey"
    FOREIGN KEY ("equipmentId") REFERENCES "ClinicEquipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
