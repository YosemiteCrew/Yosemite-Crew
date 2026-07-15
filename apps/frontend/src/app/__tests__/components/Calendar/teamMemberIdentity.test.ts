import {
  buildTeamMemberNameMap,
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
