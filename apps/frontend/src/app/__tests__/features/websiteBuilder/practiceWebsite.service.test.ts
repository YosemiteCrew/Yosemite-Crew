const getDataMock = jest.fn();
const putDataMock = jest.fn();

jest.mock('@/app/services/axios', () => ({
  getData: (...args: unknown[]) => getDataMock(...args),
  putData: (...args: unknown[]) => putDataMock(...args),
}));

import {
  getPublicSite,
  practiceWebsiteApi,
  PublicSiteError,
} from '@/app/features/websiteBuilder/services/practiceWebsite.service';

const jsonResponse = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body }) as Response;

describe('practiceWebsite.service', () => {
  const realFetch = globalThis.fetch;
  const fetchMock = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    process.env.NEXT_PUBLIC_BASE_URL = 'https://api.example.test/';
  });

  afterAll(() => {
    globalThis.fetch = realFetch;
    delete process.env.NEXT_PUBLIC_BASE_URL;
  });

  it('reads and saves the config for an organisation', async () => {
    getDataMock.mockResolvedValue({ data: { data: { headline: 'Park' } } });
    putDataMock.mockResolvedValue({ data: { data: { headline: 'Saved' } } });
    const payload = {
      templateId: 'alpine-clinic' as const,
      headline: 'Park',
      tagline: null,
      about: null,
      published: false,
    };

    await expect(practiceWebsiteApi.getConfig('org-1')).resolves.toEqual({ headline: 'Park' });
    await expect(practiceWebsiteApi.saveConfig('org-1', payload)).resolves.toEqual({
      headline: 'Saved',
    });
    expect(getDataMock).toHaveBeenCalledWith('/v1/practice-website/org-1');
    expect(putDataMock).toHaveBeenCalledWith('/v1/practice-website/org-1', payload);
  });

  it('fetches a public site without the session client', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { headline: 'Park' } }));

    await expect(getPublicSite('park vets')).resolves.toEqual({
      kind: 'site',
      site: { headline: 'Park' },
    });
    expect(fetchMock).toHaveBeenCalledWith('https://api.example.test/public/site/park%20vets', {
      headers: { Accept: 'application/json' },
    });
  });

  it('turns a retired slug into a redirect', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ data: { redirectTo: 'new-vets' } }));

    await expect(getPublicSite('park-vets')).resolves.toEqual({
      kind: 'redirect',
      slug: 'new-vets',
    });
  });

  it('throws with the status when the site is not available', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ message: 'Site not found' }, 404));

    const error = await getPublicSite('park-vets').catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(PublicSiteError);
    expect(error).toMatchObject({ status: 404, message: 'This website is not available.' });
  });

  it('uses a relative URL when no API base is configured', async () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    fetchMock.mockResolvedValue(jsonResponse({ data: { headline: 'Park' } }));

    await getPublicSite('park-vets');
    expect(fetchMock).toHaveBeenCalledWith('/public/site/park-vets', expect.anything());
  });
});
