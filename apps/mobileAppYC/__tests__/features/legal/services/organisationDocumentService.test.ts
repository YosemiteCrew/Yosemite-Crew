import organisationDocumentService from '../../../../src/features/legal/services/organisationDocumentService';
import apiClient, {withAuthHeaders} from '../../../../src/shared/services/apiClient';
import {ensureAccessContext, toErrorMessage} from '../../../../src/shared/utils/serviceHelpers';

// --- Mocks ---

jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
  },
  withAuthHeaders: jest.fn().mockReturnValue({Authorization: 'Bearer mock-token'}),
}));

jest.mock('@/shared/utils/serviceHelpers', () => ({
  ensureAccessContext: jest.fn(),
  // Fix: Rename 'err' to '_err' to bypass handle-callback-err lint rule
  toErrorMessage: jest.fn((_err, defaultMsg) => defaultMsg || 'Mock Error'),
}));

describe('organisationDocumentService', () => {
  const mockAccessToken = 'mock-access-token';
  const mockOrgId = 'org-123';
  const mockCategory = 'TERMS_AND_CONDITIONS';

  beforeEach(() => {
    jest.clearAllMocks();
    (ensureAccessContext as jest.Mock).mockResolvedValue({accessToken: mockAccessToken});
  });

  // --- 1. Validation & Setup ---

  it('throws an error if organisationId is missing', async () => {
    await expect(
      organisationDocumentService.fetchDocuments({
        organisationId: '',
        category: mockCategory,
      }),
    ).rejects.toThrow('Missing organisation identifier');
  });

  it('ensures access context before making a request', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({data: []});

    await organisationDocumentService.fetchDocuments({
      organisationId: mockOrgId,
      category: mockCategory,
    });

    expect(ensureAccessContext).toHaveBeenCalled();
  });

  // --- 2. API Call Structure ---

  it('calls the API with correct URL and headers', async () => {
    (apiClient.get as jest.Mock).mockResolvedValue({data: []});

    await organisationDocumentService.fetchDocuments({
      organisationId: mockOrgId,
      category: mockCategory,
    });

    const expectedUrl = `/v1/organisation-document/mobile/${encodeURIComponent(mockOrgId)}/documents?category=${encodeURIComponent(mockCategory)}`;

    expect(withAuthHeaders).toHaveBeenCalledWith(mockAccessToken);
    expect(apiClient.get).toHaveBeenCalledWith(expectedUrl, {
      headers: {Authorization: 'Bearer mock-token'},
    });
  });

  // --- 3. Data Mapping (mapDocument) - Covering all branches ---

  it('maps diverse raw data structures correctly (Case 1: Standard fields)', async () => {
    const rawData = [
      {
        id: 'doc-1',
        organisationId: 'org-1',
        title: 'Doc 1',
        description: 'Desc 1',
        category: 'PRIVACY_POLICY',
        fileSize: 1024,
        visibility: 'PUBLIC',
        version: 1,
        createdAt: '2023-01-01',
        updatedAt: '2023-01-02',
      },
    ];
    (apiClient.get as jest.Mock).mockResolvedValue({data: rawData});

    const result = await organisationDocumentService.fetchDocuments({
      organisationId: mockOrgId,
      category: 'PRIVACY_POLICY',
    });

    expect(result[0]).toEqual({
      id: 'doc-1',
      organisationId: 'org-1',
      title: 'Doc 1',
      description: 'Desc 1',
      category: 'PRIVACY_POLICY',
      fileSize: 1024,
      visibility: 'PUBLIC',
      version: 1,
      createdAt: '2023-01-01',
      updatedAt: '2023-01-02',
    });
  });

  it('maps diverse raw data structures correctly (Case 2: Fallback fields & _id)', async () => {
    // This object uses alternate property names handled by mapDocument (e.g. _id, details, organisation_id)
    const rawData = [
      {
        _id: 'mongo-id-123',
        organisation_id: 'org-2',
        details: 'Details text', // fallback for description
        // Missing title, fileSize, etc. to test defaults
      },
    ];
    (apiClient.get as jest.Mock).mockResolvedValue({data: {data: rawData}}); // Test nested data.data response structure

    const result = await organisationDocumentService.fetchDocuments({
      organisationId: mockOrgId,
      category: mockCategory,
    });

    expect(result[0]).toEqual({
      id: 'mongo-id-123',
      organisationId: 'org-2',
      title: 'Document', // default
      description: 'Details text',
      category: 'TERMS_AND_CONDITIONS', // default/invalid category fallback
      fileSize: null,
      visibility: null,
      version: null,
      createdAt: null,
      updatedAt: null,
    });
  });

  it('maps diverse raw data structures correctly (Case 3: documentId & ID generation)', async () => {
    const rawData = [
      {
        documentId: 'doc-id-xyz',
        category: 'CANCELLATION_POLICY',
        visibility: 'INTERNAL',
      },
      {
        // No ID fields at all -> should fallback to generated ID
        category: 'PRIVACY_POLICY',
        organisationId: 'org-99',
      }
    ];
    (apiClient.get as jest.Mock).mockResolvedValue({data: rawData});

    const result = await organisationDocumentService.fetchDocuments({
      organisationId: mockOrgId,
      category: mockCategory,
    });

    // Check item 1
    expect(result[0].id).toBe('doc-id-xyz');
    expect(result[0].category).toBe('CANCELLATION_POLICY');
    expect(result[0].visibility).toBe('INTERNAL');

    // Check item 2 (generated ID branch)
    expect(result[1].id).toBe('PRIVACY_POLICY-org-99');
  });

  it('handles invalid category and visibility values by falling back', async () => {
    const rawData = [
      {
        category: 'INVALID_CAT', // Should fallback to TERMS_AND_CONDITIONS
        visibility: 'HIDDEN',    // Should fallback to null
      },
    ];
    (apiClient.get as jest.Mock).mockResolvedValue({data: rawData});

    const result = await organisationDocumentService.fetchDocuments({
      organisationId: mockOrgId,
      category: mockCategory,
    });

    expect(result[0].category).toBe('TERMS_AND_CONDITIONS');
    expect(result[0].visibility).toBeNull();
  });

  it('handles completely null/undefined raw items gracefully', async () => {
    // Pass an array with a null item to test optional chaining in mapDocument (raw?._id)
    (apiClient.get as jest.Mock).mockResolvedValue({data: [null]});

    const result = await organisationDocumentService.fetchDocuments({
        organisationId: mockOrgId,
        category: mockCategory,
    });

    // It should map to a default object without crashing
    expect(result[0]).toEqual(expect.objectContaining({
        title: 'Document',
        id: 'doc-', // generated from undefined category + undefined orgId
    }));
  });

  // --- 4. Response Handling Edge Cases ---

  it('handles missing data payload in response', async () => {
    // API returns null data
    (apiClient.get as jest.Mock).mockResolvedValue({data: null});

    const result = await organisationDocumentService.fetchDocuments({
      organisationId: mockOrgId,
      category: mockCategory,
    });

    expect(result).toEqual([]);
  });

  it('handles non-array payload', async () => {
     // API returns object instead of array
     (apiClient.get as jest.Mock).mockResolvedValue({data: {some: 'object'}});

     const result = await organisationDocumentService.fetchDocuments({
       organisationId: mockOrgId,
       category: mockCategory,
     });

     expect(result).toEqual([]);
  });

  // --- 5. Error Handling ---

  it('catches API errors and rethrows with formatted message', async () => {
    const apiError = new Error('Network Fail');
    (apiClient.get as jest.Mock).mockRejectedValue(apiError);
    (toErrorMessage as jest.Mock).mockReturnValue('Unable to load documents');

    await expect(
      organisationDocumentService.fetchDocuments({
        organisationId: mockOrgId,
        category: mockCategory,
      }),
    ).rejects.toThrow('Unable to load documents');

    expect(toErrorMessage).toHaveBeenCalledWith(apiError, 'Unable to load documents');
  });
});