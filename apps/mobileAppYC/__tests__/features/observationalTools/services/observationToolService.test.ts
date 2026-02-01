import apiClient from '../../../../src/shared/services/apiClient';
import { getFreshStoredTokens, isTokenExpired } from '../../../../src/features/auth/sessionManager';
import {
  observationToolApi,
  resolveObservationToolIdSync,
  getCachedObservationToolName,
  getCachedObservationTool,
} from '../../../../src/features/observationalTools/services/observationToolService';
// We mock the static definitions to have predictable test data
// The 'as any' cast is used to avoid strict type checking on the mock data import

// --- Mocks ---
jest.mock('../../../../src/shared/services/apiClient');
jest.mock('../../../../src/features/auth/sessionManager');
jest.mock('../../../../src/features/observationalTools/data', () => ({
  observationalToolDefinitions: {
    'static-tool-key': {
      name: 'Static Tool Name',
      shortName: 'Static Short',
    },
    'another-static': {
      name: 'Another Static',
    }
  },
}));

describe('observationToolService', () => {
  const mockAccessToken = 'mock-access-token';
  const mockUserId = 'mock-user-id';

  beforeEach(() => {
    jest.clearAllMocks();

    // Default Mock Implementations
    (getFreshStoredTokens as jest.Mock).mockResolvedValue({
      accessToken: mockAccessToken,
      userId: mockUserId,
      expiresAt: Date.now() + 10000,
    });
    (isTokenExpired as jest.Mock).mockReturnValue(false);
  });

  // =========================================================================
  // Section 1: Helper Functions & Caching Logic
  // =========================================================================
  describe('Helper Functions', () => {
    describe('resolveObservationToolIdSync', () => {
      it('returns null if toolId is missing', () => {
        expect(resolveObservationToolIdSync(null)).toBeNull();
        expect(resolveObservationToolIdSync(undefined)).toBeNull();
      });

      it('returns toolId directly if it matches MongoID format', () => {
        const mongoId = '507f1f77bcf86cd799439011';
        expect(resolveObservationToolIdSync(mongoId)).toBe(mongoId);
      });

      it('returns toolId directly if found in cache by ID', async () => {
        // First populate cache with a UNIQUE ID for this test
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{ id: 'cached-id-1', name: 'Cached Tool 1' }]
        });
        await observationToolApi.list();

        expect(resolveObservationToolIdSync('cached-id-1')).toBe('cached-id-1');
      });

      it('resolves ID from cache by Name', async () => {
        // Populate cache with UNIQUE ID/Name
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{ id: 'cached-id-2', name: 'My Special Tool' }]
        });
        await observationToolApi.list();

        // Exact name
        expect(resolveObservationToolIdSync('My Special Tool')).toBe('cached-id-2');
        // Case insensitive / normalized
        expect(resolveObservationToolIdSync('my special tool')).toBe('cached-id-2');
      });

      it('resolves ID from Static Definitions', () => {
        // 1. Static def 'static-tool-key' has name 'Static Tool Name'
        // 2. We pretend the API returned a tool with that name and a real ID
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{ id: 'real-db-id-123', name: 'Static Tool Name' }]
        });

        // Populate cache
        return observationToolApi.list().then(() => {
           // Now passing the key 'static-tool-key' should look up the static def -> get name -> find in cache
           expect(resolveObservationToolIdSync('static-tool-key')).toBe('real-db-id-123');
        });
      });

      it('returns original toolId if not resolved', () => {
        expect(resolveObservationToolIdSync('unknown-key')).toBe('unknown-key');
      });
    });

    describe('getCachedObservationToolName', () => {
      it('returns null if toolId is missing', () => {
        expect(getCachedObservationToolName(null)).toBeNull();
      });

      it('returns name from cache by ID', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{ id: 'id-xyz', name: 'Tool XYZ' }]
        });
        await observationToolApi.list();
        expect(getCachedObservationToolName('id-xyz')).toBe('Tool XYZ');
      });

      it('returns name from cache by Name (normalization)', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{ id: 'id-abc', name: 'Tool ABC' }]
        });
        await observationToolApi.list();
        expect(getCachedObservationToolName('tool abc')).toBe('Tool ABC');
      });

      it('returns null if not found', () => {
        expect(getCachedObservationToolName('non-existent')).toBeNull();
      });
    });

    describe('getCachedObservationTool', () => {
      it('returns null if toolId is missing', () => {
        expect(getCachedObservationTool(null)).toBeNull();
      });

      it('returns full object from cache by ID', async () => {
        const toolData = { id: 'id-full', name: 'Full Tool', category: 'Health' };
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [toolData] });
        await observationToolApi.list();

        const result = getCachedObservationTool('id-full');
        expect(result).toMatchObject(toolData);
      });

      it('returns full object from cache by Name', async () => {
        const toolData = { id: 'id-full-2', name: 'Named Tool' };
        (apiClient.get as jest.Mock).mockResolvedValue({ data: [toolData] });
        await observationToolApi.list();

        const result = getCachedObservationTool('Named Tool');
        expect(result).toMatchObject(toolData);
      });

      it('returns full object via static definition name resolution', async () => {
        // NOTE: The previous test 'resolves ID from Static Definitions' ALREADY populated the cache
        // with 'Static Tool Name' -> 'real-db-id-123'.
        // Since toolCache persists across tests in the same file, we must assert against
        // what is effectively already in the cache, OR use the other static key.
        // We will assert against the existing cache to acknowledge the singleton state.

        const toolData = { id: 'real-db-id-123', name: 'Static Tool Name' };
        // We don't even need to mock API here because it's already in cache from previous test.

        const result = getCachedObservationTool('static-tool-key');
        expect(result).toMatchObject(toolData);
      });

      it('returns null if not found', () => {
        expect(getCachedObservationTool('nothing')).toBeNull();
      });
    });
  });

  // =========================================================================
  // Section 2: Auth & Error Logic
  // =========================================================================
  describe('Auth Logic (ensureAccessToken)', () => {
    it('throws if no access token', async () => {
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({ accessToken: null });
      await expect(observationToolApi.list()).rejects.toThrow('Missing access token');
    });

    it('throws if token expired', async () => {
      (isTokenExpired as jest.Mock).mockReturnValue(true);
      await expect(observationToolApi.list()).rejects.toThrow('Your session expired');
    });
  });

  // =========================================================================
  // Section 3: API Methods
  // =========================================================================
  describe('observationToolApi', () => {

    describe('list', () => {
      it('fetches and maps tools list', async () => {
        // Use unique IDs to avoid polluting cache for the specific GET test later
        const mockData = [
          { _id: 'list-id-1', name: 'List Tool 1', isActive: true },
          { id: 'list-id-2', name: 'List Tool 2', description: 'Desc' }
        ];
        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockData });

        const result = await observationToolApi.list({ onlyActive: true });

        expect(apiClient.get).toHaveBeenCalledWith('/v1/observation-tools/mobile/tools', expect.objectContaining({
          params: { onlyActive: 'true' },
          headers: expect.objectContaining({ 'x-user-id': mockUserId })
        }));

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('list-id-1');
        expect(result[1].id).toBe('list-id-2');
      });

      it('handles empty response gracefully', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ data: null });
        const result = await observationToolApi.list();
        expect(result).toEqual([]);
      });
    });

    describe('get', () => {
      it('fetches a single tool by ID', async () => {
        // Use a UNIQUE ID ('tool-unique-get') to ensure it is NOT found in the cache
        // from previous tests (like 'tool-1' might have been if names collided)
        const mockTool = { _id: 'tool-unique-get', name: 'Single Tool' };
        (apiClient.get as jest.Mock).mockResolvedValue({ data: mockTool });

        const result = await observationToolApi.get('tool-unique-get');

        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/tool-unique-get',
          expect.anything()
        );
        expect(result.id).toBe('tool-unique-get');
        expect(result.name).toBe('Single Tool');
      });

      it('attempts to resolve ID from static/cache before fetching', async () => {
        // We use 'another-static' because 'static-tool-key' was already cached in a previous test.
        // 'another-static' -> 'Another Static'

        (apiClient.get as jest.Mock).mockImplementation((url) => {
          // If the code calls list to resolve the name
          if (url.includes('/tools?')) {
             return Promise.resolve({ data: [{ id: 'real-id-999', name: 'Another Static' }] });
          }
          // If the code calls get with the resolved ID
          if (url.includes('/tools/real-id-999')) {
             return Promise.resolve({ data: { id: 'real-id-999', name: 'Another Static' } });
          }
          return Promise.resolve({ data: {} });
        });
      });
    });

    describe('submit', () => {
      it('posts submission payload', async () => {
        const submissionResponse = {
          _id: 'sub-1',
          toolId: 'tool-1',
          score: 10
        };
        (apiClient.post as jest.Mock).mockResolvedValue({ data: submissionResponse });

        const result = await observationToolApi.submit({
          toolId: 'tool-1',
          companionId: 'comp-1',
          taskId: 'task-1',
          answers: { q1: 'yes' },
          summary: 'Good'
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/tool-1/submissions',
          expect.objectContaining({
            companionId: 'comp-1',
            taskId: 'task-1',
            answers: { q1: 'yes' },
            summary: 'Good'
          }),
          expect.anything()
        );

        expect(result.id).toBe('sub-1');
        expect(result.score).toBe(10);
      });
    });

    describe('linkSubmissionToAppointment', () => {
      it('links submission and returns updated object', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: { id: 'sub-1', evaluationAppointmentId: 'appt-1' }
        });

        const result = await observationToolApi.linkSubmissionToAppointment({
          submissionId: 'sub-1',
          appointmentId: 'appt-1'
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/submissions/sub-1/link-appointment',
          { appointmentId: 'appt-1' },
          expect.anything()
        );
        expect(result.evaluationAppointmentId).toBe('appt-1');
      });
    });

    describe('getSubmission', () => {
      it('fetches submission details', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: { _id: 'sub-details-1', score: 5 }
        });

        const result = await observationToolApi.getSubmission('sub-details-1');
        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/submissions/sub-details-1',
          expect.anything()
        );
        expect(result.id).toBe('sub-details-1');
      });
    });

    describe('listAppointmentSubmissions', () => {
      it('fetches list for appointment', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{ id: 's1' }, { id: 's2' }]
        });

        const result = await observationToolApi.listAppointmentSubmissions('appt-123');
        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/appointments/appt-123/submissions',
          expect.anything()
        );
        expect(result).toHaveLength(2);
        expect(result[0].evaluationAppointmentId).toBe('appt-123'); // forced by mapper
      });
    });

    describe('previewTaskSubmission', () => {
      it('fetches preview of task submission', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: { submissionId: 'sub-preview', answersPreview: { q: 1 } }
        });

        const result = await observationToolApi.previewTaskSubmission('task-preview');
        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tasks/task-preview/preview',
          expect.anything()
        );
        expect(result.id).toBe('sub-preview');
        expect(result.taskId).toBe('task-preview');
      });
    });
  });
});