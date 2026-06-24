import {
  searchDocuments,
  searchInventoryItems,
  searchMedications,
  searchOrganisationScope,
  searchPackages,
  searchServices,
  searchTasks,
  searchTemplates,
} from '@/app/services/scopedSearchService';
import { getData } from '@/app/services/axios';

jest.mock('@/app/services/axios', () => ({
  getData: jest.fn(),
}));

describe('scopedSearchService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getData as jest.Mock).mockResolvedValue({ data: [{ id: 'result-1' }] });
  });

  it('calls generic scoped search endpoint', async () => {
    const result = await searchOrganisationScope('org-1', 'templates', { q: 'soap', limit: 10 });

    expect(getData).toHaveBeenCalledWith('/v1/search/organisations/org-1/templates', {
      q: 'soap',
      limit: 10,
    });
    expect(result).toEqual([{ id: 'result-1' }]);
  });

  it('exposes helpers for all handoff search scopes', async () => {
    await searchTemplates('org-1');
    await searchTasks('org-1');
    await searchDocuments('org-1');
    await searchMedications('org-1');
    await searchInventoryItems('org-1');
    await searchServices('org-1');
    await searchPackages('org-1');

    expect(getData).toHaveBeenNthCalledWith(1, '/v1/search/organisations/org-1/templates', {});
    expect(getData).toHaveBeenNthCalledWith(2, '/v1/search/organisations/org-1/tasks', {});
    expect(getData).toHaveBeenNthCalledWith(3, '/v1/search/organisations/org-1/documents', {});
    expect(getData).toHaveBeenNthCalledWith(4, '/v1/search/organisations/org-1/medications', {});
    expect(getData).toHaveBeenNthCalledWith(
      5,
      '/v1/search/organisations/org-1/inventory-items',
      {}
    );
    expect(getData).toHaveBeenNthCalledWith(6, '/v1/search/organisations/org-1/services', {});
    expect(getData).toHaveBeenNthCalledWith(7, '/v1/search/organisations/org-1/packages', {});
  });
});
