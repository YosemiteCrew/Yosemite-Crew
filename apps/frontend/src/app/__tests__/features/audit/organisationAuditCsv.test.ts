import { organisationAuditCsv } from '@/app/features/audit/organisationAuditCsv';
import type { OrganisationAuditEntry } from '@/app/features/audit/types/audit';

const entry: OrganisationAuditEntry = {
  id: 'audit-1',
  patientId: 'patient-1',
  eventType: 'TASK_STATUS_CHANGED',
  actorType: 'PMS_USER',
  actorName: 'Avery, "Dr"',
  entityType: 'TASK',
  occurredAt: '2026-09-28T09:00:00.000Z',
};

describe('organisationAuditCsv', () => {
  it('exports summary fields with correct CSV quoting and line endings', () => {
    expect(organisationAuditCsv([entry])).toBe(
      '"Occurred at (UTC)","Event","Updated by","Record type","Record reference"\r\n' +
        '"2026-09-28T09:00:00.000Z","Task updated","Avery, ""Dr""","Task","patient-1"'
    );
  });

  it('neutralizes spreadsheet formulas and uses safe actor and record fallbacks', () => {
    expect(
      organisationAuditCsv([
        {
          ...entry,
          patientId: ' =HYPERLINK("x")',
          actorName: null,
          actorType: null,
          entityType: null,
        },
      ])
    ).toContain('"Unknown","Record","\' =HYPERLINK(""x"")"');
    expect(organisationAuditCsv([{ ...entry, patientId: '\tcmd' }])).toContain('"\'\tcmd"');
    expect(organisationAuditCsv([]).split('\r\n')).toHaveLength(1);
  });
});
