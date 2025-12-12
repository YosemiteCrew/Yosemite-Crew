import {adverseEventService} from '@/features/adverseEventReporting/services/adverseEventService';
import apiClient from '@/shared/services/apiClient';
import {ensureAccessContext, toErrorMessage} from '@/shared/utils/serviceHelpers';
import {documentApi} from '@/features/documents/services/documentService';

// --- Mocks ---
jest.mock('@/shared/services/apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
    get: jest.fn(),
  },
  withAuthHeaders: jest.fn().mockReturnValue({Authorization: 'Bearer mock-token'}),
}));

jest.mock('@/shared/utils/serviceHelpers', () => ({
  ensureAccessContext: jest.fn(),
  toErrorMessage: jest.fn(),
}));

jest.mock('@/features/documents/services/documentService', () => ({
  documentApi: {
    uploadAttachment: jest.fn(),
  },
}));

jest.mock('@/shared/utils/commonHelpers', () => ({
  capitalize: jest.fn((str) => (str ? str.charAt(0).toUpperCase() + str.slice(1) : '')),
}));

// --- Test Data & Setup ---
describe('adverseEventService', () => {
  const mockAccessToken = 'mock-access-token';

  const mockUser = {
    id: 'user-123',
    firstName: 'John',
    lastName: 'Doe',
    phone: '555-5555',
    email: 'john@example.com',
    dateOfBirth: '1990-01-01',
    address: {
      addressLine: '123 Main St',
      city: 'New York',
      stateProvince: 'NY',
      postalCode: '10001',
      country: 'USA',
    },
    currency: 'USD',
  };

  const mockCompanion = {
    id: 'comp-123',
    name: 'Buddy',
    breed: {breedName: 'Golden Retriever'},
    dateOfBirth: '2020-01-01',
    gender: 'male',
    currentWeight: 30.5,
    color: 'Gold',
    neuteredStatus: 'neutered',
    insuredStatus: 'insured',
  };

  const mockFileReady = {
    id: 'file-1',
    downloadUrl: 'http://existing.url/file.jpg',
    status: 'ready',
  };

  const mockFileLocal = {
    id: 'file-2',
    uri: 'file://local/path.jpg',
    status: 'ready',
    // No downloadUrl/viewUrl/s3Url initially
  };

  const mockProduct = {
    productName: 'FleaKill',
    brandName: 'BrandX',
    manufacturingCountry: {name: 'USA'},
    batchNumber: 'BATCH-001',
    frequencyUsed: '1',
    quantityUsed: '10',
    quantityUnit: 'liquid',
    administrationMethod: 'on the skin',
    reasonToUseProduct: 'Fleas',
    petConditionBefore: 'Itchy',
    petConditionAfter: 'Better',
    eventDate: new Date('2023-10-25T10:00:00.000Z'), // formatDate => 2023-10-25
    files: [mockFileReady],
  };

  const baseParams: any = {
    organisationId: 'org-123',
    reporterType: 'owner', // maps to PARENT
    reporter: mockUser,
    companion: mockCompanion,
    product: mockProduct,
    destinations: {regulatory: true},
    consentToContact: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (ensureAccessContext as jest.Mock).mockResolvedValue({accessToken: mockAccessToken});
    (toErrorMessage as jest.Mock).mockImplementation((_err, defaultMsg) => defaultMsg);
    (documentApi.uploadAttachment as jest.Mock).mockResolvedValue({
      ...mockFileLocal,
      downloadUrl: 'http://uploaded.url/file.jpg',
    });
  });

  describe('submitReport', () => {
    // --- Validation Tests ---
    it('throws error if organisationId is missing', async () => {
      const params = {...baseParams, organisationId: ''};
      await expect(adverseEventService.submitReport(params)).rejects.toThrow(
        'Select a linked hospital to continue.',
      );
    });

    it('throws error if reporter.id is missing', async () => {
      const params = {...baseParams, reporter: {}};
      await expect(adverseEventService.submitReport(params)).rejects.toThrow(
        'Missing reporter information. Please sign in again.',
      );
    });

    // --- Image Upload Logic (uploadPrimaryProductImage) ---
    it('throws error if no files provided', async () => {
      const params = {...baseParams, product: {...mockProduct, files: []}};
      await expect(adverseEventService.submitReport(params)).rejects.toThrow(
        'Please add an image of the product before submitting.',
      );
    });

    it('throws error if primary image is not ready', async () => {
      const pendingFile = {...mockFileReady, status: 'uploading'};
      const params = {...baseParams, product: {...mockProduct, files: [pendingFile]}};
      await expect(adverseEventService.submitReport(params)).rejects.toThrow(
        'Product image is still preparing. Please wait a moment and try again.',
      );
    });

    it('uses existing URL if available (skips upload)', async () => {
      (apiClient.post as jest.Mock).mockResolvedValue({data: {success: true}});

      const fileWithUrl = { ...mockFileReady, downloadUrl: 'http://existing.com' };
      const params = {...baseParams, product: {...mockProduct, files: [fileWithUrl]}};

      await adverseEventService.submitReport(params);

      expect(documentApi.uploadAttachment).not.toHaveBeenCalled();
      expect(apiClient.post).toHaveBeenCalledWith(
        '/v1/adverse-event/',
        expect.objectContaining({
          product: expect.objectContaining({productImageUrl: 'http://existing.com'}),
        }),
        expect.anything()
      );
    });

    it('uploads file if no remote URL exists and returns new URL', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({data: {success: true}});

        // Mock file logic: resolveFileUrl checks downloadUrl ?? viewUrl ?? s3Url
        const localFile = { id: 'loc', status: 'ready' }; // No URLs
        const params = {...baseParams, product: {...mockProduct, files: [localFile]}};

        // Mock success upload response
        (documentApi.uploadAttachment as jest.Mock).mockResolvedValue({
            ...localFile,
            viewUrl: 'http://new-upload.com'
        });

        await adverseEventService.submitReport(params);

        expect(documentApi.uploadAttachment).toHaveBeenCalledWith({
            file: localFile,
            companionId: mockCompanion.id,
            accessToken: mockAccessToken
        });
        expect(apiClient.post).toHaveBeenCalledWith(
            '/v1/adverse-event/',
            expect.objectContaining({
              product: expect.objectContaining({productImageUrl: 'http://new-upload.com'}),
            }),
            expect.anything()
        );
    });

    it('throws error if upload fails (returns no url)', async () => {
        const localFile = { id: 'loc', status: 'ready' };
        const params = {...baseParams, product: {...mockProduct, files: [localFile]}};

        // Mock upload returning a file object that still has no URLs
        (documentApi.uploadAttachment as jest.Mock).mockResolvedValue({
            ...localFile,
            downloadUrl: null
        });

        await expect(adverseEventService.submitReport(params)).rejects.toThrow(
            'Failed to upload the product image. Please try again.'
        );
    });

    // --- resolveFileUrl coverage ---
    it('resolveFileUrl fallback chain coverage (downloadUrl -> viewUrl -> s3Url -> null)', async () => {
        // We can test this implicitly via the upload logic or success path logic
        // 1. Test s3Url fallback
        const fileS3 = { ...mockFileReady, downloadUrl: undefined, viewUrl: undefined, s3Url: 'http://s3.url' };
        let params = {...baseParams, product: {...mockProduct, files: [fileS3]}};
        (apiClient.post as jest.Mock).mockResolvedValue({data: {}});
        await adverseEventService.submitReport(params);
        expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            product: expect.objectContaining({ productImageUrl: 'http://s3.url' })
        }), expect.anything());

        // 2. Test viewUrl fallback
        const fileView = { ...mockFileReady, downloadUrl: null, viewUrl: 'http://view.url' };
        params = {...baseParams, product: {...mockProduct, files: [fileView]}};
        await adverseEventService.submitReport(params);
        expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            product: expect.objectContaining({ productImageUrl: 'http://view.url' })
        }), expect.anything());
    });


    // --- Data Mapping Logic (Switch/Branch Coverage) ---

    // 1. mapAdministrationRoute
    const adminRoutes = [
        { key: 'by mouth', val: 'By mouth' },
        { key: 'on the skin', val: 'On skin' },
        { key: 'subcutaneous injection', val: 'Subcutaneous injection' },
        { key: 'intramuscular injection', val: 'Intramuscular injection' },
        { key: 'into the ear', val: 'Into the ear' },
        { key: 'into the eye', val: 'Into the eye' },
        { key: 'other', val: 'Other' },
        { key: 'none', val: 'None' },
        { key: 'invalid_value', val: 'None' }, // Default case
        { key: null, val: '' }, // Null check
    ];

    test.each(adminRoutes)('maps administration route "%s" to "%s"', async ({key, val}) => {
        (apiClient.post as jest.Mock).mockResolvedValue({data: {}});
        // @ts-ignore
        const params = {...baseParams, product: {...mockProduct, administrationMethod: key}};

        await adverseEventService.submitReport(params);

        expect(apiClient.post).toHaveBeenCalledWith(
            expect.any(String),
            expect.objectContaining({
                product: expect.objectContaining({ administrationRoute: val })
            }),
            expect.anything()
        );
    });

    // 2. mapDosageForm
    it('maps dosage form correctly', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

        // Case: Liquid
        await adverseEventService.submitReport({...baseParams, product: {...mockProduct, quantityUnit: 'liquid'}});
        expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            product: expect.objectContaining({ dosageForm: 'Liquid - ML' })
        }), expect.anything());

        // Case: Tablet (else)
        await adverseEventService.submitReport({...baseParams, product: {...mockProduct, quantityUnit: 'tablet'}});
        expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            product: expect.objectContaining({ dosageForm: 'Tablet - Piece' })
        }), expect.anything());
    });

    // 3. mapReporter
    it('maps reporter type GUARDIAN vs PARENT and handles optional fields', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

        // Case 1: Guardian with missing optional User fields (null coalescing coverage)
        const sparseUser = { id: 'u1', parentId: 'p1' }; // missing name, phone, address etc
        // @ts-ignore
        await adverseEventService.submitReport({...baseParams, reporter: sparseUser, reporterType: 'guardian'});

        expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            reporter: expect.objectContaining({
                type: 'GUARDIAN',
                userId: 'p1',
                firstName: '', // defaults
                addressLine: '',
                currency: 'USD' // default
            })
        }), expect.anything());

        // Case 2: Parent with Full fields
        const fullUser = { ...mockUser, parentId: null };
        await adverseEventService.submitReport({...baseParams, reporter: fullUser, reporterType: 'owner'});

        expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            reporter: expect.objectContaining({
                type: 'PARENT',
                userId: 'user-123',
                firstName: 'John',
                city: 'New York'
            })
        }), expect.anything());
    });

    // 4. mapCompanion
    it('maps companion fields correctly (Insured, Weight, Neutered)', async () => {
        (apiClient.post as jest.Mock).mockResolvedValue({data: {}});

        // Case 1: Insured, Valid Weight
        await adverseEventService.submitReport(baseParams);
        expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            companion: expect.objectContaining({
                insured: 'Yes',
                currentWeight: '30.5 kg',
                gender: expect.any(String), // Capitalize mock check
            })
        }), expect.anything());

        // Case 2: Not Insured (explicit), No weight, Missing Breed/Color (optional chaining)
        const sparseCompanion = {
            ...mockCompanion,
            insuredStatus: 'not_insured',
            currentWeight: null,
            breed: null,
            color: null
        };
        // @ts-ignore
        await adverseEventService.submitReport({...baseParams, companion: sparseCompanion});

        expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            companion: expect.objectContaining({
                insured: 'No',
                currentWeight: '',
                breed: '',
                color: ''
            })
        }), expect.anything());

        // Case 3: Insured Status missing (null)
        const nullInsuredCompanion = { ...mockCompanion, insuredStatus: null };
        // @ts-ignore
        await adverseEventService.submitReport({...baseParams, companion: nullInsuredCompanion});

        expect(apiClient.post).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({
            companion: expect.objectContaining({ insured: '' })
        }), expect.anything());
    });

    // 5. parsePositiveNumber
    it('throws error for invalid numbers', async () => {
        // Invalid frequency
        const paramsInvalidFreq = {...baseParams, product: {...mockProduct, frequencyUsed: '0'}};
        await expect(adverseEventService.submitReport(paramsInvalidFreq)).rejects.toThrow(
            'Enter a valid usage frequency before submitting.'
        );

        // NaN
        const paramsNaN = {...baseParams, product: {...mockProduct, quantityUsed: 'abc'}};
        await expect(adverseEventService.submitReport(paramsNaN)).rejects.toThrow(
            'Enter a valid quantity used before submitting.'
        );
    });

    // --- API Error Handling ---
    it('handles API errors gracefully', async () => {
        const error = new Error('API Error');
        (apiClient.post as jest.Mock).mockRejectedValue(error);
        (toErrorMessage as jest.Mock).mockReturnValue('Friendly Error');

        await expect(adverseEventService.submitReport(baseParams)).rejects.toThrow('Friendly Error');
        expect(toErrorMessage).toHaveBeenCalledWith(error, 'Failed to submit adverse event report.');
    });
  });

  describe('fetchRegulatoryAuthority', () => {
    it('fetches data with all parameters provided', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ data: { contact: '123' } });

        const result = await adverseEventService.fetchRegulatoryAuthority({
            country: 'USA',
            iso2: 'US',
            iso3: 'USA'
        });

        expect(ensureAccessContext).toHaveBeenCalled();
        expect(apiClient.get).toHaveBeenCalledWith(
            expect.stringContaining('/v1/adverse-event/regulatory-authority?country=USA&iso2=US&iso3=USA'),
            expect.objectContaining({ headers: { Authorization: 'Bearer mock-token' } })
        );
        expect(result).toEqual({ contact: '123' });
    });

    it('fetches data with missing parameters (query string construction)', async () => {
        (apiClient.get as jest.Mock).mockResolvedValue({ data: {} });

        // No params
        await adverseEventService.fetchRegulatoryAuthority({});
        // Should not have '?' if empty, or just empty params
        expect(apiClient.get).toHaveBeenCalledWith(
            '/v1/adverse-event/regulatory-authority',
            expect.anything()
        );

        // Partial params
        await adverseEventService.fetchRegulatoryAuthority({ iso2: 'GB' });
        expect(apiClient.get).toHaveBeenCalledWith(
            expect.stringContaining('iso2=GB'),
            expect.anything()
        );
    });

    it('handles API errors', async () => {
        const error = new Error('Network fail');
        (apiClient.get as jest.Mock).mockRejectedValue(error);
        (toErrorMessage as jest.Mock).mockReturnValue('Fetch Error');

        await expect(adverseEventService.fetchRegulatoryAuthority({})).rejects.toThrow('Fetch Error');
        expect(toErrorMessage).toHaveBeenCalledWith(error, 'Failed to fetch regulatory authority contact details.');
    });
  });
});