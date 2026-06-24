import { postData } from '@/app/services/axios';
import { catalogApi } from '@/app/features/organization/services/catalogApiService';
import type { ServiceRevamp } from '@/app/features/organization/types/revamp';
import type { HealthcareService } from '@yosemite-crew/fhir';
import type { AxiosResponse } from 'axios';

jest.mock('@/app/services/axios', () => ({
  deleteData: jest.fn(),
  getData: jest.fn(),
  patchData: jest.fn(),
  postData: jest.fn(),
  putData: jest.fn(),
}));

const mockPostData = postData as jest.MockedFunction<typeof postData>;

const BOOKABLE_EXTENSION_URLS = new Set([
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-duration-minutes',
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-outpatient',
  'https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-inpatient',
]);

const baseServiceDraft = {
  name: 'CBC Panel',
  description: 'Complete blood count',
  type: 'LAB',
  specialityId: 'spec-1',
  organisationId: 'org-1',
  grossAmount: 25,
  currency: 'USD',
  defaultDiscount: 0,
  maxDiscount: 100,
  durationMinutes: 30,
  status: 'ACTIVE',
} satisfies Omit<
  ServiceRevamp,
  'id' | 'code' | 'createdAt' | 'isBookable' | 'isInpatientPreferred'
>;

const postedHealthcareService = (): HealthcareService =>
  mockPostData.mock.calls[0][1] as HealthcareService;

describe('catalogApiService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockPostData.mockImplementation(
      async (_url, payload) =>
        ({
          data: payload as HealthcareService,
          status: 200,
          statusText: 'OK',
          headers: {},
          config: {},
        }) as AxiosResponse<HealthcareService>
    );
  });

  describe('createService', () => {
    it('omits bookable extensions for non-bookable lab services', async () => {
      await catalogApi.createService({
        ...baseServiceDraft,
        isBookable: false,
        isInpatientPreferred: false,
      });

      expect(mockPostData).toHaveBeenCalledWith(
        '/fhir/v1/healthcare-service',
        expect.objectContaining({ resourceType: 'HealthcareService' })
      );
      expect(
        postedHealthcareService().extension?.some((extension) =>
          BOOKABLE_EXTENSION_URLS.has(extension.url)
        )
      ).toBe(false);
    });

    it('includes bookable extensions when at least one appointment mode is supported', async () => {
      await catalogApi.createService({
        ...baseServiceDraft,
        isBookable: true,
        isInpatientPreferred: false,
      });

      expect(postedHealthcareService().extension).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            url: 'https://yosemitecrew.com/fhir/StructureDefinition/catalog-duration-minutes',
            valueInteger: 30,
          }),
          expect.objectContaining({
            url: 'https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-outpatient',
            valueBoolean: true,
          }),
          expect.objectContaining({
            url: 'https://yosemitecrew.com/fhir/StructureDefinition/catalog-supports-inpatient',
            valueBoolean: false,
          }),
        ])
      );
    });
  });
});
