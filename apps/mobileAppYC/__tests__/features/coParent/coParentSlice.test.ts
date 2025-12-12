import reducer, {
  setSelectedCoParent,
  clearError,
  resetCoParentState,
} from '../../../src/features/coParent/coParentSlice';
import {
  fetchCoParents,
  addCoParent,
  updateCoParentPermissions,
  deleteCoParent,
  fetchPendingInvites,
  acceptCoParentInvite,
  declineCoParentInvite,
  fetchParentAccess,
} from '../../../src/features/coParent/thunks';
import {CoParentState} from '../../../src/features/coParent/types';

describe('coParentSlice', () => {
  const initialState: CoParentState = {
    coParents: [],
    pendingInvites: [],
    accessByCompanionId: {},
    defaultAccess: null,
    lastFetchedRole: null,
    lastFetchedPermissions: null,
    loading: false,
    invitesLoading: false,
    accessLoading: false,
    error: null,
    selectedCoParentId: null,
  };

  // --- Synchronous Reducers ---

  it('should return the initial state on first run', () => {
    const nextState = reducer(undefined, {type: 'unknown'});
    expect(nextState).toEqual(initialState);
  });

  it('should set selectedCoParentId', () => {
    const nextState = reducer(initialState, setSelectedCoParent('123'));
    expect(nextState.selectedCoParentId).toEqual('123');
  });

  it('should clear error', () => {
    const errorState = {...initialState, error: 'Something went wrong'};
    const nextState = reducer(errorState, clearError());
    expect(nextState.error).toBeNull();
  });

  it('should reset state to initial', () => {
    const modifiedState = {
      ...initialState,
      loading: true,
      coParents: [{id: '1'} as any],
    };
    const nextState = reducer(modifiedState, resetCoParentState());
    expect(nextState).toEqual(initialState);
  });

  // --- Async Thunks: fetchCoParents ---

  describe('fetchCoParents', () => {
    it('sets loading on pending', () => {
      const action = {type: fetchCoParents.pending.type};
      const nextState = reducer(initialState, action);
      expect(nextState.loading).toBe(true);
      expect(nextState.error).toBeNull();
    });

    it('sets coParents on fulfilled', () => {
      const mockData = [{id: '1', name: 'Mom'}];
      const action = {type: fetchCoParents.fulfilled.type, payload: mockData};
      const nextState = reducer(initialState, action);
      expect(nextState.loading).toBe(false);
      expect(nextState.coParents).toEqual(mockData);
    });

    it('sets error on rejected', () => {
      const action = {
        type: fetchCoParents.rejected.type,
        payload: 'Fetch error',
      };
      const nextState = reducer(initialState, action);
      expect(nextState.loading).toBe(false);
      expect(nextState.error).toBe('Fetch error');
    });
  });

  // --- Async Thunks: addCoParent ---

  describe('addCoParent', () => {
    it('sets loading on pending', () => {
      const nextState = reducer(initialState, {type: addCoParent.pending.type});
      expect(nextState.loading).toBe(true);
    });

    it('adds new coParent if ID does not exist', () => {
      const existing = {id: '1', name: 'Dad'};
      const newItem = {id: '2', name: 'Mom'};
      const startState = {...initialState, coParents: [existing] as any};

      const action = {type: addCoParent.fulfilled.type, payload: newItem};
      const nextState = reducer(startState, action);

      expect(nextState.loading).toBe(false);
      expect(nextState.coParents).toHaveLength(2);
      expect(nextState.coParents[1]).toEqual(newItem);
    });

    it('updates existing coParent if ID exists', () => {
      const existing = {id: '1', name: 'Dad (Old)'};
      const update = {id: '1', name: 'Dad (New)'};
      const startState = {...initialState, coParents: [existing] as any};

      const action = {type: addCoParent.fulfilled.type, payload: update};
      const nextState = reducer(startState, action);

      expect(nextState.loading).toBe(false);
      expect(nextState.coParents).toHaveLength(1);
      expect(nextState.coParents[0]).toEqual(update);
    });

    it('sets error on rejected', () => {
      const action = {type: addCoParent.rejected.type, payload: 'Add Failed'};
      const nextState = reducer(initialState, action);
      expect(nextState.loading).toBe(false);
      expect(nextState.error).toBe('Add Failed');
    });
  });

  // --- Async Thunks: updateCoParentPermissions ---

  describe('updateCoParentPermissions', () => {
    it('sets loading on pending', () => {
      const nextState = reducer(initialState, {
        type: updateCoParentPermissions.pending.type,
      });
      expect(nextState.loading).toBe(true);
    });

    it('updates specific coParent on fulfilled', () => {
      const existing = {id: '1', role: 'Viewer'};
      const updated = {id: '1', role: 'Editor'};
      const startState = {...initialState, coParents: [existing] as any};

      const action = {
        type: updateCoParentPermissions.fulfilled.type,
        payload: updated,
      };
      const nextState = reducer(startState, action);
      expect(nextState.coParents[0]).toEqual(updated);
    });

    it('does nothing if coParent not found on fulfilled', () => {
      const startState = {...initialState, coParents: []};
      const action = {
        type: updateCoParentPermissions.fulfilled.type,
        payload: {id: '999'},
      };
      const nextState = reducer(startState, action);
      expect(nextState.coParents).toHaveLength(0);
    });

    it('sets error on rejected', () => {
      const action = {
        type: updateCoParentPermissions.rejected.type,
        payload: 'Update Failed',
      };
      const nextState = reducer(initialState, action);
      expect(nextState.loading).toBe(false);
      expect(nextState.error).toBe('Update Failed');
    });
  });

  // --- Async Thunks: deleteCoParent ---

  describe('deleteCoParent', () => {
    it('sets loading on pending', () => {
      const nextState = reducer(initialState, {
        type: deleteCoParent.pending.type,
      });
      expect(nextState.loading).toBe(true);
    });

    it('removes coParent on fulfilled', () => {
      const startState = {
        ...initialState,
        coParents: [{id: '1'}, {id: '2'}] as any,
      };
      const action = {
        type: deleteCoParent.fulfilled.type,
        payload: {coParentId: '1'},
      };
      const nextState = reducer(startState, action);
      expect(nextState.coParents).toHaveLength(1);
      expect(nextState.coParents[0].id).toBe('2');
    });

    it('sets error on rejected', () => {
      const action = {
        type: deleteCoParent.rejected.type,
        payload: 'Delete error',
      };
      const nextState = reducer(initialState, action);
      expect(nextState.loading).toBe(false);
      expect(nextState.error).toBe('Delete error');
    });
  });

  // --- Async Thunks: fetchPendingInvites ---

  describe('fetchPendingInvites', () => {
    it('sets invitesLoading on pending', () => {
      const nextState = reducer(initialState, {
        type: fetchPendingInvites.pending.type,
      });
      expect(nextState.invitesLoading).toBe(true);
    });

    it('sets pendingInvites on fulfilled', () => {
      const invites = [{token: 'abc'}];
      const action = {
        type: fetchPendingInvites.fulfilled.type,
        payload: invites,
      };
      const nextState = reducer(initialState, action);
      expect(nextState.invitesLoading).toBe(false);
      expect(nextState.pendingInvites).toEqual(invites);
    });

    it('sets error on rejected', () => {
      const action = {
        type: fetchPendingInvites.rejected.type,
        payload: 'Invite error',
      };
      const nextState = reducer(initialState, action);
      expect(nextState.invitesLoading).toBe(false);
      expect(nextState.error).toBe('Invite error');
    });
  });

  // --- Async Thunks: acceptCoParentInvite ---

  describe('acceptCoParentInvite', () => {
    it('removes the accepted invite from list on fulfilled', () => {
      const startState = {
        ...initialState,
        pendingInvites: [{token: 'abc'}, {token: 'xyz'}] as any,
      };
      const action = {
        type: acceptCoParentInvite.fulfilled.type,
        payload: 'abc', // payload is the token string
      };
      const nextState = reducer(startState, action);
      expect(nextState.pendingInvites).toHaveLength(1);
      expect(nextState.pendingInvites[0].token).toBe('xyz');
      expect(nextState.invitesLoading).toBe(false);
    });

    it('sets error on rejected', () => {
      const action = {
        type: acceptCoParentInvite.rejected.type,
        payload: 'Accept failed',
      };
      const nextState = reducer(initialState, action);
      expect(nextState.invitesLoading).toBe(false);
      expect(nextState.error).toBe('Accept failed');
    });
  });

  // --- Async Thunks: declineCoParentInvite ---

  describe('declineCoParentInvite', () => {
    it('removes the declined invite from list on fulfilled', () => {
      const startState = {
        ...initialState,
        pendingInvites: [{token: 'abc'}, {token: 'xyz'}] as any,
      };
      const action = {
        type: declineCoParentInvite.fulfilled.type,
        payload: 'xyz',
      };
      const nextState = reducer(startState, action);
      expect(nextState.pendingInvites).toHaveLength(1);
      expect(nextState.pendingInvites[0].token).toBe('abc');
      expect(nextState.invitesLoading).toBe(false);
    });

    it('sets error on rejected', () => {
      const action = {
        type: declineCoParentInvite.rejected.type,
        payload: 'Decline failed',
      };
      const nextState = reducer(initialState, action);
      expect(nextState.invitesLoading).toBe(false);
      expect(nextState.error).toBe('Decline failed');
    });
  });

  // --- Async Thunks: fetchParentAccess (Complex Logic) ---

  describe('fetchParentAccess', () => {
    it('sets accessLoading on pending', () => {
      const nextState = reducer(initialState, {
        type: fetchParentAccess.pending.type,
      });
      expect(nextState.accessLoading).toBe(true);
    });

    it('handles fulfilled correctly (maps access and sets defaults)', () => {
      const mockPayload = [
        {companionId: 'c1', role: 'viewer'},
        {companionId: null, role: 'admin'}, // Global/Default access
      ];

      const action = {
        type: fetchParentAccess.fulfilled.type,
        payload: mockPayload,
      };

      const nextState = reducer(initialState, action);

      // Check accessByCompanionId mapping
      // FIX: Changed from ['c1'] to .c1 to satisfy dot-notation lint rule
      expect(nextState.accessByCompanionId.c1).toEqual(mockPayload[0]);

      // Check defaultAccess logic (first one without companionId)
      expect(nextState.defaultAccess).toEqual(mockPayload[1]);

      // Check lastFetchedRole logic (first item in array has role)
      expect(nextState.lastFetchedRole).toBe('viewer');

      expect(nextState.accessLoading).toBe(false);
    });

    it('handles fulfilled with only non-role items (fallback logic)', () => {
      // Logic: const first = updates.find(u => Boolean(u.role)) ?? updates[0];
      const mockPayload = [
        {companionId: 'c2', permissions: 'read'}, // No role property
      ];

      const action = {
        type: fetchParentAccess.fulfilled.type,
        payload: mockPayload,
      };
      const nextState = reducer(initialState, action);

      // Should fall back to updates[0]
      expect(nextState.lastFetchedPermissions).toBe('read');
      expect(nextState.lastFetchedRole).toBeNull();
    });

    it('does not overwrite defaultAccess if already set', () => {
      const existingDefault = {companionId: null, role: 'original'};
      const startState = {
        ...initialState,
        defaultAccess: existingDefault as any,
      };

      const newPayload = [{companionId: null, role: 'new'}]; // Should ideally use ??= to ignore this

      const action = {
        type: fetchParentAccess.fulfilled.type,
        payload: newPayload,
      };
      const nextState = reducer(startState, action);

      expect(nextState.defaultAccess).toEqual(existingDefault);
    });

    it('sets error on rejected', () => {
      const action = {
        type: fetchParentAccess.rejected.type,
        payload: 'Access Error',
      };
      const nextState = reducer(initialState, action);
      expect(nextState.accessLoading).toBe(false);
      expect(nextState.error).toBe('Access Error');
    });
  });
});