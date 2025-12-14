import {
  fetchLinkedBusinesses,
  searchBusinessesByLocation,
  checkOrganisation,
  fetchPlaceCoordinates,
  searchBusinessByQRCode,
  linkBusiness,
  addLinkedBusiness,
  inviteBusiness,
  deleteLinkedBusiness,
  acceptBusinessInvite,
  declineBusinessInvite,
  fetchBusinessDetails,
  fetchGooglePlacesImage,
} from '@/features/linkedBusinesses/thunks';
import linkedBusinessesService from '@/features/linkedBusinesses/services/linkedBusinessesService';
import { fetchBusinessesBySearch, fetchBusinessPlaceDetails } from '@/shared/services/maps/googlePlaces';
import { getFreshStoredTokens, isTokenExpired } from '@/features/auth/sessionManager';
import { configureStore } from '@reduxjs/toolkit';

// --- Mocks ---
jest.mock('@/features/linkedBusinesses/services/linkedBusinessesService');
jest.mock('@/shared/services/maps/googlePlaces');
jest.mock('@/features/auth/sessionManager');
jest.mock('@/assets/images', () => ({
  Images: {
    sampleHospital1: 'img1',
    sampleHospital2: 'img2',
    sampleHospital3: 'img3',
  },
}));

// Helper to create a store for thunk testing
const createTestStore = (initialState = {}) => {
  return configureStore({
    reducer: (state = initialState) => state,
    preloadedState: initialState,
  });
};

describe('linkedBusinesses thunks', () => {
  const mockAccessToken = 'valid-token';

  beforeEach(() => {
    jest.clearAllMocks();
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({ accessToken: mockAccessToken, expiresAt: Date.now() + 10000 });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
  });

  // --- Auth Checks ---
  describe('auth validation', () => {
    it('throws if no access token', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue(null);
      const store = createTestStore();
      const result = await store.dispatch(fetchLinkedBusinesses({ companionId: 'c1', category: 'hospital' }));
      expect(result.type).toBe('linkedBusinesses/fetchLinked/rejected');
      expect(result.payload).toBe('Missing access token. Please sign in again.');
    });

    it('throws if token expired', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({ accessToken: 'expired', expiresAt: 100 });
      (isTokenExpired as jest.Mock).mockReturnValue(true);
      const store = createTestStore();
      const result = await store.dispatch(fetchLinkedBusinesses({ companionId: 'c1', category: 'hospital' }));
      expect(result.type).toBe('linkedBusinesses/fetchLinked/rejected');
      expect(result.payload).toBe('Your session expired. Please sign in again.');
    });
  });

  // --- fetchLinkedBusinesses ---
  describe('fetchLinkedBusinesses', () => {
    const mockResponseArray = [
      {
        organisationId: {
          _id: 'org1',
          name: 'Vet 1',
          address: { addressLine: '123 St', city: 'City', state: 'ST', postalCode: '12345', country: 'US' },
          phoneNo: '1234567890',
          email: 'vet1@example.com',
          googlePlacesId: 'place1',
          imageURL: 'img_url',
          distance: 10,
          rating: 4.5
        },
        organisationType: 'HOSPITAL',
        status: 'ACTIVE',
        _id: 'link1',
        createdAt: '2023-01-01',
        updatedAt: '2023-01-02'
      }
    ];

    it('handles successful fetch (array response)', async () => {
      (linkedBusinessesService.fetchLinkedBusinesses as jest.Mock).mockResolvedValue(mockResponseArray);
      const store = createTestStore();
      const result = await store.dispatch(fetchLinkedBusinesses({ companionId: 'c1', category: 'hospital' }));

      expect(result.type).toBe('linkedBusinesses/fetchLinked/fulfilled');
      expect(result.payload[0].businessName).toBe('Vet 1');
      expect(result.payload[0].address).toContain('123 St');
    });

    it('handles pending invite format (nested object with links array)', async () => {
      const mockPendingResponse = {
        links: [{
          status: 'PENDING',
          organisationName: 'Pending Vet',
          organisationId: { id: 'org2', addressLine: 'Simple Address', phone: '000' },
          linkedByParentId: { name: 'Parent', email: 'parent@test.com' }
        }],
        email: 'parent@test.com',
        phoneNumber: '111',
        parentName: 'Parent Name'
      };

      (linkedBusinessesService.fetchLinkedBusinesses as jest.Mock).mockResolvedValue(mockPendingResponse);
      const store = createTestStore();
      const result = await store.dispatch(fetchLinkedBusinesses({ companionId: 'c1', category: 'boarder' }));

      expect(result.payload[0].inviteStatus).toBe('pending');
      expect(result.payload[0].address).toBe('Simple Address');
      expect(result.payload[0].parentEmail).toBe('parent@test.com');
    });

    it('handles flattened link object fallback', async () => {
       // Cover fallback logic where organisationId is missing and uses root link object
       const flatLink = [{
           _id: 'linkX',
           name: 'Flat Org',
           addressLine: 'Flat Addr',
           status: 'ACTIVE'
       }];
       (linkedBusinessesService.fetchLinkedBusinesses as jest.Mock).mockResolvedValue(flatLink);
       const store = createTestStore();
       const result = await store.dispatch(fetchLinkedBusinesses({ companionId: 'c1', category: 'groomer' }));

       expect(result.payload[0].businessName).toBe('Flat Org');
    });

    it('handles errors', async () => {
      (linkedBusinessesService.fetchLinkedBusinesses as jest.Mock).mockRejectedValue(new Error('Fetch failed'));
      const store = createTestStore();
      const result = await store.dispatch(fetchLinkedBusinesses({ companionId: 'c1', category: 'hospital' }));
      expect(result.payload).toBe('Fetch failed');
    });
  });

  // --- searchBusinessesByLocation ---
  describe('searchBusinessesByLocation', () => {
    const mockResults = [{ id: 'res1', name: 'Res 1', address: 'Addr 1' }];

    it('fetches from API and caches result', async () => {
      (fetchBusinessesBySearch as jest.Mock).mockResolvedValue(mockResults);
      const store = createTestStore();

      const result = await store.dispatch(searchBusinessesByLocation({ query: 'vet', location: { latitude: 10, longitude: 20 } }));

      expect(result.payload).toHaveLength(1);
      expect(fetchBusinessesBySearch).toHaveBeenCalled();

      // Second call should hit cache (mock fetch won't run again)
      (fetchBusinessesBySearch as jest.Mock).mockClear();
      await store.dispatch(searchBusinessesByLocation({ query: 'vet', location: { latitude: 10, longitude: 20 } }));
      expect(fetchBusinessesBySearch).not.toHaveBeenCalled();
    });

    it('handles query without location for cache key', async () => {
        (fetchBusinessesBySearch as jest.Mock).mockResolvedValue(mockResults);
        const store = createTestStore();
        await store.dispatch(searchBusinessesByLocation({ query: 'groomer', location: null }));
        // Should succeed and cache with simple key
        expect(fetchBusinessesBySearch).toHaveBeenCalled();
    });

    it('handles quota error gracefully', async () => {
      (fetchBusinessesBySearch as jest.Mock).mockRejectedValue(new Error('Quota exceeded'));
      const store = createTestStore();
      const result = await store.dispatch(searchBusinessesByLocation({ query: 'vet' }));
      expect(result.payload).toEqual([]); // Returns empty array fallback
    });
  });

  // --- checkOrganisation ---
  describe('checkOrganisation', () => {
    it('returns PMS organization details', async () => {
      (linkedBusinessesService.checkBusiness as jest.Mock).mockResolvedValue({
        isPmsOrganisation: true,
        organisation: {
            id: 'org_pms',
            telecom: [{ system: 'phone', value: '123' }, { system: 'url', value: 'http' }]
        }
      });
      const store = createTestStore();
      const result = await store.dispatch(checkOrganisation({ placeId: 'p1', lat: 1, lng: 1, addressLine: 'addr' }));

      expect(result.payload.isPmsOrganisation).toBe(true);
      expect(result.payload.phone).toBe('123');
      expect(result.payload.website).toBe('http');
    });

    it('handles error', async () => {
      (linkedBusinessesService.checkBusiness as jest.Mock).mockRejectedValue(new Error('Check failed'));
      const store = createTestStore();
      const result = await store.dispatch(checkOrganisation({ placeId: 'p1', lat: 1, lng: 1, addressLine: 'addr' }));
      expect(result.payload).toBe('Check failed');
    });
  });

  // --- fetchPlaceCoordinates ---
  describe('fetchPlaceCoordinates', () => {
    it('fetches coordinates and caches them', async () => {
      (fetchBusinessPlaceDetails as jest.Mock).mockResolvedValue({ latitude: 50, longitude: 60 });
      const store = createTestStore();

      const result = await store.dispatch(fetchPlaceCoordinates('place_x'));
      expect(result.payload).toEqual({ latitude: 50, longitude: 60 });

      // Cache hit check
      (fetchBusinessPlaceDetails as jest.Mock).mockClear();
      const cached = await store.dispatch(fetchPlaceCoordinates('place_x'));
      expect(fetchBusinessPlaceDetails).not.toHaveBeenCalled();
      expect(cached.payload).toEqual({ latitude: 50, longitude: 60 });
    });

    it('handles error', async () => {
      (fetchBusinessPlaceDetails as jest.Mock).mockRejectedValue(new Error('Coords fail'));
      const store = createTestStore();
      const result = await store.dispatch(fetchPlaceCoordinates('place_err'));
      expect(result.payload).toBe('Coords fail');
    });
  });

  // --- searchBusinessByQRCode ---
  describe('searchBusinessByQRCode', () => {
      // Mock timers for delay
      beforeEach(() => { jest.useFakeTimers(); });
      afterEach(() => { jest.useRealTimers(); });

      it('finds business by valid QR code', async () => {
          const store = createTestStore();
          const promise = store.dispatch(searchBusinessByQRCode('PMS_SFAMC_001'));

          jest.runAllTimers(); // fast forward delay
          const result = await promise;

          expect(result.payload.name).toBe('San Francisco Animal Medical Center');
      });

      it('throws error for invalid QR code', async () => {
          const store = createTestStore();
          const promise = store.dispatch(searchBusinessByQRCode('INVALID_CODE'));

          jest.runAllTimers();
          const result = await promise;

          expect(result.error.message).toBe('Business not found for this QR code');
      });
  });

  // --- linkBusiness ---
  describe('linkBusiness', () => {
      it('links business successfully', async () => {
          (linkedBusinessesService.linkBusiness as jest.Mock).mockResolvedValue({
              id: 'org_link_1',
              name: 'Linked Vet',
              type: 'HOSPITAL',
              state: 'active'
          });
          const store = createTestStore();
          const result = await store.dispatch(linkBusiness({
              companionId: 'c1', organisationId: 'org1', category: 'hospital'
          }));

          expect(result.payload.businessId).toBe('org_link_1');
          expect(result.payload.inviteStatus).toBe('accepted');
      });

      it('handles link fallback ID logic', async () => {
        (linkedBusinessesService.linkBusiness as jest.Mock).mockResolvedValue({
            // Missing id, uses linkId or organisationId fallback
            linkId: 'link_id_val',
            name: 'Vet'
        });
        const store = createTestStore();
        const result = await store.dispatch(linkBusiness({
            companionId: 'c1', organisationId: 'org_fallback', category: 'boarder'
        }));

        expect(result.payload.id).toBe('link_id_val');
      });

      it('handles error', async () => {
          (linkedBusinessesService.linkBusiness as jest.Mock).mockRejectedValue(new Error('Link failed'));
          const store = createTestStore();
          const result = await store.dispatch(linkBusiness({ companionId: 'c1', organisationId: 'o1', category: 'hospital' }));
          expect(result.payload).toBe('Link failed');
      });
  });

  // --- addLinkedBusiness ---
  describe('addLinkedBusiness', () => {
      it('creates local linked business object', async () => {
          const store = createTestStore();
          const result = await store.dispatch(addLinkedBusiness({
              companionId: 'c1',
              businessId: 'local_biz',
              businessName: 'My Local Vet',
              category: 'hospital',
              address: '123 Local St'
          }));

          expect(result.payload.id).toBe('local_biz');
          expect(result.payload.state).toBe('active');
          expect(result.payload.type).toBe('HOSPITAL');
      });
  });

  // --- inviteBusiness ---
  describe('inviteBusiness', () => {
      it('sends invite successfully', async () => {
          (linkedBusinessesService.inviteBusiness as jest.Mock).mockResolvedValue({ success: true });
          const store = createTestStore();
          const result = await store.dispatch(inviteBusiness({
              companionId: 'c1', email: 'test@biz.com', businessName: 'Biz', category: 'groomer'
          }));

          expect(result.payload.success).toBe(true);
      });

      it('handles error', async () => {
          (linkedBusinessesService.inviteBusiness as jest.Mock).mockRejectedValue(new Error('Invite fail'));
          const store = createTestStore();
          const result = await store.dispatch(inviteBusiness({ companionId: 'c1', email: 'e', businessName: 'b', category: 'hospital' }));
          expect(result.payload).toBe('Invite fail');
      });
  });

  // --- deleteLinkedBusiness ---
  describe('deleteLinkedBusiness', () => {
      it('deletes successfully if business exists in state', async () => {
          const mockState = {
              linkedBusinesses: {
                  linkedBusinesses: [{ id: 'link1', linkId: 'real_link_id' }]
              }
          };
          // @ts-ignore - Partial state mock
          const store = createTestStore(mockState);

          (linkedBusinessesService.revokeLinkedBusiness as jest.Mock).mockResolvedValue({});

          const result = await store.dispatch(deleteLinkedBusiness('link1'));
          expect(result.payload).toBe('link1');
          expect(linkedBusinessesService.revokeLinkedBusiness).toHaveBeenCalledWith('real_link_id', mockAccessToken);
      });

      it('returns error if business not found in state', async () => {
          const store = createTestStore({ linkedBusinesses: { linkedBusinesses: [] } });
          const result = await store.dispatch(deleteLinkedBusiness('missing_id'));
          expect(result.payload).toBe('Business not found');
      });

      it('handles API error', async () => {
        const mockState = { linkedBusinesses: { linkedBusinesses: [{ id: 'link1' }] } };
        // @ts-ignore
        const store = createTestStore(mockState);
        (linkedBusinessesService.revokeLinkedBusiness as jest.Mock).mockRejectedValue(new Error('Revoke fail'));

        const result = await store.dispatch(deleteLinkedBusiness('link1'));
        expect(result.payload).toBe('Revoke fail');
      });
  });

  // --- acceptBusinessInvite ---
  describe('acceptBusinessInvite', () => {
      it('accepts successfully', async () => {
        const mockState = { linkedBusinesses: { linkedBusinesses: [{ linkId: 'link1', name: 'Old' }] } };
        // @ts-ignore
        const store = createTestStore(mockState);

        (linkedBusinessesService.approveLinkInvite as jest.Mock).mockResolvedValue({ name: 'Updated' });

        const result = await store.dispatch(acceptBusinessInvite('link1'));
        expect(result.payload.name).toBe('Updated');
        expect(result.payload.inviteStatus).toBe('accepted');
      });

      it('fails if business not found', async () => {
          const store = createTestStore({ linkedBusinesses: { linkedBusinesses: [] } });
          const result = await store.dispatch(acceptBusinessInvite('missing'));
          expect(result.payload).toBe('Business not found');
      });

      it('handles API error', async () => {
        const mockState = { linkedBusinesses: { linkedBusinesses: [{ linkId: 'link1' }] } };
        // @ts-ignore
        const store = createTestStore(mockState);
        (linkedBusinessesService.approveLinkInvite as jest.Mock).mockRejectedValue(new Error('Accept fail'));
        const result = await store.dispatch(acceptBusinessInvite('link1'));
        expect(result.payload).toBe('Accept fail');
      });
  });

  // --- declineBusinessInvite ---
  describe('declineBusinessInvite', () => {
    it('declines successfully', async () => {
      const mockState = { linkedBusinesses: { linkedBusinesses: [{ linkId: 'link1' }] } };
      // @ts-ignore
      const store = createTestStore(mockState);

      (linkedBusinessesService.denyLinkInvite as jest.Mock).mockResolvedValue({});

      const result = await store.dispatch(declineBusinessInvite('link1'));
      expect(result.payload.inviteStatus).toBe('declined');
    });

    it('fails if business not found', async () => {
        const store = createTestStore({ linkedBusinesses: { linkedBusinesses: [] } });
        const result = await store.dispatch(declineBusinessInvite('missing'));
        expect(result.payload).toBe('Business not found');
    });

    it('handles API error', async () => {
        const mockState = { linkedBusinesses: { linkedBusinesses: [{ linkId: 'link1' }] } };
        // @ts-ignore
        const store = createTestStore(mockState);
        (linkedBusinessesService.denyLinkInvite as jest.Mock).mockRejectedValue(new Error('Deny fail'));
        const result = await store.dispatch(declineBusinessInvite('link1'));
        expect(result.payload).toBe('Deny fail');
    });
  });

  // --- fetchBusinessDetails ---
  describe('fetchBusinessDetails', () => {
      it('fetches details and caches', async () => {
          (fetchBusinessPlaceDetails as jest.Mock).mockResolvedValue({
              photoUrl: 'http://photo', phoneNumber: '555', website: 'site.com'
          });
          const store = createTestStore();

          const result = await store.dispatch(fetchBusinessDetails('p1'));
          expect(result.payload).toEqual({
              placeId: 'p1',
              photoUrl: 'http://photo',
              phoneNumber: '555',
              website: 'site.com'
          });

          // Cache check
          (fetchBusinessPlaceDetails as jest.Mock).mockClear();
          await store.dispatch(fetchBusinessDetails('p1'));
          expect(fetchBusinessPlaceDetails).not.toHaveBeenCalled();
      });

      it('handles error gracefully returns partial data', async () => {
          (fetchBusinessPlaceDetails as jest.Mock).mockRejectedValue(new Error('Detail fail'));
          const store = createTestStore();
          const result = await store.dispatch(fetchBusinessDetails('p_err'));

          // Should return object with placeId but undefined fields, NOT throw
          expect(result.payload).toEqual({
              placeId: 'p_err',
              photoUrl: undefined,
              phoneNumber: undefined,
              website: undefined
          });
      });
  });

  // --- fetchGooglePlacesImage ---
  describe('fetchGooglePlacesImage', () => {
      it('fetches image and caches', async () => {
          (fetchBusinessPlaceDetails as jest.Mock).mockResolvedValue({ photoUrl: 'http://img' });
          const store = createTestStore();

          const result = await store.dispatch(fetchGooglePlacesImage('g1'));
          expect(result.payload.photoUrl).toBe('http://img');

          // Cache check
          (fetchBusinessPlaceDetails as jest.Mock).mockClear();
          await store.dispatch(fetchGooglePlacesImage('g1'));
          expect(fetchBusinessPlaceDetails).not.toHaveBeenCalled();
      });

      it('returns null if no ID provided', async () => {
          const store = createTestStore();
          const result = await store.dispatch(fetchGooglePlacesImage(''));
          expect(result.payload.photoUrl).toBeNull();
      });

      it('handles error gracefully', async () => {
          (fetchBusinessPlaceDetails as jest.Mock).mockRejectedValue(new Error('Img fail'));
          const store = createTestStore();
          const result = await store.dispatch(fetchGooglePlacesImage('g_err'));
          expect(result.payload.photoUrl).toBeNull();
      });
  });
});