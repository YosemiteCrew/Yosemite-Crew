import { renderHook } from '@testing-library/react-native';
import { usePermissions } from '../../src/shared/hooks/usePermissions';
import * as reactRedux from 'react-redux';

// --- Mocks ---
jest.mock('react-redux', () => ({
  useSelector: jest.fn(),
}));

describe('usePermissions Hook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Helper to verify selectors work correctly
  const mockState = (coParentState: any) => {
    (reactRedux.useSelector as unknown as jest.Mock).mockImplementation((selector) =>
      selector({
        coParent: coParentState,
      })
    );
  };

  // ===========================================================================
  // 1. Fallback & Initialization Logic
  // ===========================================================================

  it('handles empty/undefined redux state gracefully (defaults)', () => {
    // Simulate empty state
    mockState(undefined);

    const { result } = renderHook(() => usePermissions(null));

    expect(result.current.role).toBe('');
    expect(result.current.isPrimary).toBe(false);
    expect(result.current.canUseAppointments).toBe(false);
    expect(result.current.permissions).toBeUndefined();
  });

  it('uses EMPTY_ACCESS_MAP if accessByCompanionId is undefined', () => {
    // Simulate state where coParent exists but map is missing
    mockState({ accessByCompanionId: undefined });

    const { result } = renderHook(() => usePermissions('some-id'));

    // Should behave safely and not crash
    expect(result.current.accessForCompanion).toBeNull();
  });

  // ===========================================================================
  // 2. Role Resolution Logic (Fallback Chain)
  // ===========================================================================

  it('prioritizes Companion Access role when ID is provided and found', () => {
    mockState({
      accessByCompanionId: {
        'comp-1': { role: 'SECONDARY_COMPANION' },
      },
      defaultAccess: { role: 'DEFAULT_ROLE' },
      lastFetchedRole: 'GLOBAL_ROLE',
    });

    const { result } = renderHook(() => usePermissions('comp-1'));

    expect(result.current.role).toBe('SECONDARY_COMPANION');
  });

  it('falls back to Default Access role if Companion ID not found in map', () => {
    mockState({
      accessByCompanionId: {},
      defaultAccess: { role: 'DEFAULT_ROLE' },
      lastFetchedRole: 'GLOBAL_ROLE',
    });

    // Requesting 'comp-1' which doesn't exist
    const { result } = renderHook(() => usePermissions('comp-1'));

    expect(result.current.role).toBe('DEFAULT_ROLE');
  });

  it('falls back to Default Access role if no ID is provided', () => {
    mockState({
      accessByCompanionId: { 'comp-1': { role: 'COMP_ROLE' } },
      defaultAccess: { role: 'DEFAULT_ROLE' },
      lastFetchedRole: 'GLOBAL_ROLE',
    });

    // selectedCompanionId is null
    const { result } = renderHook(() => usePermissions(null));

    expect(result.current.role).toBe('DEFAULT_ROLE');
  });

  it('falls back to Global Role if neither Companion nor Default access exist', () => {
    mockState({
      accessByCompanionId: {},
      defaultAccess: null,
      lastFetchedRole: 'GLOBAL_ROLE',
    });

    const { result } = renderHook(() => usePermissions(null));

    expect(result.current.role).toBe('GLOBAL_ROLE');
  });

  // ===========================================================================
  // 3. Permission Resolution Logic (isPrimary vs Specifics)
  // ===========================================================================

  it('grants all access if role includes "PRIMARY"', () => {
    mockState({
      lastFetchedRole: 'PRIMARY_OWNER',
      // Permissions explicitly false/missing to ensure Role overrides them
      lastFetchedPermissions: { appointments: false },
    });

    const { result } = renderHook(() => usePermissions(null));

    expect(result.current.isPrimary).toBe(true);
    expect(result.current.canUseAppointments).toBe(true);
    expect(result.current.canUseChat).toBe(true);
    expect(result.current.canUseTasks).toBe(true);
    expect(result.current.canUseEmergency).toBe(true);
    expect(result.current.checkPermission('photos')).toBe(true);
  });

  it('checks specific permissions if role is NOT Primary', () => {
    mockState({
      lastFetchedRole: 'SECONDARY',
      lastFetchedPermissions: {
        appointments: true,
        chatWithVet: false,
        tasks: true,
        emergencyBasedPermissions: false,
      },
    });

    const { result } = renderHook(() => usePermissions(null));

    expect(result.current.isPrimary).toBe(false);

    // Explicit checks
    expect(result.current.canUseAppointments).toBe(true);
    expect(result.current.canUseChat).toBe(false);
    expect(result.current.canUseTasks).toBe(true);
    expect(result.current.canUseEmergency).toBe(false);
  });

  it('checkPermission callback returns false if permissions are undefined (and not primary)', () => {
    mockState({
      lastFetchedRole: 'SECONDARY',
      lastFetchedPermissions: undefined, // No permissions loaded
    });

    const { result } = renderHook(() => usePermissions(null));

    expect(result.current.checkPermission('appointments')).toBe(false);
  });

  it('checkPermission callback returns the boolean value of the permission key', () => {
    mockState({
      lastFetchedRole: 'SECONDARY',
      lastFetchedPermissions: {
        documents: true,
        photos: false,
      },
    });

    const { result } = renderHook(() => usePermissions(null));

    expect(result.current.checkPermission('documents')).toBe(true);
    expect(result.current.checkPermission('photos')).toBe(false);
  });

  // ===========================================================================
  // 4. Branch Coverage (Optional Chaining & Null Coalescing)
  // ===========================================================================

  it('handles null defaultAccess and accessForCompanion correctly for permissions lookup', () => {
    // This targets the line:
    // accessForCompanion?.permissions ?? defaultAccess?.permissions ?? globalPermissions

    mockState({
      lastFetchedPermissions: { appointments: true }, // Global fallback
    });

    const { result } = renderHook(() => usePermissions(null));

    // Should fall through to global
    expect(result.current.permissions).toEqual({ appointments: true });
    expect(result.current.canUseAppointments).toBe(true);
  });

  it('resolves defaultAccess when ID provided but map lookup fails', () => {
    // This targets: accessMap[selectedCompanionId] ?? defaultAccess ?? null
    // Specifically where map[id] is undefined, so it takes defaultAccess
    mockState({
      accessByCompanionId: {},
      defaultAccess: { permissions: { tasks: true } },
    });

    const { result } = renderHook(() => usePermissions('missing-id'));

    expect(result.current.permissions).toEqual({ tasks: true });
    expect(result.current.canUseTasks).toBe(true);
  });
});