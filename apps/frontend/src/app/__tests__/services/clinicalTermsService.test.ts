import { suggestClinicalTerms } from '@/app/features/appointments/services/clinicalTermsService';

const getDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  getData: (...args: unknown[]) => getDataMock(...args),
}));

describe('suggestClinicalTerms', () => {
  beforeEach(() => getDataMock.mockReset());

  it('queries with domain and limit and returns the items', async () => {
    const items = [{ ycCode: 'YC-1', label: 'Vomiting', species: [], synonyms: [] }];
    getDataMock.mockResolvedValueOnce({ data: { items } });

    await expect(
      suggestClinicalTerms({ q: 'vom', domain: 'Diagnosis', limit: 8 })
    ).resolves.toEqual(items);
    expect(getDataMock).toHaveBeenCalledWith(
      '/v1/codes/terms/suggest?q=vom&domain=Diagnosis&limit=8'
    );
  });

  it('omits absent filters and URL-encodes the query', async () => {
    getDataMock.mockResolvedValueOnce({ data: { items: [] } });
    await suggestClinicalTerms({ q: 'anomalía' });
    expect(getDataMock).toHaveBeenCalledWith('/v1/codes/terms/suggest?q=anomal%C3%ADa');
  });

  it('returns an empty list when the payload has no items', async () => {
    getDataMock.mockResolvedValueOnce({ data: {} });
    await expect(suggestClinicalTerms({ q: 'vom' })).resolves.toEqual([]);
  });
});
