import React from 'react';
import type { OperationOutcomeIssue } from '@yosemite-crew/fhir';

import { Secondary } from '@/app/ui/primitives/Buttons';
import StatusPill, { type StatusTone } from '@/app/ui/primitives/StatusPill/StatusPill';
import type {
  MigrationAuditRun,
  MigrationAuditSectionName,
} from '@/app/features/onboarding/services/migrationAuditService';
import { MIGRATION_AUDIT_SECTION_LABELS } from './migrationAuditSchema';

const SECTION_ORDER: MigrationAuditSectionName[] = [
  'OWNERS',
  'ANIMALS',
  'APPOINTMENTS',
  'ATTACHMENTS',
];
const SOURCE_FILE_ORDER = ['owners.csv', 'animals.csv', 'appointments.csv', 'attachments.csv'];
const SEVERITY_ORDER = ['fatal', 'error', 'warning', 'information'];
const ROW_EXPRESSION = /\[row (\d+)]/;

const severityTone = (severity: string): StatusTone => {
  if (severity === 'fatal' || severity === 'error') return 'danger';
  if (severity === 'warning') return 'warning';
  return 'info';
};

/** `expression[0]` is e.g. "owners.csv" or "owners.csv[row 5]" - the file name without a row suffix. */
const sourceFileFor = (issue: OperationOutcomeIssue): string => {
  const expression = issue.expression?.[0] ?? 'unknown';
  const bracket = expression.indexOf('[');
  return bracket === -1 ? expression : expression.slice(0, bracket);
};

const rowFor = (issue: OperationOutcomeIssue): string | null => {
  const match = ROW_EXPRESSION.exec(issue.expression?.[0] ?? '');
  return match ? match[1] : null;
};

const bySourceFileOrder = (a: string, b: string): number => {
  const indexOf = (file: string) => {
    const index = SOURCE_FILE_ORDER.indexOf(file);
    return index === -1 ? SOURCE_FILE_ORDER.length : index;
  };
  return indexOf(a) - indexOf(b);
};

export interface MigrationAuditReviewProps {
  run: MigrationAuditRun;
  /** Absent while a run is in flight - there is nothing to restart yet. */
  onStartNew?: () => void;
}

/**
 * Renders one migration-audit run (#3056's read-only API): the in-flight
 * state while PENDING/RUNNING, the failure reason on FAILED, and on
 * COMPLETED the per-section summary plus every finding grouped by source
 * file and severity - never collapsed to a count, so a practice owner can
 * see exactly which row needs attention before deciding to proceed.
 */
const MigrationAuditReview = ({ run, onStartNew }: MigrationAuditReviewProps) => {
  if (run.status === 'PENDING' || run.status === 'RUNNING') {
    return (
      <output className="MigrationAudit-progress yc-card-surface">
        <p className="text-body-2 text-text-primary">
          Reading the uploaded files and checking for missing, duplicate and orphaned records…
        </p>
      </output>
    );
  }

  if (run.status === 'FAILED') {
    return (
      <div className="MigrationAudit-failed yc-card-surface" role="alert">
        <h2 className="text-heading-3 text-text-primary">Migration audit failed</h2>
        <p className="text-body-3 text-text-secondary">
          {run.errorMessage ?? 'The audit could not be completed. Please try again.'}
        </p>
        {onStartNew && <Secondary text="Start a new audit" onClick={onStartNew} />}
      </div>
    );
  }

  const issuesBySourceFile = new Map<string, OperationOutcomeIssue[]>();
  for (const issue of run.outcome.issue) {
    const file = sourceFileFor(issue);
    const existing = issuesBySourceFile.get(file);
    if (existing) {
      existing.push(issue);
    } else {
      issuesBySourceFile.set(file, [issue]);
    }
  }
  const orderedFiles = [...issuesBySourceFile.keys()].sort(bySourceFileOrder);

  return (
    <div className="MigrationAudit-review">
      <div className="MigrationAudit-summaryGrid">
        {SECTION_ORDER.filter((section) => run.summary?.[section]).map((section) => {
          const summary = run.summary![section]!;
          return (
            <div key={section} className="MigrationAudit-summaryCard yc-card-surface">
              <h2 className="text-heading-3 text-text-primary">
                {MIGRATION_AUDIT_SECTION_LABELS[section]}
              </h2>
              {summary.status === 'NOT_ASSESSED' ? (
                <p className="text-body-3 text-text-secondary">
                  Not assessed
                  {summary.notAssessedReason ? ` (${summary.notAssessedReason})` : ''}.
                </p>
              ) : (
                <dl className="MigrationAudit-summaryStats">
                  <div>
                    <dt className="text-caption-2 text-text-tertiary">Rows</dt>
                    <dd className="text-body-2 text-text-primary">{summary.totalRows}</dd>
                  </div>
                  <div>
                    <dt className="text-caption-2 text-text-tertiary">Duplicates</dt>
                    <dd className="text-body-2 text-text-primary">
                      {summary.duplicateIdentifiers}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-caption-2 text-text-tertiary">Orphan references</dt>
                    <dd className="text-body-2 text-text-primary">{summary.orphanReferences}</dd>
                  </div>
                </dl>
              )}
            </div>
          );
        })}
      </div>

      <section className="MigrationAudit-findings yc-card-surface">
        <h2 className="text-heading-3 text-text-primary">Findings ({run.outcome.issue.length})</h2>
        {run.outcome.issue.length === 0 ? (
          <p className="text-body-3 text-text-secondary">
            No findings - every required file was assessed with no missing, duplicate or orphaned
            records.
          </p>
        ) : (
          orderedFiles.map((file) => {
            const issues = [...(issuesBySourceFile.get(file) ?? [])].sort(
              (a, b) => SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity)
            );
            return (
              <div key={file} className="MigrationAudit-findingGroup">
                <h3 className="text-body-2 text-text-primary MigrationAudit-findingGroupTitle">
                  {file}
                </h3>
                <ul className="MigrationAudit-findingList">
                  {issues.map((issue) => {
                    const row = rowFor(issue);
                    const issueKey = JSON.stringify(issue);
                    return (
                      <li key={issueKey}>
                        <StatusPill label={issue.severity} tone={severityTone(issue.severity)} />
                        {row && <span className="MigrationAudit-findingRow">Row {row}</span>}
                        <p className="text-body-3 text-text-secondary">{issue.diagnostics}</p>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })
        )}
      </section>

      {onStartNew && <Secondary text="Start a new audit" onClick={onStartNew} />}
    </div>
  );
};

export default MigrationAuditReview;
