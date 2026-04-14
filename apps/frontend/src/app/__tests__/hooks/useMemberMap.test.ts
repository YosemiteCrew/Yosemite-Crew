import { renderHook } from '@testing-library/react';
import { useMemberMap } from '@/app/hooks/useMemberMap';
import { useTeamForPrimaryOrg } from '@/app/hooks/useTeam';
import { useParentStore } from '@/app/stores/parentStore';
import { useAuthStore } from '@/app/stores/authStore';
import { Team } from '@/app/features/organization/types/team';

jest.mock('@/app/hooks/useTeam', () => ({
  useTeamForPrimaryOrg: jest.fn(),
}));

jest.mock('@/app/stores/parentStore', () => ({
  useParentStore: jest.fn(),
}));

jest.mock('@/app/stores/authStore', () => ({
  useAuthStore: jest.fn(),
}));

const makeTeam = (overrides: Partial<Team> = {}): Team =>
  ({
    _id: 'team-1',
    practionerId: 'prac-1',
    name: 'Alice',
    ...overrides,
  }) as Team;

describe('useMemberMap', () => {
  beforeEach(() => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([]);
    (useParentStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ parentsById: {} })
    );
    (useAuthStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        attributes: {
          sub: 'user-1',
          given_name: 'Bob',
          family_name: 'Smith',
          email: 'bob@example.com',
        },
      })
    );
  });

  it('returns a memberMap and resolveMemberName function', () => {
    const { result } = renderHook(() => useMemberMap());
    expect(result.current.memberMap).toBeInstanceOf(Map);
    expect(typeof result.current.resolveMemberName).toBe('function');
  });

  it('includes team members by practionerId', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      makeTeam({ practionerId: 'prac-1', _id: 'team-1', name: 'Alice' }),
    ]);

    const { result } = renderHook(() => useMemberMap());
    expect(result.current.memberMap.get('prac-1')).toBe('Alice');
  });

  it('includes team members by _id', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      makeTeam({ practionerId: undefined, _id: 'team-1', name: 'Carol' }),
    ]);

    const { result } = renderHook(() => useMemberMap());
    expect(result.current.memberMap.get('team-1')).toBe('Carol');
  });

  it('includes parents from parentStore', () => {
    (useParentStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        parentsById: {
          'parent-1': { firstName: 'Jane', lastName: 'Doe' },
        },
      })
    );

    const { result } = renderHook(() => useMemberMap());
    expect(result.current.memberMap.get('parent-1')).toBe('Jane Doe');
  });

  it('uses email for parent when no name', () => {
    (useParentStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({
        parentsById: {
          'parent-2': { email: 'unknown@example.com' },
        },
      })
    );

    const { result } = renderHook(() => useMemberMap());
    expect(result.current.memberMap.get('parent-2')).toBe('unknown@example.com');
  });

  it('uses dash for parent with no name or email', () => {
    (useParentStore as unknown as jest.Mock).mockImplementation((selector: any) =>
      selector({ parentsById: { 'parent-3': {} } })
    );

    const { result } = renderHook(() => useMemberMap());
    expect(result.current.memberMap.get('parent-3')).toBe('-');
  });

  it('includes current user in memberMap', () => {
    const { result } = renderHook(() => useMemberMap());
    expect(result.current.memberMap.get('user-1')).toBe('Bob Smith');
  });

  it('resolveMemberName returns name for known ID', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      makeTeam({ practionerId: 'prac-1', name: 'Alice' }),
    ]);

    const { result } = renderHook(() => useMemberMap());
    expect(result.current.resolveMemberName('prac-1')).toBe('Alice');
  });

  it('resolveMemberName returns dash for unknown ID', () => {
    const { result } = renderHook(() => useMemberMap());
    expect(result.current.resolveMemberName('unknown-id')).toBe('-');
  });

  it('resolveMemberName returns dash for undefined', () => {
    const { result } = renderHook(() => useMemberMap());
    expect(result.current.resolveMemberName(undefined)).toBe('-');
  });

  it('uses team member dash when name is missing', () => {
    (useTeamForPrimaryOrg as jest.Mock).mockReturnValue([
      makeTeam({ practionerId: 'prac-2', name: '' }),
    ]);

    const { result } = renderHook(() => useMemberMap());
    expect(result.current.memberMap.get('prac-2')).toBe('-');
  });
});
