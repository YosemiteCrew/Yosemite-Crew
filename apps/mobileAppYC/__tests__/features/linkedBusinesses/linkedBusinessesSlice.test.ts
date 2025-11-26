import linkedBusinessesReducer, {
  setSelectedCategory,
  clearError,
  initializeMockData,
  resetLinkedBusinesses,
} from '../../../src/features/linkedBusinesses/linkedBusinessesSlice';

// We mock the thunks so we can control the dispatched actions
jest.mock('../../../src/features/linkedBusinesses/thunks', () => ({
  searchBusinessesByLocation: {
    pending: { type: 'linkedBusinesses/searchByLocation/pending' },
    fulfilled: { type: 'linkedBusinesses/searchByLocation/fulfilled' },
    rejected: { type: 'linkedBusinesses/searchByLocation/rejected' },
  },
  searchBusinessByQRCode: {
    pending: { type: 'linkedBusinesses/searchByQRCode/pending' },
    fulfilled: { type: 'linkedBusinesses/searchByQRCode/fulfilled' },
    rejected: { type: 'linkedBusinesses/searchByQRCode/rejected' },
  },
  addLinkedBusiness: {
    pending: { type: 'linkedBusinesses/add/pending' },
    fulfilled: { type: 'linkedBusinesses/add/fulfilled' },
    rejected: { type: 'linkedBusinesses/add/rejected' },
  },
  deleteLinkedBusiness: {
    pending: { type: 'linkedBusinesses/delete/pending' },
    fulfilled: { type: 'linkedBusinesses/delete/fulfilled' },
    rejected: { type: 'linkedBusinesses/delete/rejected' },
  },
  acceptBusinessInvite: {
    pending: { type: 'linkedBusinesses/accept/pending' },
    fulfilled: { type: 'linkedBusinesses/accept/fulfilled' },
    rejected: { type: 'linkedBusinesses/accept/rejected' },
  },
  declineBusinessInvite: {
    pending: { type: 'linkedBusinesses/decline/pending' },
    fulfilled: { type: 'linkedBusinesses/decline/fulfilled' },
    rejected: { type: 'linkedBusinesses/decline/rejected' },
  },
}));

// Import the mocked thunks to use their types in tests
import {
  searchBusinessesByLocation,
  searchBusinessByQRCode,
  addLinkedBusiness,
  deleteLinkedBusiness,
  acceptBusinessInvite,
  declineBusinessInvite,
} from '../../../src/features/linkedBusinesses/thunks';

describe('features/linkedBusinesses/linkedBusinessesSlice', () => {
  const initialState = {
    linkedBusinesses: [],
    loading: false,
    error: null,
  };

  it('should handle initial state', () => {
    expect(linkedBusinessesReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('reducers', () => {
    it('should handle setSelectedCategory', () => {
      const nextState = linkedBusinessesReducer(initialState, setSelectedCategory('groomer'));
      expect(nextState.selectedCategory).toBe('groomer');
    });

    it('should handle clearError', () => {
      const errorState = { ...initialState, error: 'Some error' };
      const nextState = linkedBusinessesReducer(errorState, clearError());
      expect(nextState.error).toBeNull();
    });

    it('should handle initializeMockData (no-op currently)', () => {
      const nextState = linkedBusinessesReducer(initialState, initializeMockData());
      expect(nextState).toEqual(initialState);
    });

    it('should handle resetLinkedBusinesses', () => {
      const modifiedState = {
        linkedBusinesses: [{ id: '1', name: 'Business' }],
        loading: true,
        error: 'Err',
        selectedCategory: 'hospital',
      };
      // Cast to any to avoid strict type checking against the full LinkedBusiness interface
      // since we only care that the reducer resets the state regardless of content.
      const nextState = linkedBusinessesReducer(modifiedState as any, resetLinkedBusinesses());
      expect(nextState).toEqual(initialState);
    });
  });

  describe('extraReducers', () => {
    // Helper for error testing
    const errorAction = (type: string, message = 'Error') => ({
      type,
      error: { message },
    });

    // --- Search By Location ---
    describe('searchBusinessesByLocation', () => {
      it('pending', () => {
        const nextState = linkedBusinessesReducer(initialState, { type: searchBusinessesByLocation.pending.type });
        expect(nextState.loading).toBe(true);
        expect(nextState.error).toBeNull();
      });

      it('fulfilled', () => {
        const loadingState = { ...initialState, loading: true };
        const nextState = linkedBusinessesReducer(loadingState, { type: searchBusinessesByLocation.fulfilled.type });
        expect(nextState.loading).toBe(false);
      });

      it('rejected', () => {
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          errorAction(searchBusinessesByLocation.rejected.type, 'Search failed')
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Search failed');
      });

      it('rejected (default error)', () => {
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          { type: searchBusinessesByLocation.rejected.type, error: {} }
        );
        expect(nextState.error).toBe('Failed to search businesses');
      });
    });

    // --- Search By QR ---
    describe('searchBusinessByQRCode', () => {
      it('pending', () => {
        const nextState = linkedBusinessesReducer(initialState, { type: searchBusinessByQRCode.pending.type });
        expect(nextState.loading).toBe(true);
        expect(nextState.error).toBeNull();
      });

      it('fulfilled', () => {
        const loadingState = { ...initialState, loading: true };
        const nextState = linkedBusinessesReducer(loadingState, { type: searchBusinessByQRCode.fulfilled.type });
        expect(nextState.loading).toBe(false);
      });

      it('rejected', () => {
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          errorAction(searchBusinessByQRCode.rejected.type, 'QR failed')
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('QR failed');
      });

      it('rejected (default error)', () => {
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          { type: searchBusinessByQRCode.rejected.type, error: {} }
        );
        expect(nextState.error).toBe('Failed to scan QR code');
      });
    });

    // --- Add Business ---
    describe('addLinkedBusiness', () => {
      it('pending', () => {
        const nextState = linkedBusinessesReducer(initialState, { type: addLinkedBusiness.pending.type });
        expect(nextState.loading).toBe(true);
        expect(nextState.error).toBeNull();
      });

      it('fulfilled', () => {
        const business = { id: '123', name: 'New Vet' };
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          { type: addLinkedBusiness.fulfilled.type, payload: business }
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.linkedBusinesses).toContainEqual(business);
      });

      it('rejected', () => {
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          errorAction(addLinkedBusiness.rejected.type, 'Add failed')
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Add failed');
      });

      it('rejected (default error)', () => {
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          { type: addLinkedBusiness.rejected.type, error: {} }
        );
        expect(nextState.error).toBe('Failed to add business');
      });
    });

    // --- Delete Business ---
    describe('deleteLinkedBusiness', () => {
      const startState = {
        ...initialState,
        linkedBusinesses: [{ id: '1', name: 'A' }, { id: '2', name: 'B' }],
      };

      it('pending', () => {
        const nextState = linkedBusinessesReducer(startState, { type: deleteLinkedBusiness.pending.type });
        expect(nextState.loading).toBe(true);
        expect(nextState.error).toBeNull();
      });

      it('fulfilled', () => {
        const nextState = linkedBusinessesReducer(
          { ...startState, loading: true } as any,
          { type: deleteLinkedBusiness.fulfilled.type, payload: '1' }
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.linkedBusinesses).toHaveLength(1);
        expect(nextState.linkedBusinesses[0].id).toBe('2');
      });

      it('rejected', () => {
        const nextState = linkedBusinessesReducer(
          { ...startState, loading: true } as any,
          errorAction(deleteLinkedBusiness.rejected.type, 'Delete failed')
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Delete failed');
      });

      it('rejected (default error)', () => {
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          { type: deleteLinkedBusiness.rejected.type, error: {} }
        );
        expect(nextState.error).toBe('Failed to delete business');
      });
    });

    // --- Accept Invite ---
    describe('acceptBusinessInvite', () => {
      const startState = {
        ...initialState,
        linkedBusinesses: [{ id: '1', name: 'A', inviteStatus: 'pending' }],
      };

      it('pending', () => {
        const nextState = linkedBusinessesReducer(startState as any, { type: acceptBusinessInvite.pending.type });
        expect(nextState.loading).toBe(true);
      });

      it('fulfilled', () => {
        const nextState = linkedBusinessesReducer(
          { ...startState, loading: true } as any,
          { type: acceptBusinessInvite.fulfilled.type, payload: '1' }
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.linkedBusinesses[0].inviteStatus).toBe('accepted');
      });

      it('fulfilled (not found)', () => {
        const nextState = linkedBusinessesReducer(
            { ...startState, loading: true } as any,
            { type: acceptBusinessInvite.fulfilled.type, payload: '999' }
        );
        expect(nextState.loading).toBe(false);
        // Should remain unchanged
        expect(nextState.linkedBusinesses).toEqual(startState.linkedBusinesses);
      });

      it('rejected', () => {
        const nextState = linkedBusinessesReducer(
          { ...startState, loading: true } as any,
          errorAction(acceptBusinessInvite.rejected.type, 'Accept failed')
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Accept failed');
      });

      it('rejected (default error)', () => {
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          { type: acceptBusinessInvite.rejected.type, error: {} }
        );
        expect(nextState.error).toBe('Failed to accept invite');
      });
    });

    // --- Decline Invite ---
    describe('declineBusinessInvite', () => {
      const startState = {
        ...initialState,
        linkedBusinesses: [{ id: '1', name: 'A', inviteStatus: 'pending' }],
      };

      it('pending', () => {
        const nextState = linkedBusinessesReducer(startState as any, { type: declineBusinessInvite.pending.type });
        expect(nextState.loading).toBe(true);
      });

      it('fulfilled', () => {
        const nextState = linkedBusinessesReducer(
          { ...startState, loading: true } as any,
          { type: declineBusinessInvite.fulfilled.type, payload: '1' }
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.linkedBusinesses[0].inviteStatus).toBe('declined');
      });

      it('fulfilled (not found)', () => {
          const nextState = linkedBusinessesReducer(
              { ...startState, loading: true } as any,
              { type: declineBusinessInvite.fulfilled.type, payload: '999' }
          );
          expect(nextState.loading).toBe(false);
          expect(nextState.linkedBusinesses).toEqual(startState.linkedBusinesses);
      });

      it('rejected', () => {
        const nextState = linkedBusinessesReducer(
          { ...startState, loading: true } as any,
          errorAction(declineBusinessInvite.rejected.type, 'Decline failed')
        );
        expect(nextState.loading).toBe(false);
        expect(nextState.error).toBe('Decline failed');
      });

      it('rejected (default error)', () => {
        const nextState = linkedBusinessesReducer(
          { ...initialState, loading: true },
          { type: declineBusinessInvite.rejected.type, error: {} }
        );
        expect(nextState.error).toBe('Failed to decline invite');
      });
    });
  });
});