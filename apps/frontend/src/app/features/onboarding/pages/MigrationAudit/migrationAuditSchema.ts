import type { MigrationAuditFileRole } from '@/app/features/onboarding/services/migrationAuditService';

export interface MigrationAuditSectionSchema {
  role: MigrationAuditFileRole;
  label: string;
  required: boolean;
  columns: readonly string[];
}

/**
 * #3056's backend (apps/backend/src/services/migration-audit-plan.ts) is the
 * source of truth for these columns and limits, and publishes no metadata
 * endpoint for them (out of scope for #3057 - "no new backend endpoint"). This
 * is the UI's own copy for the "published per-section column list and
 * row/bytes limits shown up front" requirement; keep the two in sync if the
 * backend planner's supported columns or limits change.
 */
export const MIGRATION_AUDIT_SECTIONS: readonly MigrationAuditSectionSchema[] = [
  {
    role: 'owners',
    label: 'Owners',
    required: true,
    columns: ['external_id', 'first_name', 'last_name', 'email', 'phone'],
  },
  {
    role: 'animals',
    label: 'Animals',
    required: true,
    columns: ['external_id', 'owner_external_id', 'name', 'species', 'date_of_birth'],
  },
  {
    role: 'appointments',
    label: 'Appointments',
    required: true,
    columns: ['external_id', 'animal_external_id', 'owner_external_id', 'date', 'reason'],
  },
  {
    role: 'attachments',
    label: 'Attachments',
    required: false,
    columns: ['external_id', 'animal_external_id', 'filename', 'sha256'],
  },
];

export const MIGRATION_AUDIT_LIMITS = {
  maxFileBytes: 5 * 1024 * 1024,
  maxRowsPerFile: 5000,
} as const;

export const MIGRATION_AUDIT_SECTION_LABELS: Record<string, string> = {
  OWNERS: 'Owners',
  ANIMALS: 'Animals',
  APPOINTMENTS: 'Appointments',
  ATTACHMENTS: 'Attachments',
};
