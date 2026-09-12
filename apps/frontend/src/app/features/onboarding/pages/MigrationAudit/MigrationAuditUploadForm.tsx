import React from 'react';

import { Primary } from '@/app/ui/primitives/Buttons';
import type { MigrationAuditFileRole } from '@/app/features/onboarding/services/migrationAuditService';
import { MIGRATION_AUDIT_LIMITS, MIGRATION_AUDIT_SECTIONS } from './migrationAuditSchema';

const formatMegabytes = (bytes: number): string => `${Math.round(bytes / (1024 * 1024))} MB`;

export interface MigrationAuditUploadFormProps {
  files: Partial<Record<MigrationAuditFileRole, File>>;
  onFileChange: (role: MigrationAuditFileRole, file: File | null) => void;
  submitting: boolean;
  canSubmit: boolean;
  onSubmit: () => void;
}

/**
 * The upload step: one CSV per section (owners/animals/appointments required,
 * attachments optional), with the published column list and size/row limits
 * shown up front - #3057's own acceptance criterion, since #3056 publishes no
 * metadata endpoint for them.
 */
const MigrationAuditUploadForm = ({
  files,
  onFileChange,
  submitting,
  canSubmit,
  onSubmit,
}: MigrationAuditUploadFormProps) => (
  <div className="MigrationAudit-upload yc-card-surface">
    <p className="text-body-3 text-text-secondary MigrationAudit-limits">
      Each file is a CSV, up to {formatMegabytes(MIGRATION_AUDIT_LIMITS.maxFileBytes)} and{' '}
      {MIGRATION_AUDIT_LIMITS.maxRowsPerFile.toLocaleString()} rows. Columns outside the supported
      set are reported as findings, never silently dropped.
    </p>

    <div className="MigrationAudit-fileList">
      {MIGRATION_AUDIT_SECTIONS.map((section) => {
        const inputId = `migration-audit-file-${section.role}`;
        const selected = files[section.role];
        return (
          <div key={section.role} className="MigrationAudit-fileRow">
            <div className="MigrationAudit-fileHeading">
              <label htmlFor={inputId} className="text-body-2 text-text-primary">
                {section.label}
              </label>
              <span
                className={`MigrationAudit-badge ${
                  section.required
                    ? 'MigrationAudit-badge--required'
                    : 'MigrationAudit-badge--optional'
                }`}
              >
                {section.required ? 'Required' : 'Optional'}
              </span>
            </div>
            <p className="text-caption-2 text-text-tertiary MigrationAudit-columns">
              Columns: {section.columns.join(', ')}
            </p>
            <input
              id={inputId}
              type="file"
              accept=".csv,text/csv"
              onChange={(event) => onFileChange(section.role, event.target.files?.[0] ?? null)}
              disabled={submitting}
            />
            {selected && (
              <p
                className="text-caption-2 text-text-secondary"
                data-testid={`migration-audit-selected-${section.role}`}
              >
                {selected.name}
              </p>
            )}
          </div>
        );
      })}
    </div>

    <Primary
      text={submitting ? 'Uploading…' : 'Run migration audit'}
      onClick={onSubmit}
      isDisabled={submitting || !canSubmit}
      type="button"
    />
  </div>
);

export default MigrationAuditUploadForm;
