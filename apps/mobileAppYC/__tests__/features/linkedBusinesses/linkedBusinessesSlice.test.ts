import linkedBusinessesReducer, {
  setSelectedCategory,
  clearError,
  initializeMockData,
  resetLinkedBusinesses,
} from '../../../src/features/linkedBusinesses/linkedBusinessesSlice';

// 1. Mock ALL thunks to prevent crashes
jest.mock('../../../src/features/linkedBusinesses/thunks', () => ({
  fetchLinkedBusinesses: {
    pending: {type: 'linkedBusinesses/fetch/pending'},
    fulfilled: {type: 'linkedBusinesses/fetch/fulfilled'},
    rejected: {type: 'linkedBusinesses/fetch/rejected'},
  },
  searchBusinessesByLocation: {
    pending: {type: 'linkedBusinesses/searchByLocation/pending'},
    fulfilled: {type: 'linkedBusinesses/searchByLocation/fulfilled'},
    rejected: {type: 'linkedBusinesses/searchByLocation/rejected'},
  },
  searchBusinessByQRCode: {
    pending: {type: 'linkedBusinesses/searchByQRCode/pending'},
    fulfilled: {type: 'linkedBusinesses/searchByQRCode/fulfilled'},
    rejected: {type: 'linkedBusinesses/searchByQRCode/rejected'},
  },
  addLinkedBusiness: {
    pending: {type: 'linkedBusinesses/add/pending'},
    fulfilled: {type: 'linkedBusinesses/add/fulfilled'},
    rejected: {type: 'linkedBusinesses/add/rejected'},
  },
  linkBusiness: {
    pending: {type: 'linkedBusinesses/link/pending'},
    fulfilled: {type: 'linkedBusinesses/link/fulfilled'},
    rejected: {type: 'linkedBusinesses/link/rejected'},
  },
  inviteBusiness: {
    pending: {type: 'linkedBusinesses/invite/pending'},
    fulfilled: {type: 'linkedBusinesses/invite/fulfilled'},
    rejected: {type: 'linkedBusinesses/invite/rejected'},
  },
  deleteLinkedBusiness: {
    pending: {type: 'linkedBusinesses/delete/pending'},
    fulfilled: {type: 'linkedBusinesses/delete/fulfilled'},
    rejected: {type: 'linkedBusinesses/delete/rejected'},
  },
  acceptBusinessInvite: {
    pending: {type: 'linkedBusinesses/accept/pending'},
    fulfilled: {type: 'linkedBusinesses/accept/fulfilled'},
    rejected: {type: 'linkedBusinesses/accept/rejected'},
  },
  declineBusinessInvite: {
    pending: {type: 'linkedBusinesses/decline/pending'},
    fulfilled: {type: 'linkedBusinesses/decline/fulfilled'},
    rejected: {type: 'linkedBusinesses/decline/rejected'},
  },
}));

// Import types for use in tests
import {
  searchBusinessesByLocation,
  searchBusinessByQRCode,
  addLinkedBusiness,
  deleteLinkedBusiness,
  acceptBusinessInvite,
  declineBusinessInvite,
  fetchLinkedBusinesses,
} from '../../../src/features/linkedBusinesses/thunks';

describe('features/linkedBusinesses/linkedBusinessesSlice', () => {
  const initialState = {
    linkedBusinesses: [],
    loading: false,
    error: null,
  };

  it('should handle initial state', () => {
    expect(linkedBusinessesReducer(undefined, {type: 'unknown'})).toEqual(
      initialState,
    );
  });

  describe('reducers', () => {
    it('should handle setSelectedCategory', () => {
      const nextState = linkedBusinessesReducer(
        initialState,
        setSelectedCategory('groomer'),
      );
      expect(nextState.selectedCategory).toBe('groomer');
    });

    it('should handle clearError', () => {
      const errorState = {...initialState, error: 'Some error'};
      const nextState = linkedBusinessesReducer(errorState, clearError());
      expect(nextState.error).toBeNull();
    });

    it('should handle initializeMockData (no-op currently)', () => {
      const nextState = linkedBusinessesReducer(
        initialState,
        initializeMockData(),
      );
      expect(nextState).toEqual(initialState);
    });

    it('should handle resetLinkedBusinesses', () => {
      const modifiedState = {
        linkedBusinesses: [{id: '1', name: 'Business'}],
        loading: true,
        error: 'Err',
        selectedCategory: 'hospital',
      };
      const nextState = linkedBusinessesReducer(
        modifiedState as any,
        resetLinkedBusinesses(),
      );
      expect(nextState).toEqual(initialState);
    });
  });

  describe('extraReducers', () => {
    // Helper to simulate a rejected action with a payload (rejectWithValue)
    const rejectedAction = (type: string, message: string) => ({
      type,
      payload: message, // The slice uses action.payload for most error messages
      error: {message: 'Default Error'},
    });

    // Helper for errors that strictly use action.error.message
    const errorAction = (type: string, message: string) => ({
      type,
      error: {message},
    });

    // --- Search By Location ---
    describe('searchBusinessesByLocation', () => {
      it('pending', () => {
        const nextState = linkedBusinessesReducer(initialState, {
          type: searchBusinessesByLocation.pending.type,
        });
        expect(nextState.loading).toBe(true);
        expect(nextState.error).toBeNull();
      });

      it('fulfilled', () => {
        const loadingState = {...initialState, loading: true};
        const nextState = linkedBusinessesReducer(loadingState, {
          type: searchBusinessesByLocation.fulfilled.type,
        });
        expect(nextState.loading).toBe(false);
      });

      it('rejected', () => {
        // This slice case uses action.error.message
        const nextState = linkedBusinessesReducer(
          {...initialState, loading: true},
          errorAction(
            searchBusinessesByLocation.rejected.type,
            'Search failed',
          ),
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Search failed');
      });
    });

    // --- Search By QR ---
    describe('searchBusinessByQRCode', () => {
      it('pending', () => {
        const nextState = linkedBusinessesReducer(initialState, {
          type: searchBusinessByQRCode.pending.type,
        });
        expect(nextState.loading).toBe(true);
      });

      it('fulfilled', () => {
        const loadingState = {...initialState, loading: true};
        const nextState = linkedBusinessesReducer(loadingState, {
          type: searchBusinessByQRCode.fulfilled.type,
        });
        expect(nextState.loading).toBe(false);
      });

      it('rejected', () => {
        const nextState = linkedBusinessesReducer(
          {...initialState, loading: true},
          errorAction(searchBusinessByQRCode.rejected.type, 'QR failed'),
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('QR failed');
      });
    });

    // --- Fetch Linked Businesses ---
    describe('fetchLinkedBusinesses', () => {
      it('pending', () => {
        const nextState = linkedBusinessesReducer(initialState, {
          type: fetchLinkedBusinesses.pending.type,
        });
        expect(nextState.loading).toBe(true);
      });

      it('fulfilled', () => {
        const data = [{id: '1', name: 'Biz'}];
        const nextState = linkedBusinessesReducer(
          {...initialState, loading: true},
          {type: fetchLinkedBusinesses.fulfilled.type, payload: data},
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.linkedBusinesses).toEqual(data);
      });

      it('rejected', () => {
        // Slice uses payload for this one
        const nextState = linkedBusinessesReducer(
          {...initialState, loading: true},
          rejectedAction(fetchLinkedBusinesses.rejected.type, 'Fetch failed'),
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Fetch failed');
      });
    });

    // --- Add Business ---
    describe('addLinkedBusiness', () => {
      it('pending', () => {
        const nextState = linkedBusinessesReducer(initialState, {
          type: addLinkedBusiness.pending.type,
        });
        expect(nextState.loading).toBe(true);
      });

      it('fulfilled', () => {
        const business = {id: '123', name: 'New Vet'};
        const nextState = linkedBusinessesReducer(
          {...initialState, loading: true},
          {type: addLinkedBusiness.fulfilled.type, payload: business},
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.linkedBusinesses).toContainEqual(business);
      });

      it('rejected', () => {
        // Slice uses payload
        const nextState = linkedBusinessesReducer(
          {...initialState, loading: true},
          rejectedAction(addLinkedBusiness.rejected.type, 'Add failed'),
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Add failed');
      });
    });

    // --- Delete Business ---
    describe('deleteLinkedBusiness', () => {
      const startState = {
        ...initialState,
        linkedBusinesses: [
          {id: '1', name: 'A'},
          {id: '2', name: 'B'},
        ],
      };

      it('pending', () => {
        const nextState = linkedBusinessesReducer(startState, {
          type: deleteLinkedBusiness.pending.type,
        });
        expect(nextState.loading).toBe(true);
      });

      it('fulfilled', () => {
        const nextState = linkedBusinessesReducer(
          {...startState, loading: true} as any,
          {type: deleteLinkedBusiness.fulfilled.type, payload: '1'},
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.linkedBusinesses).toHaveLength(1);
        expect(nextState.linkedBusinesses[0].id).toBe('2');
      });

      it('rejected', () => {
        // Slice uses action.error.message for delete
        const nextState = linkedBusinessesReducer(
          {...startState, loading: true} as any,
          errorAction(deleteLinkedBusiness.rejected.type, 'Delete failed'),
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Delete failed');
      });
    });

    // --- Accept Invite ---
    describe('acceptBusinessInvite', () => {
      // FIX: Add explicit linkId to prevent "undefined === undefined" matches
      const startState = {
        ...initialState,
        linkedBusinesses: [
          {id: '1', name: 'A', inviteStatus: 'pending', linkId: 'link_1'},
        ],
      };

      it('pending', () => {
        const nextState = linkedBusinessesReducer(startState as any, {
          type: acceptBusinessInvite.pending.type,
        });
        expect(nextState.loading).toBe(true);
      });

      it('fulfilled', () => {
        const nextState = linkedBusinessesReducer(
          {...startState, loading: true} as any,
          {type: acceptBusinessInvite.fulfilled.type, payload: {id: '1'}},
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.linkedBusinesses[0].inviteStatus).toBe('accepted');
      });

      it('fulfilled (not found)', () => {
        const nextState = linkedBusinessesReducer(
          {...startState, loading: true} as any,
          {
            type: acceptBusinessInvite.fulfilled.type,
            // FIX: Provide a distinct linkId so it doesn't match the existing one
            payload: {id: '999', name: 'New', linkId: 'link_999'},
          },
        );
        expect(nextState.loading).toBe(false);
        // It should add it if not found (per slice logic)
        expect(nextState.linkedBusinesses).toHaveLength(2);
      });

      it('rejected', () => {
        // Slice uses payload
        const nextState = linkedBusinessesReducer(
          {...startState, loading: true} as any,
          rejectedAction(acceptBusinessInvite.rejected.type, 'Accept failed'),
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Accept failed');
      });
    });

    // --- Decline Invite ---
    describe('declineBusinessInvite', () => {
      // FIX: Add explicit linkId to prevent "undefined === undefined" matches
      const startState = {
        ...initialState,
        linkedBusinesses: [
          {id: '1', name: 'A', inviteStatus: 'pending', linkId: 'link_1'},
        ],
      };

      it('pending', () => {
        const nextState = linkedBusinessesReducer(startState as any, {
          type: declineBusinessInvite.pending.type,
        });
        expect(nextState.loading).toBe(true);
      });

      it('fulfilled', () => {
        const nextState = linkedBusinessesReducer(
          {...startState, loading: true} as any,
          {type: declineBusinessInvite.fulfilled.type, payload: {id: '1'}},
        );
        expect(nextState.loading).toBe(false);
        // Should be removed
        expect(nextState.linkedBusinesses).toHaveLength(0);
      });

      it('fulfilled (not found)', () => {
        const nextState = linkedBusinessesReducer(
          {...startState, loading: true} as any,
          {
            type: declineBusinessInvite.fulfilled.type,
            // FIX: Distinct linkId to ensure no match
            payload: {id: '999', linkId: 'link_999'},
          },
        );
        expect(nextState.loading).toBe(false);
        // Should remain unchanged
        expect(nextState.linkedBusinesses).toEqual(startState.linkedBusinesses);
      });

      it('rejected', () => {
        // Slice uses payload
        const nextState = linkedBusinessesReducer(
          {...startState, loading: true} as any,
          rejectedAction(declineBusinessInvite.rejected.type, 'Decline failed'),
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Decline failed');
      });
    });
  });
});