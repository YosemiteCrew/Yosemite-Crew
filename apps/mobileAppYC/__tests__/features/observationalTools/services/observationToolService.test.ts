import apiClient from '../../../../src/shared/services/apiClient';
import {
  getFreshStoredTokens,
  isTokenExpired,
} from '../../../../src/features/auth/sessionManager';
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
    },
    'fresh-static-key': {
      name: 'Fresh Static Name',
    },
    // Used only by the static-key resolution test; the module-level tool cache
    // is shared across cases, so this name must not be cached anywhere else.
    'isolated-static-key': {
      name: 'Isolated Static Tool',
    },
    'remote-static-key': {
      name: 'Remote Static Name',
    },
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
          data: [{id: 'cached-id-1', name: 'Cached Tool 1'}],
        });
        await observationToolApi.list();

        expect(resolveObservationToolIdSync('cached-id-1')).toBe('cached-id-1');
      });

      it('resolves ID from cache by Name', async () => {
        // Populate cache with UNIQUE ID/Name
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{id: 'cached-id-2', name: 'My Special Tool'}],
        });
        await observationToolApi.list();

        // Exact name
        expect(resolveObservationToolIdSync('My Special Tool')).toBe(
          'cached-id-2',
        );
        // Case insensitive / normalized
        expect(resolveObservationToolIdSync('my special tool')).toBe(
          'cached-id-2',
        );
      });

      it('resolves ID from Static Definitions', () => {
        // 1. Static def 'static-tool-key' has name 'Static Tool Name'
        // 2. We pretend the API returned a tool with that name and a real ID
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{id: 'real-db-id-123', name: 'Static Tool Name'}],
        });

        // Populate cache
        return observationToolApi.list().then(() => {
          // Now passing the key 'static-tool-key' should look up the static def -> get name -> find in cache
          expect(resolveObservationToolIdSync('static-tool-key')).toBe(
            'real-db-id-123',
          );
        });
      });

      it('returns original toolId if not resolved', () => {
        expect(resolveObservationToolIdSync('unknown-key')).toBe('unknown-key');
      });

      it('returns the original toolId when its static name resolves but is not yet cached', () => {
        // 'another-static' resolves to 'Another Static' via static defs, but
        // nothing has cached that name at this point in the suite.
        expect(resolveObservationToolIdSync('another-static')).toBe(
          'another-static',
        );
      });
    });

    describe('getCachedObservationToolName', () => {
      it('returns null if toolId is missing', () => {
        expect(getCachedObservationToolName(null)).toBeNull();
      });

      it('returns name from cache by ID', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{id: 'id-xyz', name: 'Tool XYZ'}],
        });
        await observationToolApi.list();
        expect(getCachedObservationToolName('id-xyz')).toBe('Tool XYZ');
      });

      it('returns name from cache by Name (normalization)', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{id: 'id-abc', name: 'Tool ABC'}],
        });
        await observationToolApi.list();
        expect(getCachedObservationToolName('tool abc')).toBe('Tool ABC');
      });

      it('returns null if not found', () => {
        expect(getCachedObservationToolName('non-existent')).toBeNull();
      });

      it('returns null when the toolId normalizes to an empty string', () => {
        expect(getCachedObservationToolName('!!!')).toBeNull();
      });
    });

    describe('getCachedObservationTool', () => {
      it('returns null if toolId is missing', () => {
        expect(getCachedObservationTool(null)).toBeNull();
      });

      it('returns full object from cache by ID', async () => {
        const toolData = {id: 'id-full', name: 'Full Tool', category: 'Health'};
        (apiClient.get as jest.Mock).mockResolvedValue({data: [toolData]});
        await observationToolApi.list();

        const result = getCachedObservationTool('id-full');
        expect(result).toMatchObject(toolData);
      });

      it('returns full object from cache by Name', async () => {
        const toolData = {id: 'id-full-2', name: 'Named Tool'};
        (apiClient.get as jest.Mock).mockResolvedValue({data: [toolData]});
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

        const toolData = {id: 'real-db-id-123', name: 'Static Tool Name'};
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
      (getFreshStoredTokens as jest.Mock).mockResolvedValue({
        accessToken: null,
      });
      await expect(observationToolApi.list()).rejects.toThrow(
        'Missing access token',
      );
    });

    it('throws if token expired', async () => {
      (isTokenExpired as jest.Mock).mockReturnValue(true);
      await expect(observationToolApi.list()).rejects.toThrow(
        'Your session expired',
      );
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
          {_id: 'list-id-1', name: 'List Tool 1', isActive: true},
          {id: 'list-id-2', name: 'List Tool 2', description: 'Desc'},
        ];
        (apiClient.get as jest.Mock).mockResolvedValue({data: mockData});

        const result = await observationToolApi.list({onlyActive: true});

        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools',
          expect.objectContaining({
            params: {onlyActive: 'true'},
            headers: expect.not.objectContaining({
              'x-user-id': expect.anything(),
            }),
          }),
        );

        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('list-id-1');
        expect(result[1].id).toBe('list-id-2');
      });

      it('handles empty response gracefully', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({data: null});
        const result = await observationToolApi.list();
        expect(result).toEqual([]);
      });

      it('falls back through toolId/key/name when an item has no _id or id', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{toolId: 'fallback-tool-id', name: 'Fallback Tool'}],
        });
        const result = await observationToolApi.list();
        expect(result[0].id).toBe('fallback-tool-id');
      });

      it('falls back to key when an item has no _id/id/toolId', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{key: 'fallback-key', name: 'Fallback Key Tool'}],
        });
        const result = await observationToolApi.list();
        expect(result[0].id).toBe('fallback-key');
      });

      it('falls back to name when an item has no _id/id/toolId/key', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{name: 'Fallback Name Tool'}],
        });
        const result = await observationToolApi.list();
        expect(result[0].id).toBe('Fallback Name Tool');
      });

      it('treats a missing expiresAt as undefined when checking token expiry', async () => {
        (getFreshStoredTokens as jest.Mock).mockResolvedValueOnce({
          accessToken: mockAccessToken,
          userId: mockUserId,
        });
        (apiClient.get as jest.Mock).mockResolvedValue({data: []});

        const result = await observationToolApi.list();
        expect(result).toEqual([]);
        expect(isTokenExpired).toHaveBeenCalledWith(undefined);
      });
    });

    describe('get', () => {
      it('fetches a single tool by ID', async () => {
        // Use a UNIQUE ID ('tool-unique-get') to ensure it is NOT found in the cache
        // from previous tests (like 'tool-1' might have been if names collided)
        const mockTool = {_id: 'tool-unique-get', name: 'Single Tool'};
        (apiClient.get as jest.Mock).mockResolvedValue({data: mockTool});

        const result = await observationToolApi.get('tool-unique-get');

        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/tool-unique-get',
          expect.anything(),
        );
        expect(result.id).toBe('tool-unique-get');
        expect(result.name).toBe('Single Tool');
      });

      it('attempts to resolve ID from static/cache before fetching', async () => {
        // We use 'another-static' because 'static-tool-key' was already cached in a previous test.
        // 'another-static' -> 'Another Static'

        (apiClient.get as jest.Mock).mockImplementation((url: string) => {
          // If the code calls list to resolve the name
          if (url === '/v1/observation-tools/mobile/tools') {
            return Promise.resolve({
              data: [{id: 'real-id-999', name: 'Another Static'}],
            });
          }
          // If the code calls get with the resolved ID
          if (url.includes('/tools/real-id-999')) {
            return Promise.resolve({
              data: {id: 'real-id-999', name: 'Another Static'},
            });
          }
          return Promise.resolve({data: {}});
        });

        const result = await observationToolApi.get('another-static');

        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/real-id-999',
          expect.anything(),
        );
        expect(result.id).toBe('real-id-999');
      });

      it('resolves a mongo-formatted toolId directly without listing tools', async () => {
        const mongoId = '507f191e810c19729de860ea';
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {_id: mongoId, name: 'Direct Mongo Tool'},
        });

        const result = await observationToolApi.get(mongoId);

        expect(apiClient.get).toHaveBeenCalledTimes(1);
        expect(apiClient.get).toHaveBeenCalledWith(
          `/v1/observation-tools/mobile/tools/${mongoId}`,
          expect.anything(),
        );
        expect(result.id).toBe(mongoId);
      });

      it('resolves a toolId already cached by ID without listing tools again', async () => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce({
          data: [{id: 'async-cache-id', name: 'Async Cache Tool'}],
        });
        await observationToolApi.list();

        (apiClient.get as jest.Mock).mockClear();
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {id: 'async-cache-id', name: 'Async Cache Tool'},
        });

        const result = await observationToolApi.get('async-cache-id');

        expect(apiClient.get).toHaveBeenCalledTimes(1);
        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/async-cache-id',
          expect.anything(),
        );
        expect(result.id).toBe('async-cache-id');
      });

      it('resolves a toolId already cached by name without listing tools again', async () => {
        (apiClient.get as jest.Mock).mockResolvedValueOnce({
          data: [{id: 'async-name-id', name: 'Async Name Tool'}],
        });
        await observationToolApi.list();

        (apiClient.get as jest.Mock).mockClear();
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {id: 'async-name-id', name: 'Async Name Tool'},
        });

        const result = await observationToolApi.get('Async Name Tool');

        expect(apiClient.get).toHaveBeenCalledTimes(1);
        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/async-name-id',
          expect.anything(),
        );
        expect(result.id).toBe('async-name-id');
      });

      it('falls back to the API list() to resolve a static tool by its resolved name, then serves from cache on the next call', async () => {
        (apiClient.get as jest.Mock).mockImplementation((url: string) => {
          if (url === '/v1/observation-tools/mobile/tools') {
            return Promise.resolve({
              data: [{id: 'fresh-static-id', name: 'Fresh Static Name'}],
            });
          }
          return Promise.resolve({
            data: {id: 'fresh-static-id', name: 'Fresh Static Name'},
          });
        });

        const first = await observationToolApi.get('fresh-static-key');
        expect(first.id).toBe('fresh-static-id');
        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools',
          expect.anything(),
        );

        (apiClient.get as jest.Mock).mockClear();
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {id: 'fresh-static-id', name: 'Fresh Static Name'},
        });

        const second = await observationToolApi.get('fresh-static-key');
        expect(second.id).toBe('fresh-static-id');
        // Second call resolves straight from the static-name cache, no listing.
        expect(apiClient.get).toHaveBeenCalledTimes(1);
        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/fresh-static-id',
          expect.anything(),
        );
      });

      it('falls back to the raw toolId when resolving via the API list() call throws', async () => {
        (apiClient.get as jest.Mock).mockImplementation((url: string) => {
          if (url === '/v1/observation-tools/mobile/tools') {
            return Promise.reject(new Error('list failed'));
          }
          return Promise.resolve({
            data: {id: 'raw-unresolved-id', name: 'Whatever'},
          });
        });

        const result = await observationToolApi.get('raw-unresolved-id');

        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/raw-unresolved-id',
          expect.anything(),
        );
        expect(result.id).toBe('raw-unresolved-id');
      });

      it('falls back to the resolvedId when the fetched tool has no _id or id', async () => {
        const mongoId = '507f191e810c19729de860eb';
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {name: 'No Id Tool'},
        });

        const result = await observationToolApi.get(mongoId);
        expect(result.id).toBe(mongoId);
      });

      it('resolves an empty toolId to itself without any lookup', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {name: 'Empty Id Tool'},
        });

        const result = await observationToolApi.get('');
        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/',
          expect.anything(),
        );
        expect(result.id).toBe('');
      });
    });

    describe('tool id resolution on submit', () => {
      it('submits straight to a mongo id without resolving', async () => {
        const mongoId = '507f1f77bcf86cd799439011';
        (apiClient.post as jest.Mock).mockResolvedValue({data: {id: 's1'}});

        await observationToolApi.submit({
          toolId: mongoId,
          companionId: 'comp-1',
          answers: {},
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          `/v1/observation-tools/mobile/tools/${mongoId}/submissions`,
          expect.anything(),
          expect.anything(),
        );
        expect(apiClient.get).not.toHaveBeenCalled();
      });

      it('resolves a cached tool id before submitting', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{id: 'resolve-cache-id', name: 'Resolve Cache Tool'}],
        });
        await observationToolApi.list();
        (apiClient.get as jest.Mock).mockClear();
        (apiClient.post as jest.Mock).mockResolvedValue({data: {id: 's1'}});

        await observationToolApi.submit({
          toolId: 'resolve-cache-id',
          companionId: 'comp-1',
          answers: {},
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/resolve-cache-id/submissions',
          expect.anything(),
          expect.anything(),
        );
        expect(apiClient.get).not.toHaveBeenCalled();
      });

      it('resolves a cached tool name to its id before submitting', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{id: 'by-name-id', name: 'Named Lookup Tool'}],
        });
        await observationToolApi.list();
        (apiClient.get as jest.Mock).mockClear();
        (apiClient.post as jest.Mock).mockResolvedValue({data: {id: 's1'}});

        await observationToolApi.submit({
          toolId: 'Named Lookup Tool',
          companionId: 'comp-1',
          answers: {},
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/by-name-id/submissions',
          expect.anything(),
          expect.anything(),
        );
      });

      it('maps a static tool key onto a cached remote id before submitting', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{id: 'isolated-remote-id', name: 'Isolated Static Tool'}],
        });
        await observationToolApi.list();
        (apiClient.get as jest.Mock).mockClear();
        (apiClient.post as jest.Mock).mockResolvedValue({data: {id: 's1'}});

        await observationToolApi.submit({
          toolId: 'isolated-static-key',
          companionId: 'comp-1',
          answers: {},
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/isolated-remote-id/submissions',
          expect.anything(),
          expect.anything(),
        );
      });

      it('resolves an uncached tool name against the remote list', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{id: 'remote-listed-id', name: 'Remote Listed Tool'}],
        });
        (apiClient.post as jest.Mock).mockResolvedValue({data: {id: 's1'}});

        await observationToolApi.submit({
          toolId: 'Remote Listed Tool',
          companionId: 'comp-1',
          answers: {},
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/remote-listed-id/submissions',
          expect.anything(),
          expect.anything(),
        );
      });

      it('resolves an uncached static key against the remote list by its static name', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: [{id: 'remote-static-id', name: 'Remote Static Name'}],
        });
        (apiClient.post as jest.Mock).mockResolvedValue({data: {id: 's1'}});

        await observationToolApi.submit({
          toolId: 'remote-static-key',
          companionId: 'comp-1',
          answers: {},
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/remote-static-id/submissions',
          expect.anything(),
          expect.anything(),
        );
      });

      it('passes an empty tool id through untouched', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({data: {id: 's1'}});

        await observationToolApi.submit({
          toolId: '',
          companionId: 'comp-1',
          answers: {},
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools//submissions',
          expect.anything(),
          expect.anything(),
        );
        expect(apiClient.get).not.toHaveBeenCalled();
      });

      it('falls back to the raw tool id when the lookup list request fails', async () => {
        (apiClient.get as jest.Mock).mockRejectedValue(new Error('offline'));
        (apiClient.post as jest.Mock).mockResolvedValue({data: {id: 's1'}});

        await observationToolApi.submit({
          toolId: 'never-seen-tool',
          companionId: 'comp-1',
          answers: {},
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/never-seen-tool/submissions',
          expect.anything(),
          expect.anything(),
        );
      });
    });

    describe('submit', () => {
      it('posts submission payload', async () => {
        const submissionResponse = {
          _id: 'sub-1',
          toolId: 'tool-1',
          score: 10,
        };
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: submissionResponse,
        });

        const result = await observationToolApi.submit({
          toolId: 'tool-1',
          companionId: 'comp-1',
          taskId: 'task-1',
          answers: {q1: 'yes'},
          summary: 'Good',
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tools/tool-1/submissions',
          expect.objectContaining({
            companionId: 'comp-1',
            taskId: 'task-1',
            answers: {q1: 'yes'},
            summary: 'Good',
          }),
          expect.anything(),
        );

        expect(result.id).toBe('sub-1');
        expect(result.score).toBe(10);
      });

      it('falls back to id/resolvedId/companionId/empty filledBy when the response payload is minimal', async () => {
        (getFreshStoredTokens as jest.Mock).mockResolvedValue({
          accessToken: mockAccessToken,
          expiresAt: Date.now() + 10000,
        });
        (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

        const result = await observationToolApi.submit({
          toolId: 'minimal-tool-id',
          companionId: 'comp-1',
          answers: {},
        });

        expect(result.toolId).toBe('minimal-tool-id');
        expect(result.companionId).toBe('comp-1');
        expect(result.filledBy).toBe('');
      });
    });

    describe('linkSubmissionToAppointment', () => {
      it('links submission and returns updated object', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({
          data: {id: 'sub-1', evaluationAppointmentId: 'appt-1'},
        });

        const result = await observationToolApi.linkSubmissionToAppointment({
          submissionId: 'sub-1',
          appointmentId: 'appt-1',
        });

        expect(apiClient.post).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/submissions/sub-1/link-appointment',
          {appointmentId: 'appt-1'},
          expect.anything(),
        );
        expect(result.evaluationAppointmentId).toBe('appt-1');
      });

      it('falls back to submissionId/appointmentId/empty filledBy when the response payload is minimal', async () => {
        (getFreshStoredTokens as jest.Mock).mockResolvedValue({
          accessToken: mockAccessToken,
          expiresAt: Date.now() + 10000,
        });
        (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

        const result = await observationToolApi.linkSubmissionToAppointment({
          submissionId: 'sub-minimal',
          appointmentId: 'appt-minimal',
        });

        expect(result.id).toBe('sub-minimal');
        expect(result.evaluationAppointmentId).toBe('appt-minimal');
        expect(result.filledBy).toBe('');
      });
    });

    describe('backend route surface', () => {
      // The backend only exposes these five mobile routes under
      // /v1/observation-tools (see apps/backend/src/routers/observationTool.routes.ts);
      // every other prefix there is /pms and rejects a mobile session.
      it('exposes no method targeting a route the backend does not define', () => {
        expect(observationToolApi).not.toHaveProperty('getSubmission');
        expect(observationToolApi).not.toHaveProperty(
          'listAppointmentSubmissions',
        );
      });
    });

    describe('previewTaskSubmission', () => {
      it('fetches preview of task submission', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {submissionId: 'sub-preview', answersPreview: {q: 1}},
        });

        const result =
          await observationToolApi.previewTaskSubmission('task-preview');
        expect(apiClient.get).toHaveBeenCalledWith(
          '/v1/observation-tools/mobile/tasks/task-preview/preview',
          expect.anything(),
        );
        expect(result.id).toBe('sub-preview');
        expect(result.taskId).toBe('task-preview');
      });

      it('falls back to empty id/filledBy and the answers field when the response payload is minimal', async () => {
        (getFreshStoredTokens as jest.Mock).mockResolvedValue({
          accessToken: mockAccessToken,
          expiresAt: Date.now() + 10000,
        });
        (apiClient.get as jest.Mock).mockResolvedValue({
          data: {answers: {q: 2}},
        });

        const result =
          await observationToolApi.previewTaskSubmission('task-minimal');
        expect(result.id).toBe('');
        expect(result.filledBy).toBe('');
        expect(result.answers).toEqual({q: 2});
      });

      it('defaults answers to an empty object when the payload has neither answersPreview nor answers', async () => {
        (getFreshStoredTokens as jest.Mock).mockResolvedValue({
          accessToken: mockAccessToken,
          expiresAt: Date.now() + 10000,
        });
        (apiClient.get as jest.Mock).mockResolvedValue({data: {}});

        const result =
          await observationToolApi.previewTaskSubmission('task-no-answers');
        expect(result.answers).toEqual({});
      });
    });
  });
});
