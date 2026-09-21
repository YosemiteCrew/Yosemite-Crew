import {
  resolveClinicalTermSpecies,
  suggestClinicalTerms,
} from '@/app/features/appointments/services/clinicalTermsService';

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

  it('sends the species filter when one is given', async () => {
    getDataMock.mockResolvedValueOnce({ data: { items: [] } });
    await suggestClinicalTerms({ q: 'abscess', domain: 'Diagnosis', species: 'SA' });
    expect(getDataMock).toHaveBeenCalledWith(
      '/v1/codes/terms/suggest?q=abscess&domain=Diagnosis&species=SA'
    );
  });

  /* An absent species must leave the key off entirely rather than send an empty
     value: the endpoint rejects a species it cannot parse, and a request that
     404s is a picker that shows nothing. */
  it('omits the species key entirely when none is given', async () => {
    getDataMock.mockResolvedValueOnce({ data: { items: [] } });
    await suggestClinicalTerms({ q: 'abscess', species: undefined });
    expect(getDataMock).toHaveBeenCalledWith('/v1/codes/terms/suggest?q=abscess');
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

describe('resolveClinicalTermSpecies', () => {
  /* The guide's mapping (docs/plans/clinical-terms-soap-frontend-guide.md, "Species
     resolution"): dog and cat are small animals, horse is equine, and anything else
     sends no filter rather than guessing a bucket. */
  it.each([
    ['dog', 'SA'],
    ['cat', 'SA'],
    ['horse', 'EQUINE'],
  ])('maps %s to %s', (companion, expected) => {
    expect(resolveClinicalTermSpecies(companion)).toBe(expected);
  });

  it('is case- and space-insensitive, because the workspace carries both spellings', () => {
    expect(resolveClinicalTermSpecies('Dog')).toBe('SA');
    expect(resolveClinicalTermSpecies('  HORSE ')).toBe('EQUINE');
  });

  /* A wrong bucket hides terms silently; no bucket only leaves the list as wide as
     it already is. So every unmapped species must resolve to undefined. */
  it.each([['rabbit'], ['other'], [''], [undefined], [null]])(
    'resolves %p to no filter',
    (companion) => {
      expect(resolveClinicalTermSpecies(companion as string | undefined)).toBeUndefined();
    }
  );
});
