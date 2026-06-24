jest.mock('@/app/features/organization/services/catalogApiService', () => ({
  catalogApi: {
    listSpecialities: jest.fn(),
    listServices: jest.fn(),
    listPackages: jest.fn(),
    createSpeciality: jest.fn(),
    updateSpeciality: jest.fn(),
    deleteSpeciality: jest.fn(),
    createService: jest.fn(),
    updateService: jest.fn(),
    archiveService: jest.fn(),
    restoreService: jest.fn(),
    deleteService: jest.fn(),
    createPackage: jest.fn(),
    updatePackage: jest.fn(),
    archivePackage: jest.fn(),
    restorePackage: jest.fn(),
    deletePackage: jest.fn(),
    getPackageDetail: jest.fn(),
  },
}));

import { catalogApi } from '@/app/features/organization/services/catalogApiService';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';

const mockCatalogApi = catalogApi as jest.Mocked<typeof catalogApi>;

const getStore = () => useRevampCatalogStore.getState();

const reset = () => {
  useRevampCatalogStore.setState({
    specialities: [],
    services: [],
    packages: [],
    status: 'idle',
    error: undefined,
  });
  jest.clearAllMocks();
};

const speciality = {
  id: 'spec-1',
  name: 'Cardiology',
  organisationId: 'org-1',
  teamMemberIds: [],
};

const service = {
  id: 'svc-1',
  code: 'CS-0001',
  name: 'Consult',
  description: '',
  type: 'CONSULTATION' as const,
  specialityId: 'spec-1',
  organisationId: 'org-1',
  grossAmount: 100,
  defaultDiscount: 0,
  maxDiscount: 10,
  durationMinutes: 30,
  isBookable: true,
  isInpatientPreferred: false,
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00Z',
};

const pkg = {
  id: 'pkg-1',
  code: 'PK-0001',
  name: 'Bundle',
  description: '',
  specialityId: 'spec-1',
  organisationId: 'org-1',
  durationText: 'Approx. 30 mins',
  isBookable: true,
  isInpatientPreferred: false,
  leadCount: 1,
  supportCount: 0,
  additionalDiscount: 0,
  breakdown: [],
  status: 'ACTIVE' as const,
  createdAt: '2026-01-01T00:00:00Z',
};

const packageBreakdown = [
  {
    id: 'breakdown-1',
    childItemId: 'svc-1',
    code: 'CS-0001',
    type: 'CONSULTATION' as const,
    name: 'Consult',
    unitPrice: 100,
    quantity: 1,
    discount: 0,
    maxDiscount: 10,
    isBookable: true,
    isInpatientPreferred: false,
  },
];

describe('revampCatalogStore', () => {
  beforeEach(reset);

  it('loads organisation specialities without eagerly fetching every catalog', async () => {
    mockCatalogApi.listSpecialities.mockResolvedValue([speciality]);
    mockCatalogApi.listServices.mockResolvedValue([service]);
    mockCatalogApi.listPackages.mockResolvedValue([pkg]);

    await getStore().loadOrganisationCatalog('org-1', { force: true });

    // Specialities load up front; services/packages are loaded lazily per speciality
    // to avoid a request flood (and 429s) on organisations with many specialities.
    expect(getStore().specialities).toEqual([speciality]);
    expect(mockCatalogApi.listServices).not.toHaveBeenCalled();
    expect(mockCatalogApi.listPackages).not.toHaveBeenCalled();
    expect(getStore().status).toBe('ready');
  });

  it('lazily loads a speciality catalog and dedupes repeat loads', async () => {
    mockCatalogApi.listServices.mockResolvedValue([service]);
    mockCatalogApi.listPackages.mockResolvedValue([pkg]);

    await getStore().loadSpecialityCatalog('org-1', 'spec-1');
    expect(getStore().services).toEqual([service]);
    expect(getStore().packages).toEqual([pkg]);

    // A second load for the same speciality must not refetch.
    await getStore().loadSpecialityCatalog('org-1', 'spec-1');
    expect(mockCatalogApi.listServices).toHaveBeenCalledTimes(1);
    expect(mockCatalogApi.listPackages).toHaveBeenCalledTimes(1);
  });

  it('creates, renames, and deletes a speciality through the API', async () => {
    mockCatalogApi.createSpeciality.mockResolvedValue(speciality);
    mockCatalogApi.updateSpeciality.mockResolvedValue({ ...speciality, name: 'Cardio' });
    mockCatalogApi.deleteSpeciality.mockResolvedValue(undefined);

    await getStore().addSpeciality('Cardiology', 'org-1');
    expect(getStore().specialities[0].name).toBe('Cardiology');

    await getStore().renameSpeciality('spec-1', 'Cardio');
    expect(getStore().specialities[0].name).toBe('Cardio');

    await getStore().deleteSpeciality('spec-1');
    expect(getStore().specialities).toHaveLength(0);
  });

  it('creates, updates, archives, restores, and deletes a service through the API', async () => {
    mockCatalogApi.createService.mockResolvedValue(service);
    mockCatalogApi.updateService.mockResolvedValue({ ...service, name: 'Updated' });
    mockCatalogApi.archiveService.mockResolvedValue(undefined);
    mockCatalogApi.restoreService.mockResolvedValue(undefined);
    mockCatalogApi.deleteService.mockResolvedValue(undefined);

    await getStore().addService(service);
    await getStore().updateService('svc-1', { name: 'Updated' });
    expect(getStore().services[0].name).toBe('Updated');

    await getStore().archiveService('svc-1');
    expect(getStore().services[0].status).toBe('ARCHIVED');
    await getStore().restoreService('svc-1');
    expect(getStore().services[0].status).toBe('ACTIVE');
    await getStore().deleteService('svc-1');
    expect(getStore().services).toHaveLength(0);
  });

  it('creates, updates, archives, restores, and deletes a package through the API', async () => {
    mockCatalogApi.createPackage.mockResolvedValue(pkg);
    mockCatalogApi.updatePackage.mockResolvedValue({ ...pkg, name: 'Updated' });
    mockCatalogApi.archivePackage.mockResolvedValue(undefined);
    mockCatalogApi.restorePackage.mockResolvedValue(undefined);
    mockCatalogApi.deletePackage.mockResolvedValue(undefined);

    await getStore().addPackage(pkg);
    await getStore().updatePackage('pkg-1', { name: 'Updated' });
    expect(getStore().packages[0].name).toBe('Updated');

    await getStore().archivePackage('pkg-1');
    expect(getStore().packages[0].status).toBe('ARCHIVED');
    await getStore().restorePackage('pkg-1');
    expect(getStore().packages[0].status).toBe('ACTIVE');
    await getStore().deletePackage('pkg-1');
    expect(getStore().packages).toHaveLength(0);
  });

  it('preserves submitted package breakdown after create and update responses', async () => {
    mockCatalogApi.createPackage.mockResolvedValue(pkg);
    mockCatalogApi.updatePackage.mockResolvedValue({ ...pkg, name: 'Updated', breakdown: [] });

    const created = await getStore().addPackage({ ...pkg, breakdown: packageBreakdown });
    expect(created.breakdown).toEqual(packageBreakdown);
    expect(getStore().packages[0].breakdown).toEqual(packageBreakdown);

    await getStore().updatePackage('pkg-1', {
      name: 'Updated',
      breakdown: [{ ...packageBreakdown[0], quantity: 2 }],
    });

    expect(getStore().packages[0]).toMatchObject({
      name: 'Updated',
      breakdown: [{ quantity: 2 }],
    });
  });

  it('keeps local breakdown helper actions synchronous', async () => {
    mockCatalogApi.createPackage.mockResolvedValue(pkg);
    await getStore().addPackage(pkg);
    getStore().addBreakdownItem('pkg-1', {
      type: 'CONSULTATION',
      name: 'Consult',
      unitPrice: 100,
      quantity: 1,
      discount: 10,
    });
    const itemId = getStore().packages[0].breakdown[0].id;
    getStore().updateBreakdownItem('pkg-1', itemId, { quantity: 2 });
    expect(getStore().packages[0].breakdown[0].quantity).toBe(2);
    getStore().removeBreakdownItem('pkg-1', itemId);
    expect(getStore().packages[0].breakdown).toHaveLength(0);
  });
});
