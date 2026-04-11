import {
  fetchMobileNotifications,
  markMobileNotificationSeen,
} from '../../../../src/features/notifications/services/notificationService';
import apiClient from '../../../../src/shared/services/apiClient';
import {getFreshStoredTokens} from '../../../../src/features/auth/sessionManager';

// --- Mocks ---

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
  withAuthHeaders: jest.fn().mockImplementation((token) => ({
    Authorization: `Bearer ${token}`,
  })),
}));

jest.mock('@/features/auth/sessionManager', () => ({
  getFreshStoredTokens: jest.fn(),
}));

describe('notificationService', () => {
  const mockToken = 'valid-token';

  beforeEach(() => {
    jest.clearAllMocks();
    // Default valid token
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: mockToken,
    });
  });

  // ===========================================================================
  // 1. fetchMobileNotifications (Core Logic & Normalization)
  // ===========================================================================

  describe('fetchMobileNotifications', () => {
    it('fetches and normalizes notifications correctly (Happy Path)', async () => {
      // Mock data designed to hit various normalization branches
      const rawData = [
        {
          id: '1',
          title: 'Appointment',
          type: 'appointments', // Direct match
          status: 'unread',
          createdAt: '2023-01-02T10:00:00Z', // Newer
          priority: 'high',
        },
        {
          _id: '2', // Alternate ID field
          heading: 'Billing Info', // Alternate title field
          category: 'billing', // Synonym for 'payment'
          state: 'read', // Alternate status field
          timestamp: '2023-01-01T10:00:00Z', // Older
        },
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({data: rawData});

      const result = await fetchMobileNotifications();

      expect(apiClient.get).toHaveBeenCalledWith(
        '/v1/notification/mobile',
        expect.objectContaining({headers: {Authorization: `Bearer ${mockToken}`}}),
      );

      // Verify Sorting (Newest first) - "Appointment" is 02 Jan, "Billing" is 01 Jan
      expect(result[0].id).toBe('1');
      expect(result[1].id).toBe('2');

      // Verify Normalization Item 1
      expect(result[0]).toEqual(
        expect.objectContaining({
          id: '1',
          title: 'Appointment',
          category: 'appointments',
          priority: 'high',
          status: 'unread',
          icon: 'calendarIcon',
        }),
      );

      // Verify Normalization Item 2
      expect(result[1]).toEqual(
        expect.objectContaining({
          id: '2',
          title: 'Billing Info',
          category: 'payment', // Normalized from 'billing'
          status: 'read',
          icon: 'walletIcon',
        }),
      );
    });

    // --- Branch Coverage: Categories & Icons ---

    it('normalizes all category synonyms and maps icons correctly', async () => {
      const testCases = [
        {cat: 'appts', expected: 'appointments', icon: 'calendarIcon'},
        {cat: 'auth', expected: 'messages', icon: 'chatIcon'}, // otp/login -> messages
        {cat: 'care', expected: 'health', icon: 'healthIcon'},
        {cat: 'dietary', expected: 'dietary', icon: 'dietryIcon'},
        {cat: 'hygiene', expected: 'hygiene', icon: 'hygeineIcon'},
        {cat: 'documents', expected: 'documents', icon: 'documentIcon'},
        {cat: 'tasks', expected: 'tasks', icon: 'checkIcon'},
        {cat: 'unknown_cat', expected: 'all', icon: 'notificationIcon'}, // Default
        {cat: undefined, expected: 'all', icon: 'notificationIcon'}, // Missing
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: testCases.map((tc, i) => ({
          id: `id-${i}`,
          category: tc.cat,
          // Decrementing timestamp ensures order corresponds to array index (0 is newest)
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        })),
      });

      const result = await fetchMobileNotifications();

      testCases.forEach((tc, i) => {
        // Find by ID to be sort-independent
        const item = result.find(r => r.id === `id-${i}`);
        expect(item).toBeDefined();
        expect(item!.category).toBe(tc.expected);
        expect(item!.icon).toBe(tc.icon);
      });
    });

    // --- Branch Coverage: Status Derivation ---

    it('derives status from various fields correctly', async () => {
      const testCases = [
        {fields: {status: 'seen'}, expected: 'read'},
        {fields: {state: 'archived'}, expected: 'archived'},
        {fields: {isSeen: true}, expected: 'read'},
        {fields: {seen: true}, expected: 'read'},
        {fields: {status: 'other'}, expected: 'unread'}, // Fallback
      ];

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: testCases.map((tc, i) => ({
          id: `id-${i}`,
          ...tc.fields,
          createdAt: new Date(Date.now() - i * 1000).toISOString(),
        })),
      });

      const result = await fetchMobileNotifications();

      testCases.forEach((tc, i) => {
        const item = result.find(r => r.id === `id-${i}`);
        expect(item).toBeDefined();
        expect(item!.status).toBe(tc.expected);
      });
    });

    // --- Branch Coverage: Field Fallbacks ---

    it('uses fallback fields for ID, CompanionID, Title, Description, and Timestamp', async () => {
      const complexRecord = {
        notificationId: 'notif-id-1', // Fallback for id/_id
        ownerId: 'owner-1', // Fallback for companionId
        message: 'Deep description', // Fallback for description/body
        relatedType: 'invoice', // Should normalize to 'payment'
        entityId: 'ent-1', // Fallback for relatedId
        link: 'http://link', // Fallback for deepLink
        imageUrl: 'http://img', // Fallback for avatarUrl
        sentAt: '2023-05-05T00:00:00Z', // Old timestamp
      };

      const minimalRecord = {
        // No IDs -> generated
        // No companion -> default
        // No title -> default
        // No timestamp -> current time (Newer than 2023)
        data: {some: 'meta'},
      };

      (apiClient.get as jest.Mock).mockResolvedValue({
        data: [complexRecord, minimalRecord],
      });

      const result = await fetchMobileNotifications();

      // Sort logic puts newer first. minimalRecord (now) > complexRecord (2023)
      // So result[0] is minimal, result[1] is complex.
      // We use find to grab them explicitly.
      const complex = result.find(n => n.id === 'notif-id-1');
      const minimal = result.find(n => n.id !== 'notif-id-1');

      expect(complex).toBeDefined();
      expect(minimal).toBeDefined();

      // Assert Complex
      expect(complex!.id).toBe('notif-id-1');
      expect(complex!.companionId).toBe('owner-1');
      expect(complex!.description).toBe('Deep description');
      expect(complex!.relatedType).toBe('payment');
      expect(complex!.relatedId).toBe('ent-1');
      expect(complex!.deepLink).toBe('http://link');
      expect(complex!.avatarUrl).toBe('http://img');
      expect(complex!.timestamp).toBe('2023-05-05T00:00:00.000Z');

      // Assert Minimal
      expect(minimal!.id).toMatch(/^notif_/); // Auto-generated ID
      expect(minimal!.companionId).toBe('default-companion');
      expect(minimal!.title).toBe('Notification');
      expect(minimal!.timestamp).toBeTruthy();
      expect(minimal!.metadata).toEqual({some: 'meta'});
    });

    it('normalizes specific related types correctly', async () => {
         const types = ['appointment', 'document', 'task', 'message', 'payment', 'unknown'];

         (apiClient.get as jest.Mock).mockResolvedValue({
            data: types.map(t => ({id: t, relatedType: t, createdAt: new Date().toISOString()}))
         });

         const result = await fetchMobileNotifications();

         expect(result.find(n => n.id === 'appointment')?.relatedType).toBe('appointment');
         expect(result.find(n => n.id === 'document')?.relatedType).toBe('document');
         expect(result.find(n => n.id === 'task')?.relatedType).toBe('task');
         expect(result.find(n => n.id === 'message')?.relatedType).toBe('message');
         expect(result.find(n => n.id === 'payment')?.relatedType).toBe('payment');
         expect(result.find(n => n.id === 'unknown')?.relatedType).toBeUndefined();
    });

    // --- Branch Coverage: Payload Structures ---

    it('extracts list from "notifications" property', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { notifications: [{ id: '1' }] },
      });
      const result = await fetchMobileNotifications();
      expect(result).toHaveLength(1);
    });

    it('extracts list from "items" property', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({
        data: { items: [{ id: '1' }] },
      });
      const result = await fetchMobileNotifications();
      expect(result).toHaveLength(1);
    });

    it('extracts list from nested "data" property', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: { data: [{ id: '1' }] },
        });
        const result = await fetchMobileNotifications();
        expect(result).toHaveLength(1);
      });

    it('returns empty array for invalid payload', async () => {
      (apiClient.get as jest.Mock).mockResolvedValue({ data: null });
      const result = await fetchMobileNotifications();
      expect(result).toEqual([]);
    });

    // --- Auth Logic ---

    it('handles missing auth token gracefully', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue(null);
      (apiClient.get as jest.Mock).mockResolvedValue({ data: [] });

      await fetchMobileNotifications();

      // Should call without headers object (or undefined headers)
      expect(apiClient.get).toHaveBeenCalledWith('/v1/notification/mobile', undefined);
    });

    // --- Date Parsing Edge Case ---
    it('handles invalid dates gracefully by falling back to current date', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
            data: [{ id: '1', createdAt: 'invalid-date-string' }],
          });

        const result = await fetchMobileNotifications();
        // Should parse to a valid ISO string (current time fallback)
        expect(Date.parse(result[0].timestamp)).not.toBeNaN();
    });
  });

  // ===========================================================================
  // 2. markMobileNotificationSeen
  // ===========================================================================

  describe('markMobileNotificationSeen', () => {
    it('calls API to mark notification seen', async () => {
      await markMobileNotificationSeen('123');

      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/notification/mobile/123/seen',
        undefined,
        expect.objectContaining({headers: {Authorization: `Bearer ${mockToken}`}}),
      );
    });

    it('returns early if notificationId is missing', async () => {
      await markMobileNotificationSeen('');
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it('handles missing auth token gracefully', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue(null);

      await markMobileNotificationSeen('123');

      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/notification/mobile/123/seen',
        undefined,
        undefined, // No headers passed
      );
    });
  });
});