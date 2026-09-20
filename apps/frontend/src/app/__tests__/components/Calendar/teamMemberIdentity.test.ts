import {
  buildTeamMemberNameMap,
  resolveMemberDisplayName,
  resolveTeamMemberPrimaryId,
} from '@/app/features/appointments/components/Calendar/appointmentDragAvailabilityUtils';

const normalizeId = (value?: string) =>
  String(value ?? '')
    .trim()
    .split('/')
    .pop()
    ?.toLowerCase() ?? '';

const teams = [
  { practionerId: 'prac-1', _id: 'mongo-1', name: 'Dr. One' },
  { _id: 'mongo-2', userId: 'user-2', displayName: 'Dr. Two' },
] as any;

describe('resolveTeamMemberPrimaryId', () => {
  it('returns an empty string for a missing candidate', () => {
    expect(resolveTeamMemberPrimaryId(teams, undefined, normalizeId)).toBe('');
  });

  it('prefers the practitioner id when the member has one', () => {
    expect(resolveTeamMemberPrimaryId(teams, 'mongo-1', normalizeId)).toBe('prac-1');
  });

  it('falls back through other identity fields', () => {
    expect(resolveTeamMemberPrimaryId(teams, 'user-2', normalizeId)).toBe('user-2');
  });

  it('returns the candidate id when no member matches', () => {
    expect(resolveTeamMemberPrimaryId(teams, 'unknown', normalizeId)).toBe('unknown');
  });
});

describe('buildTeamMemberNameMap', () => {
  it('maps every identity id of a member to its display name', () => {
    const map = buildTeamMemberNameMap(teams, normalizeId);
    expect(map['prac-1']).toBe('Dr. One');
    expect(map['mongo-1']).toBe('Dr. One');
    expect(map['user-2']).toBe('Dr. Two');
  });
});

describe('resolveMemberDisplayName', () => {
  const teamNameById = buildTeamMemberNameMap(teams, normalizeId);

  it('returns a dash for a missing id', () => {
    expect(resolveMemberDisplayName(undefined, normalizeId, () => '-', teamNameById)).toBe('-');
  });

  it('prefers the member-map lookup when it resolves', () => {
    expect(
      resolveMemberDisplayName('user-2', normalizeId, () => 'Dr. Two (live)', teamNameById)
    ).toBe('Dr. Two (live)');
  });

  it('falls back to the team name map when the member-map lookup is empty', () => {
    expect(resolveMemberDisplayName('mongo-1', normalizeId, () => '-', teamNameById)).toBe(
      'Dr. One'
    );
  });

  it('never exposes the raw id when neither lookup resolves it', () => {
    // A staff id that has since left the org: no live member-map entry and no row
    // in the current team roster either. This must read as "unknown", never as
    // the bare database id it failed to resolve - a raw id leaking into a task's
    // assignee subtitle is exactly the bug this guards.
    expect(
      resolveMemberDisplayName('66f0a1b2c3d4e5f678901234', normalizeId, () => '-', teamNameById)
    ).toBe('-');
  });
});
