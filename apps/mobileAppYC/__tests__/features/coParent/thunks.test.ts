import configureMockStore from 'redux-mock-store';
// Fix for "middleware is not a function": ensure we get the actual thunk function regardless of version/environment
const thunk =
  require('redux-thunk').default ||
  require('redux-thunk').thunk ||
  require('redux-thunk');

import {
  fetchCoParents,
  addCoParent,
  updateCoParentPermissions,
  deleteCoParent,
  promoteCoParentToPrimary,
  fetchPendingInvites,
  acceptCoParentInvite,
  declineCoParentInvite,
  fetchParentAccess,
} from '../../../src/features/coParent/thunks';
import {coParentApi} from '../../../src/features/coParent/services/coParentService';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '../../../src/features/auth/sessionManager';
import {CoParentPermissions} from '../../../src/features/coParent/types';

// --- Mocks ---

// Mock external dependencies
jest.mock('../../../src/features/coParent/services/coParentService');
jest.mock('../../../src/features/auth/sessionManager');

// Cast mocked functions for type safety and usage in tests
const mockGetFreshStoredTokens = getFreshStoredTokens as jest.Mock;
const mockIsTokenExpired = isTokenExpired as jest.Mock;
// We cast coParentApi methods as Jest mocks to define return values
const mockCoParentApi = coParentApi as jest.Mocked<typeof coParentApi>;

// Configure Mock Store
const middlewares = [thunk];
const mockStore = configureMockStore(middlewares);

// Initial State Mock
const initialMockState = {
  coParent: {
    coParents: [
      {
        id: 'cp_123',
        parentId: 'p1',
        companionId: 'c1',
        role: 'CO-PARENT',
        status: 'accepted',
        email: 'existing@test.com',
        firstName: 'Existing',
        lastName: 'Parent',
        companions: [
          {
            companionId: 'c1',
            companionName: 'My Companion',
            profileImage: 'c-img',
          },
        ],
        permissions: {},
      },
    ],
  },
  auth: {},
};

const MOCK_ACCESS_TOKEN = 'mock-access-token';

describe('Co-Parent Thunks', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default valid session setup
    mockGetFreshStoredTokens.mockResolvedValue({
      accessToken: MOCK_ACCESS_TOKEN,
      expiresAt: new Date(Date.now() + 3600000).toISOString(), // Valid for 1h
    });
    mockIsTokenExpired.mockReturnValue(false);
  });

  // --- Session Validation Tests ---

  describe('Session Access Token Validation', () => {
    it('should reject if access token is missing', async () => {
      mockGetFreshStoredTokens.mockResolvedValueOnce({}); // No token returned
      const store = mockStore(initialMockState);

      // Dispatching fetchCoParents as a representative thunk
      const result = await store.dispatch(
        fetchCoParents({companionId: 'c1'}) as any,
      );

      expect(result.type).toBe('coParent/fetchCoParents/rejected');
      expect(result.payload).toBe(
        'Missing access token. Please sign in again.',
      );
    });

    it('should reject if access token is expired', async () => {
      mockGetFreshStoredTokens.mockResolvedValueOnce({
        accessToken: MOCK_ACCESS_TOKEN,
        expiresAt: '2020-01-01T00:00:00Z', // Past date
      });
      mockIsTokenExpired.mockReturnValueOnce(true);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchCoParents({companionId: 'c1'}) as any,
      );

      expect(result.type).toBe('coParent/fetchCoParents/rejected');
      expect(result.payload).toBe(
        'Your session expired. Please sign in again.',
      );
    });

    it('should validate expiry with undefined when expiry is missing', async () => {
      mockGetFreshStoredTokens.mockResolvedValueOnce({
        accessToken: MOCK_ACCESS_TOKEN,
      });
      mockCoParentApi.listByCompanion.mockResolvedValueOnce([]);

      const store = mockStore(initialMockState);
      await store.dispatch(fetchCoParents({companionId: 'c1'}) as any);

      expect(mockIsTokenExpired).toHaveBeenCalledWith(undefined);
    });
  });

  // --- fetchCoParents ---

  describe('fetchCoParents', () => {
    it('should fetch and normalize co-parents successfully', async () => {
      const mockLinks = [
        {
          id: 'link1',
          companionId: 'c1',
          parentId: 'p1',
          status: 'Active',
          permissions: {appointments: 'true'},
        },
      ];
      mockCoParentApi.listByCompanion.mockResolvedValueOnce(mockLinks);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchCoParents({companionId: 'c1', companionName: 'Buddy'}) as any,
      );

      expect(mockCoParentApi.listByCompanion).toHaveBeenCalledWith({
        companionId: 'c1',
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result.type).toBe('coParent/fetchCoParents/fulfilled');

      // Verification of normalization logic
      const payload = result.payload as any[];
      expect(payload[0].id).toBe('link1');
      expect(payload[0].status).toBe('accepted'); // 'Active' normalized to 'accepted'
      expect(payload[0].companions[0].companionName).toBe('Buddy');
    });

    it('should handle API failure', async () => {
      mockCoParentApi.listByCompanion.mockRejectedValueOnce(
        new Error('Network Error'),
      );
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchCoParents({companionId: 'c1'}) as any,
      );

      expect(result.type).toBe('coParent/fetchCoParents/rejected');
      expect(result.payload).toBe('Network Error');
    });

    it('should return an empty list when the API returns null', async () => {
      mockCoParentApi.listByCompanion.mockResolvedValueOnce(null as any);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchCoParents({companionId: 'c1'}) as any,
      );

      expect(result.payload).toEqual([]);
    });

    it('normalizes alternate backend link shapes', async () => {
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(12345);
      mockCoParentApi.listByCompanion.mockResolvedValueOnce([
        {
          _id: 'mongo-link',
          companion: {
            id: 'nested-companion',
            name: 'Nested Buddy',
            profileImage: 'nested-img',
          },
          parent: {
            _id: 'parent-mongo',
            firstName: 'Nested',
            lastName: 'Parent',
            email: 'nested@test.com',
            phoneNumber: '555',
            profileImageUrl: 'profile-token',
            profileToken: 'token-1',
          },
          status: 'rejected',
          permissions: {
            assignAsPrimaryParent: true,
            emergencyBasedPermissions: true,
            appointments: true,
            companionProfile: true,
            documents: true,
            expenses: true,
            tasks: true,
            chatWithVet: true,
          },
        },
        {
          companion: {companionId: 'companion-from-object'},
          userId: 'user-parent',
          inviteeName: 'Invited Parent',
          parentEmail: 'parent-email@test.com',
          parentPhone: '444',
          parentProfileImage: 'parent-image',
          status: 'unknown',
        },
        {},
      ]);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchCoParents({companionId: 'fallback-c'}) as any,
      );
      const payload = result.payload as any[];

      expect(payload[0]).toEqual(
        expect.objectContaining({
          id: 'mongo-link',
          parentId: 'parent-mongo',
          companionId: 'nested-companion',
          status: 'declined',
          firstName: 'Nested',
          phoneNumber: '555',
          profilePicture: 'profile-token',
          profileToken: 'token-1',
        }),
      );
      expect(payload[0].permissions).toEqual({
        assignAsPrimaryParent: true,
        emergencyBasedPermissions: true,
        appointments: true,
        companionProfile: true,
        documents: true,
        expenses: true,
        tasks: true,
        chatWithVet: true,
      });
      expect(payload[1]).toEqual(
        expect.objectContaining({
          id: 'user-parent-companion-from-object',
          email: 'parent-email@test.com',
          phoneNumber: '444',
          status: 'unknown',
        }),
      );
      expect(payload[2].id).toBe('cp_12345');

      dateSpy.mockRestore();
    });

    it('normalizes missing companion context to empty companion fields', async () => {
      mockCoParentApi.listByCompanion.mockResolvedValueOnce([
        {
          parentId: 'parent-only',
          status: 'pending',
        },
      ]);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchCoParents({companionId: undefined as any}) as any,
      );
      const payload = result.payload as any[];

      expect(payload[0]).toEqual(
        expect.objectContaining({
          id: 'parent-only-companion',
          companionId: '',
          parentId: 'parent-only',
          companions: [],
        }),
      );
    });
  });

  // --- addCoParent ---

  describe('addCoParent', () => {
    const inviteRequest = {
      candidateName: 'New Parent',
      email: 'new@test.com',
      companionId: 'c2',
      phoneNumber: '123',
    };

    it('should send invite and normalize response', async () => {
      const mockResponse = {
        parentId: 'p2',
        status: 'invited',
        permissions: {tasks: true},
      };
      mockCoParentApi.sendInvite.mockResolvedValueOnce(mockResponse);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        addCoParent({inviteRequest, companionName: 'Buddy'}) as any,
      );

      expect(mockCoParentApi.sendInvite).toHaveBeenCalledWith(
        expect.objectContaining({email: 'new@test.com'}),
      );
      expect(result.type).toBe('coParent/addCoParent/fulfilled');

      const payload = result.payload as any;
      expect(payload.firstName).toBe('New'); // Name splitting logic check
      expect(payload.status).toBe('pending'); // 'invited' normalized to 'pending'
    });

    it('should handle API failure', async () => {
      mockCoParentApi.sendInvite.mockRejectedValueOnce(
        new Error('Invite Failed'),
      );
      const store = mockStore(initialMockState);
      const result = await store.dispatch(addCoParent({inviteRequest}) as any);
      expect(result.payload).toBe('Invite Failed');
    });

    it('uses invite fallbacks when the API response is empty', async () => {
      const dateSpy = jest.spyOn(Date, 'now').mockReturnValue(23456);
      mockCoParentApi.sendInvite.mockResolvedValueOnce(undefined as any);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        addCoParent({
          inviteRequest: {
            candidateName: '',
            email: 'fallback@test.com',
            companionId: 'c2',
          } as any,
        }) as any,
      );
      const payload = result.payload as any;

      expect(payload.id).toBe('cp_23456');
      expect(payload.email).toBe('fallback@test.com');
      expect(payload.status).toBe('pending');

      dateSpy.mockRestore();
    });
  });

  // --- updateCoParentPermissions ---

  describe('updateCoParentPermissions', () => {
    const perms = {appointments: true} as CoParentPermissions;

    it('should update permissions using API response', async () => {
      mockCoParentApi.updatePermissions.mockResolvedValueOnce({
        id: 'cp_123',
        status: 'active',
        permissions: perms,
      });

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        updateCoParentPermissions({
          companionId: 'c1',
          coParentId: 'cp_123',
          permissions: perms,
        }) as any,
      );

      expect(result.type).toBe('coParent/updateCoParentPermissions/fulfilled');
      const payload = result.payload as any;
      expect(payload.permissions.appointments).toBe(true);
      expect(payload.companions[0].companionName).toBe('My Companion'); // Merged from state
    });

    it('should fallback to existing state logic if API returns empty object', async () => {
      mockCoParentApi.updatePermissions.mockResolvedValueOnce({});

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        updateCoParentPermissions({
          companionId: 'c1',
          coParentId: 'cp_123',
          permissions: perms,
        }) as any,
      );

      expect(result.type).toBe('coParent/updateCoParentPermissions/fulfilled');
      expect((result.payload as any).email).toBe('existing@test.com'); // Data merged from state
    });

    it('should handle API failure', async () => {
      mockCoParentApi.updatePermissions.mockRejectedValueOnce(
        new Error('Update Failed'),
      );
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        updateCoParentPermissions({
          companionId: 'c1',
          coParentId: 'cp_123',
          permissions: perms,
        }) as any,
      );
      expect(result.payload).toBe('Update Failed');
    });

    it('falls back to the submitted permissions when no existing co-parent is found', async () => {
      mockCoParentApi.updatePermissions.mockResolvedValueOnce(null as any);

      const store = mockStore({coParent: {coParents: []}});
      const result = await store.dispatch(
        updateCoParentPermissions({
          companionId: 'c9',
          coParentId: 'missing',
          permissions: perms,
        }) as any,
      );

      expect(result.type).toBe('coParent/updateCoParentPermissions/fulfilled');
      expect((result.payload as any).companionId).toBe('c9');
      expect((result.payload as any).permissions.appointments).toBe(true);
    });

    it('uses existing state role and companion image when the API response is empty', async () => {
      mockCoParentApi.updatePermissions.mockResolvedValueOnce({});

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        updateCoParentPermissions({
          companionId: 'c1',
          coParentId: 'cp_123',
          permissions: perms,
        }) as any,
      );

      expect((result.payload as any).role).toBe('CO-PARENT');
      expect((result.payload as any).companions[0].profileImage).toBe('c-img');
    });
  });

  // --- deleteCoParent ---

  describe('deleteCoParent', () => {
    it('should delete co-parent', async () => {
      mockCoParentApi.remove.mockResolvedValueOnce(undefined as any);
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        deleteCoParent({companionId: 'c1', coParentId: 'cp_1'}) as any,
      );

      expect(mockCoParentApi.remove).toHaveBeenCalled();
      expect(result.payload).toEqual({coParentId: 'cp_1'});
    });

    it('should handle failure', async () => {
      mockCoParentApi.remove.mockRejectedValueOnce(new Error('Delete Failed'));
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        deleteCoParent({companionId: 'c1', coParentId: 'cp_1'}) as any,
      );
      expect(result.payload).toBe('Delete Failed');
    });
  });

  // --- promoteCoParentToPrimary ---

  describe('promoteCoParentToPrimary', () => {
    it('should promote co-parent', async () => {
      mockCoParentApi.promoteToPrimary.mockResolvedValueOnce(undefined as any);
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        promoteCoParentToPrimary({
          companionId: 'c1',
          coParentId: 'cp_1',
        }) as any,
      );

      expect(mockCoParentApi.promoteToPrimary).toHaveBeenCalled();
      expect(result.type).toBe('coParent/promoteCoParentToPrimary/fulfilled');
    });

    it('should handle failure', async () => {
      mockCoParentApi.promoteToPrimary.mockRejectedValueOnce(
        new Error('Promote Failed'),
      );
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        promoteCoParentToPrimary({
          companionId: 'c1',
          coParentId: 'cp_1',
        }) as any,
      );
      expect(result.payload).toBe('Promote Failed');
    });
  });

  // --- fetchPendingInvites ---

  describe('fetchPendingInvites', () => {
    it('should fetch invites', async () => {
      const invites = [{id: 'i1', status: 'pending'}];
      mockCoParentApi.listPendingInvites.mockResolvedValueOnce(invites as any);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchPendingInvites() as any);

      expect(result.type).toBe('coParent/fetchPendingInvites/fulfilled');
      expect(result.payload).toEqual(invites);
    });

    it('should handle failure', async () => {
      mockCoParentApi.listPendingInvites.mockRejectedValueOnce(
        new Error('Fetch Failed'),
      );
      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchPendingInvites() as any);
      expect(result.payload).toBe('Fetch Failed');
    });
  });

  // --- acceptCoParentInvite ---

  describe('acceptCoParentInvite', () => {
    it('should accept invite', async () => {
      mockCoParentApi.acceptInvite.mockResolvedValueOnce(undefined as any);
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        acceptCoParentInvite({token: 't1'}) as any,
      );

      expect(mockCoParentApi.acceptInvite).toHaveBeenCalledWith({
        token: 't1',
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result.payload).toBe('t1');
    });

    it('should handle failure', async () => {
      mockCoParentApi.acceptInvite.mockRejectedValueOnce(
        new Error('Accept Failed'),
      );
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        acceptCoParentInvite({token: 't1'}) as any,
      );
      expect(result.payload).toBe('Accept Failed');
    });
  });

  // --- declineCoParentInvite ---

  describe('declineCoParentInvite', () => {
    it('should decline invite', async () => {
      mockCoParentApi.declineInvite.mockResolvedValueOnce(undefined as any);
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        declineCoParentInvite({token: 't1'}) as any,
      );

      expect(mockCoParentApi.declineInvite).toHaveBeenCalledWith({
        token: 't1',
        accessToken: MOCK_ACCESS_TOKEN,
      });
      expect(result.payload).toBe('t1');
    });

    it('should handle failure', async () => {
      mockCoParentApi.declineInvite.mockRejectedValueOnce(
        new Error('Decline Failed'),
      );
      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        declineCoParentInvite({token: 't1'}) as any,
      );
      expect(result.payload).toBe('Decline Failed');
    });
  });

  // --- fetchParentAccess ---

  describe('fetchParentAccess', () => {
    const parentId = 'p1';

    it('should fetch access by parent', async () => {
      const links = [{companionId: 'c1', role: 'OWNER', status: 'Active'}];
      mockCoParentApi.listByParent.mockResolvedValueOnce(links);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchParentAccess({parentId}) as any);

      expect(result.type).toBe('coParent/fetchParentAccess/fulfilled');
      const payload = result.payload as any[];
      expect(payload).toHaveLength(1);
      expect(payload[0].role).toBe('OWNER');
      expect(payload[0].status).toBe('accepted');
    });

    it('should resolve missing companionIds in parallel (listByCompanion fallback)', async () => {
      // 1. listByParent returns empty
      mockCoParentApi.listByParent.mockResolvedValueOnce([]);

      // 2. listByCompanion called for each ID
      mockCoParentApi.listByCompanion.mockImplementation(
        async ({companionId}) => {
          if (companionId === 'c2')
            return [{companionId: 'c2', parentId: 'p1', status: 'Pending'}];
          return [];
        },
      );

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchParentAccess({parentId, companionIds: ['c1', 'c2']}) as any,
      );

      expect(mockCoParentApi.listByCompanion).toHaveBeenCalledTimes(2);

      const payload = result.payload as any[];
      expect(payload).toHaveLength(1);
      expect(payload[0].companionId).toBe('c2');
      expect(payload[0].status).toBe('pending');
    });

    it('should handle failure', async () => {
      mockCoParentApi.listByParent.mockRejectedValueOnce(
        new Error('Access Failed'),
      );
      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchParentAccess({parentId}) as any);
      expect(result.payload).toBe('Access Failed');
    });

    it('normalizes parent access from nested objects and missing fields', async () => {
      mockCoParentApi.listByParent.mockResolvedValueOnce([
        {
          companion: {id: 'nested-c'},
          status: 'invited',
        },
      ]);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchParentAccess({parentId}) as any);
      const payload = result.payload as any[];

      expect(payload[0]).toEqual(
        expect.objectContaining({
          companionId: 'nested-c',
          parentId,
          role: 'CO-PARENT',
          status: 'pending',
        }),
      );
    });

    it('returns an empty parent access list when API returns null', async () => {
      mockCoParentApi.listByParent.mockResolvedValueOnce(null as any);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchParentAccess({parentId}) as any);

      expect(result.payload).toEqual([]);
    });

    it('normalizes parent access entries with no companion id', async () => {
      mockCoParentApi.listByParent.mockResolvedValueOnce([{}]);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchParentAccess({parentId}) as any);

      expect((result.payload as any[])[0]).toEqual(
        expect.objectContaining({
          companionId: undefined,
          parentId,
          role: 'CO-PARENT',
        }),
      );
    });

    it('should normalize declined/rejected statuses to "declined"', async () => {
      const links = [
        {companionId: 'c1', role: 'OWNER', status: 'Declined'},
        {companionId: 'c2', role: 'OWNER', status: 'Rejected'},
      ];
      mockCoParentApi.listByParent.mockResolvedValueOnce(links);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchParentAccess({parentId}) as any);

      const payload = result.payload as any[];
      expect(payload[0].status).toBe('declined');
      expect(payload[1].status).toBe('declined');
    });

    it('should pass through an unrecognized status as-is', async () => {
      const links = [{companionId: 'c1', role: 'OWNER', status: 'archived'}];
      mockCoParentApi.listByParent.mockResolvedValueOnce(links);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchParentAccess({parentId}) as any);

      const payload = result.payload as any[];
      expect(payload[0].status).toBe('archived');
    });

    it('should default to "pending" when the status is missing entirely', async () => {
      const links = [{companionId: 'c1', role: 'OWNER', status: null}];
      mockCoParentApi.listByParent.mockResolvedValueOnce(links);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(fetchParentAccess({parentId}) as any);

      const payload = result.payload as any[];
      expect(payload[0].status).toBe('pending');
    });

    it('should treat a companion whose listByCompanion call fails as having no link', async () => {
      mockCoParentApi.listByParent.mockResolvedValueOnce([]);
      mockCoParentApi.listByCompanion.mockImplementation(
        async ({companionId}) => {
          if (companionId === 'c1') {
            throw new Error('Companion lookup failed');
          }
          return [{companionId: 'c2', parentId: 'p1', status: 'Pending'}];
        },
      );

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchParentAccess({parentId, companionIds: ['c1', 'c2']}) as any,
      );

      const payload = result.payload as any[];
      expect(payload).toHaveLength(1);
      expect(payload[0].companionId).toBe('c2');
    });

    it('should not duplicate a companion already resolved via listByParent', async () => {
      mockCoParentApi.listByParent.mockResolvedValueOnce([
        {companionId: 'c1', role: 'OWNER', status: 'Active'},
      ]);
      mockCoParentApi.listByCompanion.mockResolvedValueOnce([
        {companionId: 'c1', parentId: 'p1', status: 'Pending'},
      ]);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchParentAccess({parentId, companionIds: ['c1']}) as any,
      );

      const payload = result.payload as any[];
      expect(payload).toHaveLength(1);
      expect(payload[0].status).toBe('accepted');
    });

    it('matches companion fallback links by nested parent id', async () => {
      mockCoParentApi.listByParent.mockResolvedValueOnce([]);
      mockCoParentApi.listByCompanion.mockResolvedValueOnce([
        {
          companionId: 'c1',
          parent: {id: 'p1'},
          role: 'SUPPORT',
          status: 'Active',
        },
      ]);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchParentAccess({parentId, companionIds: ['c1']}) as any,
      );

      expect((result.payload as any[])[0]).toEqual(
        expect.objectContaining({
          companionId: 'c1',
          role: 'SUPPORT',
          status: 'accepted',
        }),
      );
    });

    it('treats null companion lookup results as no match', async () => {
      mockCoParentApi.listByParent.mockResolvedValueOnce([]);
      mockCoParentApi.listByCompanion.mockResolvedValueOnce(null as any);

      const store = mockStore(initialMockState);
      const result = await store.dispatch(
        fetchParentAccess({parentId, companionIds: ['c1']}) as any,
      );

      expect(result.payload).toEqual([]);
    });
  });

  describe('generic non-Error failures', () => {
    it.each([
      [
        'fetchCoParents',
        () => mockCoParentApi.listByCompanion.mockRejectedValueOnce('bad'),
        () => fetchCoParents({companionId: 'c1'}),
        'Failed to fetch co-parents',
      ],
      [
        'addCoParent',
        () => mockCoParentApi.sendInvite.mockRejectedValueOnce('bad'),
        () => addCoParent({inviteRequest: inviteRequestFactory()}),
        'Failed to send invite',
      ],
      [
        'updateCoParentPermissions',
        () => mockCoParentApi.updatePermissions.mockRejectedValueOnce('bad'),
        () =>
          updateCoParentPermissions({
            companionId: 'c1',
            coParentId: 'cp_123',
            permissions: {appointments: true} as CoParentPermissions,
          }),
        'Failed to update permissions',
      ],
      [
        'deleteCoParent',
        () => mockCoParentApi.remove.mockRejectedValueOnce('bad'),
        () => deleteCoParent({companionId: 'c1', coParentId: 'cp_1'}),
        'Failed to delete co-parent',
      ],
      [
        'promoteCoParentToPrimary',
        () => mockCoParentApi.promoteToPrimary.mockRejectedValueOnce('bad'),
        () => promoteCoParentToPrimary({companionId: 'c1', coParentId: 'cp_1'}),
        'Failed to promote co-parent',
      ],
      [
        'fetchPendingInvites',
        () => mockCoParentApi.listPendingInvites.mockRejectedValueOnce('bad'),
        () => fetchPendingInvites(),
        'Failed to load pending invites',
      ],
      [
        'acceptCoParentInvite',
        () => mockCoParentApi.acceptInvite.mockRejectedValueOnce('bad'),
        () => acceptCoParentInvite({token: 't1'}),
        'Failed to accept invite',
      ],
      [
        'declineCoParentInvite',
        () => mockCoParentApi.declineInvite.mockRejectedValueOnce('bad'),
        () => declineCoParentInvite({token: 't1'}),
        'Failed to decline invite',
      ],
      [
        'fetchParentAccess',
        () => mockCoParentApi.listByParent.mockRejectedValueOnce('bad'),
        () => fetchParentAccess({parentId: 'p1'}),
        'Failed to fetch permissions',
      ],
    ])(
      '%s returns its fallback reject value',
      async (_name, setup, thunkFactory, expected) => {
        setup();
        const store = mockStore(initialMockState);
        const result = await store.dispatch(thunkFactory() as any);

        expect(result.payload).toBe(expected);
      },
    );
  });
});

const inviteRequestFactory = () => ({
  candidateName: 'New Parent',
  email: 'new@test.com',
  companionId: 'c2',
  phoneNumber: '123',
});
