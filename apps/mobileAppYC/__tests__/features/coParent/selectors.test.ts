import {
  selectCoParents,
  selectPendingInvites,
  selectInvitesLoading,
  selectAccessLoading,
  selectCoParentLoading,
  selectCoParentError,
  selectSelectedCoParentId,
  selectSelectedCoParent,
  selectCoParentById,
  selectAcceptedCoParents,
  selectPendingCoParents,
  selectAccessByCompanionId,
  selectAccessForCompanion,
} from '../../../src/features/coParent/selectors';
import type {RootState} from '../../../src/app/store';

describe('coParent selectors', () => {
  const mockCoParents = [
    {id: '1', name: 'Parent 1', status: 'Accepted'},
    {id: '2', name: 'Parent 2', status: 'pending'},
    {id: '3', name: 'Parent 3', status: 'rejected'},
  ];

  // We cast as unknown then as RootState to satisfy the strict type checks
  // of RootState which likely includes PersistPartial types
  const mockState = {
    coParent: {
      coParents: mockCoParents,
      pendingInvites: [{token: 'abc'}],
      accessByCompanionId: {
        comp1: {role: 'admin'},
        comp2: {role: 'viewer'},
      },
      defaultAccess: null,
      lastFetchedRole: null,
      lastFetchedPermissions: null,
      loading: true,
      invitesLoading: false,
      accessLoading: true,
      error: 'Test Error',
      selectedCoParentId: '1',
    },
  } as unknown as RootState;

  // --- 1. Basic State Selectors ---

  it('selectCoParents returns the coParents array', () => {
    expect(selectCoParents(mockState)).toEqual(mockCoParents);
  });

  it('selectPendingInvites returns pendingInvites', () => {
    expect(selectPendingInvites(mockState)).toEqual([{token: 'abc'}]);
  });

  it('selectInvitesLoading returns invitesLoading flag', () => {
    expect(selectInvitesLoading(mockState)).toBe(false);
  });

  it('selectAccessLoading returns accessLoading flag', () => {
    expect(selectAccessLoading(mockState)).toBe(true);
  });

  it('selectCoParentLoading returns loading flag', () => {
    expect(selectCoParentLoading(mockState)).toBe(true);
  });

  it('selectCoParentError returns error string', () => {
    expect(selectCoParentError(mockState)).toBe('Test Error');
  });

  it('selectSelectedCoParentId returns the selected ID', () => {
    expect(selectSelectedCoParentId(mockState)).toBe('1');
  });

  // --- 2. Derived Selectors (Filters) ---

  it('selectSelectedCoParent returns the object matching the ID', () => {
    expect(selectSelectedCoParent(mockState)).toEqual(mockCoParents[0]);
  });

  it('selectSelectedCoParent returns null if ID not found or null', () => {
    // Explicitly cast the modified state to RootState
    const stateNoSelection = {
      ...mockState,
      coParent: {...mockState.coParent, selectedCoParentId: null},
    } as unknown as RootState;
    expect(selectSelectedCoParent(stateNoSelection)).toBeNull();

    const stateInvalidId = {
      ...mockState,
      coParent: {...mockState.coParent, selectedCoParentId: '999'},
    } as unknown as RootState;
    expect(selectSelectedCoParent(stateInvalidId)).toBeUndefined();
  });

  it('selectAcceptedCoParents filters strictly for "accepted" status (case insensitive)', () => {
    const result = selectAcceptedCoParents(mockState);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('1'); // "Accepted"
  });

  it('selectPendingCoParents filters strictly for "pending" status (case insensitive)', () => {
    const result = selectPendingCoParents(mockState);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2'); // "pending"
  });

  // --- 3. Parameterized Selectors ---

  describe('selectCoParentById', () => {
    it('returns the correct parent when found', () => {
      const selector = selectCoParentById('2');
      expect(selector(mockState)).toEqual(mockCoParents[1]);
    });

    it('returns undefined if not found', () => {
      const selector = selectCoParentById('999');
      expect(selector(mockState)).toBeUndefined();
    });
  });

  describe('Access Selectors', () => {
    it('selectAccessByCompanionId returns the map', () => {
      expect(selectAccessByCompanionId(mockState)).toEqual({
        comp1: {role: 'admin'},
        comp2: {role: 'viewer'},
      });
    });

    it('selectAccessByCompanionId returns empty object if state is undefined', () => {
      // Simulating scenario where slice hasn't initialized
      expect(selectAccessByCompanionId({} as unknown as RootState)).toEqual({});
    });

    it('selectAccessForCompanion returns specific access object', () => {
      expect(selectAccessForCompanion(mockState, 'comp1')).toEqual({
        role: 'admin',
      });
    });

    it('selectAccessForCompanion returns null if ID is missing or not found', () => {
      expect(selectAccessForCompanion(mockState, 'comp999')).toBeNull();
      expect(selectAccessForCompanion(mockState, null)).toBeNull();
      expect(selectAccessForCompanion(mockState, undefined)).toBeNull();
    });
  });

  // --- 4. Edge Case: Default State Fallback ---

  it('uses default state if coParent slice is undefined in RootState', () => {
    const emptyState = {} as unknown as RootState;
    // Should return default empty array from defaultCoParentState
    expect(selectCoParents(emptyState)).toEqual([]);
    expect(selectCoParentLoading(emptyState)).toBe(false);
  });

  it('handles missing status property gracefully in filters', () => {
    // Setup state where a parent has no status
    const weirdState = {
      coParent: {
        ...mockState.coParent,
        coParents: [{id: '4', name: 'No Status'}] as any,
      },
    } as unknown as RootState;

    // Logic: (cp.status ?? '').toLowerCase()
    // Should not crash, just filter out
    expect(selectAcceptedCoParents(weirdState)).toEqual([]);
    expect(selectPendingCoParents(weirdState)).toEqual([]);
  });
});