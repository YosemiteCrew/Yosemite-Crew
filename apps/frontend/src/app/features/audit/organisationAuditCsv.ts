import type { OrganisationAuditEntry } from '@/app/features/audit/types/audit';
import {
  getAuditActorLabel,
  getAuditEventLabel,
  getAuditRecordLabel,
} from '@/app/features/audit/auditPresentation';

const csvCell = (value: string): string => {
  // Tab and carriage return also start a formula in some spreadsheet apps.
  const safe = /^(?:[\t\r]|\s*[-=+@])/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
};

export const organisationAuditCsv = (entries: OrganisationAuditEntry[]): string => {
  const rows = [
    ['Occurred at (UTC)', 'Event', 'Updated by', 'Record type', 'Record reference'],
    ...entries.map((entry) => [
      new Date(entry.occurredAt).toISOString(),
      getAuditEventLabel(entry.eventType),
      getAuditActorLabel(entry.actorName, entry.actorType),
      getAuditRecordLabel(entry.entityType),
      entry.patientId,
    ]),
  ];
  return rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
};
