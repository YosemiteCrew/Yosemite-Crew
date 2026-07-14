import { deleteData, getData, patchData, postData, putData } from '@/app/services/axios';
import {
  catalogApi,
  parseDurationMinutes,
} from '@/app/features/organization/services/catalogApiService';
import type { PackageRevamp, ServiceRevamp } from '@/app/features/organization/types/revamp';
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
const mockGetData = getData as jest.MockedFunction<typeof getData>;
const mockPutData = putData as jest.MockedFunction<typeof putData>;
const mockPatchData = patchData as jest.MockedFunction<typeof patchData>;
const mockDeleteData = deleteData as jest.MockedFunction<typeof deleteData>;

const asResponse = <T>(data: T): AxiosResponse<T> =>
  ({
    data,
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {},
  }) as AxiosResponse<T>;

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

  describe('listSpecialities', () => {
    it('unwraps a plain array response and maps every row', async () => {
      mockGetData.mockResolvedValueOnce(
        asResponse([
          { id: 'spec-1', name: 'Cardiology', organisationId: 'org-1' },
          { _id: 'spec-2', name: 'Dermatology', organizationId: 'org-2' },
        ])
      );

      const result = await catalogApi.listSpecialities('org-1');

      expect(mockGetData).toHaveBeenCalledWith('/v1/catalog/organisations/org-1/specialities', {
        status: 'ACTIVE',
        page: 1,
        pageSize: 100,
      });
      expect(result).toEqual([
        expect.objectContaining({ id: 'spec-1', name: 'Cardiology', organisationId: 'org-1' }),
        expect.objectContaining({ id: 'spec-2', name: 'Dermatology', organisationId: 'org-2' }),
      ]);
    });

    it('unwraps an { items } response shape and falls back to organisationId/defaults', async () => {
      mockGetData.mockResolvedValueOnce(
        asResponse({ items: [{ specialityId: 'spec-3', headUserId: 'vet-1' }] })
      );

      const result = await catalogApi.listSpecialities('org-9', 'ARCHIVED');

      expect(mockGetData).toHaveBeenCalledWith('/v1/catalog/organisations/org-9/specialities', {
        status: 'ARCHIVED',
        page: 1,
        pageSize: 100,
      });
      expect(result).toEqual([
        {
          id: 'spec-3',
          name: '',
          organisationId: 'org-9',
          headVetId: 'vet-1',
          teamMemberIds: [],
          activeServiceCount: undefined,
          activePackageCount: undefined,
        },
      ]);
    });

    it('returns an empty array when neither array nor items key is present', async () => {
      mockGetData.mockResolvedValueOnce(asResponse({}));

      const result = await catalogApi.listSpecialities('org-1');

      expect(result).toEqual([]);
    });
  });

  describe('createSpeciality / updateSpeciality / deleteSpeciality', () => {
    it('creates a speciality and maps the normalized response', async () => {
      mockPostData.mockResolvedValueOnce(
        asResponse({
          _id: 'spec-new',
          name: 'Oncology',
          organisationId: 'org-1',
          isActive: true,
        })
      );

      const result = await catalogApi.createSpeciality('Oncology', 'org-1');

      expect(mockPostData).toHaveBeenCalledWith('/fhir/v1/speciality', expect.anything());
      expect(result).toMatchObject({ name: 'Oncology', organisationId: 'org-1' });
    });

    it('updates a speciality and preserves organisationId fallback', async () => {
      mockPutData.mockResolvedValueOnce(
        asResponse({ _id: 'spec-1', name: 'Renamed', isActive: true })
      );

      const result = await catalogApi.updateSpeciality({
        id: 'spec-1',
        name: 'Renamed',
        organisationId: 'org-1',
        teamMemberIds: [],
      });

      expect(mockPutData).toHaveBeenCalledWith('/fhir/v1/speciality/spec-1', expect.anything());
      expect(result.organisationId).toBe('org-1');
    });

    it('deletes a speciality by organisation and speciality id', async () => {
      mockDeleteData.mockResolvedValueOnce(asResponse(undefined));

      await catalogApi.deleteSpeciality('org-1', 'spec-1');

      expect(mockDeleteData).toHaveBeenCalledWith(
        '/v1/catalog/organisations/org-1/specialities/spec-1'
      );
    });
  });

  describe('listServices / listPackages', () => {
    it('maps a flat CatalogListRow-shaped service row using top-level fields', async () => {
      mockGetData.mockResolvedValueOnce(
        asResponse([
          {
            id: 'svc-1',
            code: 'S1',
            name: 'Consult',
            description: 'Basic',
            kind: 'CONSULTATION',
            unitPrice: 50,
            currency: 'USD',
            defaultDiscountPercent: 5,
            maxDiscountPercent: 20,
            durationMinutes: 15,
            isBookable: true,
            isActive: true,
          },
        ])
      );

      const [service] = await catalogApi.listServices('org-1', 'spec-1');

      expect(mockGetData).toHaveBeenCalledWith(
        '/v1/catalog/organisations/org-1/specialities/spec-1/services',
        { status: 'ACTIVE', search: '' }
      );
      expect(service).toMatchObject({
        id: 'svc-1',
        grossAmount: 50,
        defaultDiscount: 5,
        maxDiscount: 20,
        durationMinutes: 15,
        isBookable: true,
        isInpatientPreferred: false,
        status: 'ACTIVE',
      });
    });

    it('maps a nested product-view service row (defaultPrice/bookable objects) and archived status', async () => {
      mockGetData.mockResolvedValueOnce(
        asResponse([
          {
            id: 'svc-2',
            kind: 'DIAGNOSTIC',
            defaultPrice: { unitPrice: 80, currency: 'GBP', defaultDiscountPercent: 10 },
            bookable: { durationMinutes: 45, supportsOutpatient: true, supportsInpatient: true },
            isActive: false,
          },
        ])
      );

      const [service] = await catalogApi.listServices('org-1', 'spec-1', 'ARCHIVED');

      expect(service).toMatchObject({
        type: 'LAB',
        grossAmount: 80,
        currency: 'GBP',
        defaultDiscount: 10,
        durationMinutes: 45,
        isBookable: true,
        isInpatientPreferred: true,
        status: 'ARCHIVED',
      });
    });

    it('maps a package row using grossAmount/totalAmount price fallbacks and package sub-object', async () => {
      mockGetData.mockResolvedValueOnce(
        asResponse({
          items: [
            {
              id: 'pkg-1',
              grossAmount: 120,
              package: { leadCount: 2, supportCount: 1, additionalDiscountPercent: 15 },
              packageItems: [
                {
                  childProductItemId: 'child-1',
                  childProductName: 'Item 1',
                  grossAmount: 40,
                  quantity: 2,
                },
              ],
            },
          ],
        })
      );

      const [pkg] = await catalogApi.listPackages('org-1', 'spec-1');

      expect(mockGetData).toHaveBeenCalledWith(
        '/v1/catalog/organisations/org-1/specialities/spec-1/packages',
        { status: 'ACTIVE', search: '' }
      );
      expect(pkg).toMatchObject({
        id: 'pkg-1',
        leadCount: 2,
        supportCount: 1,
        additionalDiscount: 15,
      });
      expect(pkg.breakdown).toEqual([
        expect.objectContaining({
          childItemId: 'child-1',
          name: 'Item 1',
          unitPrice: 20,
          quantity: 2,
        }),
      ]);
    });

    it('falls back to finalAmount/quantity for breakdown unit price and defaults leadCount/supportCount', async () => {
      mockGetData.mockResolvedValueOnce(
        asResponse([
          {
            id: 'pkg-2',
            packageItems: [{ id: 'bi-1', finalAmount: 30, quantity: 3, discountPercent: 5 }],
          },
        ])
      );

      const [pkg] = await catalogApi.listPackages('org-1', 'spec-1');

      expect(pkg.leadCount).toBe(1);
      expect(pkg.supportCount).toBe(0);
      expect(pkg.breakdown[0]).toMatchObject({ id: 'bi-1', unitPrice: 10, discount: 5 });
    });
  });

  describe('getPackageDetail', () => {
    const fallbackPackage: PackageRevamp = {
      id: 'pkg-1',
      code: 'P1',
      name: 'Fallback',
      description: '',
      specialityId: 'spec-1',
      organisationId: 'org-1',
      durationText: 'Approx. 30 mins',
      isBookable: false,
      isInpatientPreferred: false,
      leadCount: 1,
      supportCount: 0,
      additionalDiscount: 0,
      breakdown: [],
      status: 'ACTIVE',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    it('maps a package detail response over the fallback package', async () => {
      mockGetData.mockResolvedValueOnce(
        asResponse({
          id: 'pkg-1',
          name: 'Full Panel',
          durationMinutes: 60,
          isBookable: true,
          leadCount: 3,
          supportCount: 2,
          additionalDiscountPercent: 10,
          items: [],
          isActive: true,
          version: 4,
        })
      );

      const result = await catalogApi.getPackageDetail(fallbackPackage);

      expect(mockGetData).toHaveBeenCalledWith('/v1/catalog/organisations/org-1/packages/pkg-1');
      expect(result).toMatchObject({
        name: 'Full Panel',
        durationText: 'Approx. 60 mins',
        isBookable: true,
        status: 'ACTIVE',
        version: 4,
      });
    });

    it('marks the package archived when detail isActive is false', async () => {
      mockGetData.mockResolvedValueOnce(
        asResponse({
          id: 'pkg-1',
          name: 'Inactive Panel',
          isBookable: false,
          leadCount: 1,
          supportCount: 0,
          additionalDiscountPercent: 0,
          items: [],
          isActive: false,
        })
      );

      const result = await catalogApi.getPackageDetail(fallbackPackage);

      expect(result.status).toBe('ARCHIVED');
    });
  });

  describe('updateService / archiveService / restoreService / deleteService', () => {
    const currentService: ServiceRevamp = {
      id: 'svc-1',
      code: 'S1',
      name: 'Consult',
      description: '',
      type: 'CONSULTATION',
      specialityId: 'spec-1',
      organisationId: 'org-1',
      grossAmount: 50,
      defaultDiscount: 0,
      maxDiscount: 100,
      durationMinutes: 30,
      isBookable: true,
      isInpatientPreferred: false,
      status: 'ACTIVE',
      createdAt: '2024-01-01T00:00:00.000Z',
    };

    it('sends an If-Match header when the merged service has a version', async () => {
      mockPatchData.mockResolvedValueOnce(
        asResponse({ id: 'svc-1', resourceType: 'HealthcareService', name: 'Consult' })
      );

      await catalogApi.updateService('svc-1', { version: 7 }, currentService);

      expect(mockPatchData).toHaveBeenCalledWith(
        '/fhir/v1/healthcare-service/svc-1',
        expect.anything(),
        { headers: { 'If-Match': '7' } }
      );
    });

    it('omits the headers argument when there is no version', async () => {
      mockPatchData.mockResolvedValueOnce(
        asResponse({ id: 'svc-1', resourceType: 'HealthcareService', name: 'Consult' })
      );

      await catalogApi.updateService('svc-1', {}, currentService);

      expect(mockPatchData).toHaveBeenCalledWith(
        '/fhir/v1/healthcare-service/svc-1',
        expect.anything(),
        undefined
      );
    });

    it('archives, restores, and deletes a service against the expected endpoints', async () => {
      mockPostData.mockResolvedValue(asResponse(undefined));
      mockDeleteData.mockResolvedValueOnce(asResponse(undefined));

      await catalogApi.archiveService(currentService);
      await catalogApi.restoreService(currentService);
      await catalogApi.deleteService(currentService);

      expect(mockPostData).toHaveBeenCalledWith(
        '/v1/catalog/organisations/org-1/services/svc-1/archive'
      );
      expect(mockPostData).toHaveBeenCalledWith(
        '/v1/catalog/organisations/org-1/services/svc-1/restore'
      );
      expect(mockDeleteData).toHaveBeenCalledWith('/v1/catalog/organisations/org-1/services/svc-1');
    });
  });

  describe('createPackage / updatePackage / archivePackage / restorePackage / deletePackage', () => {
    const draftPackage: Omit<PackageRevamp, 'id' | 'code' | 'createdAt'> = {
      name: 'Wellness Package',
      description: '',
      specialityId: 'spec-1',
      organisationId: 'org-1',
      durationText: 'Approx. 45 mins',
      isBookable: true,
      isInpatientPreferred: false,
      leadCount: 1,
      supportCount: 1,
      additionalDiscount: 10,
      breakdown: [
        {
          id: 'item-1',
          type: 'CONSULTATION',
          name: 'Checkup',
          unitPrice: 40,
          quantity: 1,
          discount: 0,
        },
      ],
      status: 'ACTIVE',
    };

    it('creates a package and maps the resulting healthcare service back to a PackageRevamp', async () => {
      mockPostData.mockResolvedValueOnce(
        asResponse({
          id: 'pkg-new',
          resourceType: 'HealthcareService',
          name: 'Wellness Package',
        })
      );

      const result = await catalogApi.createPackage(draftPackage);

      expect(mockPostData).toHaveBeenCalledWith('/fhir/v1/healthcare-service', expect.anything());
      expect(result.name).toBe('Wellness Package');
    });

    it('updates a package including an If-Match header when versioned', async () => {
      mockPatchData.mockResolvedValueOnce(
        asResponse({ id: 'pkg-1', resourceType: 'HealthcareService', name: 'Wellness Package' })
      );

      const current: PackageRevamp = {
        ...draftPackage,
        id: 'pkg-1',
        code: 'P1',
        createdAt: '2024-01-01T00:00:00.000Z',
      };

      await catalogApi.updatePackage('pkg-1', { version: 2 }, current);

      expect(mockPatchData).toHaveBeenCalledWith(
        '/fhir/v1/healthcare-service/pkg-1',
        expect.anything(),
        { headers: { 'If-Match': '2' } }
      );
    });

    it('archives, restores, and deletes a package against the expected endpoints', async () => {
      const pkg: PackageRevamp = {
        ...draftPackage,
        id: 'pkg-1',
        code: 'P1',
        createdAt: '2024-01-01T00:00:00.000Z',
      };
      mockPostData.mockResolvedValue(asResponse(undefined));
      mockDeleteData.mockResolvedValueOnce(asResponse(undefined));

      await catalogApi.archivePackage(pkg);
      await catalogApi.restorePackage(pkg);
      await catalogApi.deletePackage(pkg);

      expect(mockPostData).toHaveBeenCalledWith(
        '/v1/catalog/organisations/org-1/packages/pkg-1/archive'
      );
      expect(mockPostData).toHaveBeenCalledWith(
        '/v1/catalog/organisations/org-1/packages/pkg-1/restore'
      );
      expect(mockDeleteData).toHaveBeenCalledWith('/v1/catalog/organisations/org-1/packages/pkg-1');
    });
  });

  describe('searchItems / mapSearchItem', () => {
    it('builds FHIR Parameters with optional specialty/kinds/excludePackageId and parses the response', async () => {
      mockPostData.mockResolvedValueOnce(
        asResponse({
          resourceType: 'Parameters',
          parameter: [
            {
              name: 'items',
              part: [
                {
                  part: [
                    { name: 'id', valueString: 'item-1' },
                    { name: 'organization', valueString: 'Organization/org-1' },
                    { name: 'name', valueString: 'CBC' },
                    { name: 'kind', valueString: 'LAB' },
                  ],
                },
              ],
            },
          ],
        })
      );

      const result = await catalogApi.searchItems({
        organisationId: 'org-1',
        specialityId: 'spec-1',
        q: 'cbc',
        kinds: ['LAB'],
        excludePackageId: 'pkg-exclude',
      });

      expect(mockPostData).toHaveBeenCalledWith(
        '/fhir/v1/healthcare-service/$search-components',
        expect.objectContaining({
          resourceType: 'Parameters',
          parameter: expect.arrayContaining([
            { name: 'specialty', valueString: 'spec-1' },
            { name: 'kinds', valueString: 'LAB' },
            { name: 'excludePackageId', valueString: 'pkg-exclude' },
          ]),
        })
      );
      expect(result).toEqual([
        expect.objectContaining({
          id: 'item-1',
          organisationId: 'org-1',
          name: 'CBC',
          kind: 'LAB',
        }),
      ]);
    });

    it('omits optional specialty/kinds/excludePackageId parameters and applies defaults on missing parts', async () => {
      mockPostData.mockResolvedValueOnce(
        asResponse({
          resourceType: 'Parameters',
          parameter: [{ name: 'items', part: [{ part: [] }] }],
        })
      );

      const result = await catalogApi.searchItems({ organisationId: 'org-1', q: '' });

      const sentParams = mockPostData.mock.calls.at(-1)?.[1] as {
        parameter: { name: string }[];
      };
      expect(sentParams.parameter.some((p) => p.name === 'specialty')).toBe(false);
      expect(sentParams.parameter.some((p) => p.name === 'kinds')).toBe(false);
      expect(sentParams.parameter.some((p) => p.name === 'excludePackageId')).toBe(false);
      expect(result).toEqual([
        expect.objectContaining({
          id: '',
          organisationId: '',
          specialityId: null,
          kind: 'CONSULTATION',
          source: 'CATALOG',
          status: 'ACTIVE',
          isBookable: false,
          durationMinutes: null,
          canBeAddedToPackage: true,
        }),
      ]);
    });

    it('returns an empty array when the items parameter is missing entirely', async () => {
      mockPostData.mockResolvedValueOnce(asResponse({ resourceType: 'Parameters', parameter: [] }));

      const result = await catalogApi.searchItems({ organisationId: 'org-1', q: 'x' });

      expect(result).toEqual([]);
    });

    it('mapSearchItem maps a CatalogSearchItem to a PackageBreakdownItem, including nested breakdown', () => {
      const mapped = catalogApi.mapSearchItem({
        id: 'item-1',
        organisationId: 'org-1',
        specialityId: null,
        code: 'C1',
        name: 'CBC',
        description: null,
        kind: 'LAB_TEST',
        source: 'CATALOG',
        status: 'ACTIVE',
        isBookable: true,
        durationMinutes: 15,
        unitPrice: 25,
        currency: 'USD',
        defaultDiscountPercent: 5,
        maxDiscountPercent: 20,
        totalAmount: 25,
        canBeAddedToPackage: true,
        blockReason: null,
        nestedBreakdown: [
          {
            id: 'nested-row-1',
            type: 'LAB_TEST',
            childItemId: 'nested-1',
            childItemKind: 'LAB_TEST',
            childItemCode: null,
            name: 'Nested item',
            childItemName: 'Nested item',
            quantity: 1,
            unitPrice: 10,
            currency: null,
            grossAmount: 10,
            discountPercent: 0,
            discountAmount: 0,
            finalAmount: 10,
            pricingMode: 'INHERITED_PRICE',
            overridePrice: null,
            isOptional: false,
            sortOrder: 0,
          },
        ],
      });

      expect(mapped).toMatchObject({
        childItemId: 'item-1',
        type: 'LAB',
        name: 'CBC',
        unitPrice: 25,
        discount: 5,
        maxDiscount: 20,
        isBookable: true,
      });
      expect(mapped.nestedBreakdown).toEqual([
        expect.objectContaining({ childItemId: 'nested-1', name: 'Nested item', unitPrice: 10 }),
      ]);
    });

    it('mapSearchItem omits nestedBreakdown when the item has none', () => {
      const mapped = catalogApi.mapSearchItem({
        id: 'item-2',
        organisationId: 'org-1',
        specialityId: null,
        code: null,
        name: 'X-Ray',
        description: null,
        kind: 'PROCEDURE',
        source: 'CATALOG',
        status: 'ACTIVE',
        isBookable: false,
        durationMinutes: null,
        unitPrice: 0,
        currency: null,
        defaultDiscountPercent: 0,
        maxDiscountPercent: 0,
        totalAmount: 0,
        canBeAddedToPackage: true,
        blockReason: null,
        nestedBreakdown: null,
      });

      expect(mapped.nestedBreakdown).toBeUndefined();
    });
  });

  describe('parseDurationMinutes', () => {
    it('parses the first number found in a duration text string', () => {
      expect(parseDurationMinutes('Approx. 45 mins')).toBe(45);
    });

    it('defaults to 30 when no number is present', () => {
      expect(parseDurationMinutes('Approx. mins')).toBe(30);
    });

    it('clamps to a minimum of 1', () => {
      expect(parseDurationMinutes('Approx. 0 mins')).toBe(1);
    });
  });
});
