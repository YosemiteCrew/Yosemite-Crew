import {
  PublicBookingRequestError,
  confirmBookingRequest,
  getPublicPractice,
  getPublicSlots,
  submitBookingRequest,
} from '@/app/features/publicBooking/services/publicBooking.service';

const originalBaseUrl = process.env.NEXT_PUBLIC_BASE_URL;
const originalFetch = globalThis.fetch;

const jsonResponse = (body: unknown, status = 200) =>
  ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  }) as Response;

describe('publicBooking.service', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = 'https://api.example.com/';
    globalThis.fetch = jest.fn();
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_BASE_URL = originalBaseUrl;
    globalThis.fetch = originalFetch;
  });

  const fetchMock = () => globalThis.fetch as jest.Mock;

  describe('getPublicPractice', () => {
    it('returns the practice and strips the trailing slash from the base URL', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({ data: { slug: 'park-vets' } }));

      await expect(getPublicPractice('park-vets')).resolves.toEqual({
        kind: 'practice',
        practice: { slug: 'park-vets' },
      });
      expect(fetchMock().mock.calls[0][0]).toBe('https://api.example.com/public/booking/park-vets');
    });

    it('sends no credentials, so a staff session never reaches a public endpoint', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({ data: { slug: 'x' } }));

      await getPublicPractice('x');

      const init = fetchMock().mock.calls[0][1] as RequestInit;
      expect(init.credentials).toBeUndefined();
    });

    it('encodes a slug rather than interpolating it raw', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({ data: { slug: 'x' } }));

      await getPublicPractice('a/../b');

      expect(fetchMock().mock.calls[0][0]).toBe(
        'https://api.example.com/public/booking/a%2F..%2Fb'
      );
    });

    it('reports a retired slug as a redirect', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({ data: { redirectTo: 'new-name' } }));

      await expect(getPublicPractice('old-name')).resolves.toEqual({
        kind: 'redirect',
        slug: 'new-name',
      });
    });

    it('throws with the status so the page can tell 404 from anything else', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404));

      const error = await getPublicPractice('nope').catch((e) => e);
      expect(error).toBeInstanceOf(PublicBookingRequestError);
      expect(error.status).toBe(404);
      expect(error.message).toBe('Not found');
    });

    it('falls back to a readable message when the body is not JSON', async () => {
      fetchMock().mockResolvedValueOnce({
        ok: false,
        status: 500,
        json: async () => {
          throw new Error('not json');
        },
      } as unknown as Response);

      const error = await getPublicPractice('x').catch((e) => e);
      expect(error.message).toBe('This booking page is not available.');
    });

    it('falls back when the body carries a non-string message', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({ message: { nested: true } }, 400));

      const error = await getPublicPractice('x').catch((e) => e);
      expect(error.message).toBe('This booking page is not available.');
    });
  });

  describe('getPublicSlots', () => {
    it('queries by service and date', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({ data: { windows: [] } }));

      await getPublicSlots('park-vets', 'svc-1', '2026-09-01');

      expect(fetchMock().mock.calls[0][0]).toBe(
        'https://api.example.com/public/booking/park-vets/slots?serviceId=svc-1&date=2026-09-01'
      );
    });

    it('surfaces a failure with its status', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({ message: 'Outside window' }, 400));

      const error = await getPublicSlots('x', 'svc', '2026-09-01').catch((e) => e);
      expect(error.status).toBe(400);
      expect(error.message).toBe('Outside window');
    });
  });

  describe('submitBookingRequest', () => {
    const payload = {
      serviceId: 'svc-1',
      date: '2026-09-01',
      startTime: '09:00',
      ownerName: 'Sam',
      ownerEmail: 'sam@example.com',
      ownerPhone: null,
      petName: 'Rex',
      petSpecies: 'Dog',
      concern: null,
      consent: true as const,
    };

    it('posts the payload as JSON', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({}, 202));

      await expect(submitBookingRequest('park-vets', payload)).resolves.toBeUndefined();

      const init = fetchMock().mock.calls[0][1] as RequestInit;
      expect(init.method).toBe('POST');
      expect(JSON.parse(init.body as string)).toEqual(payload);
    });

    it('surfaces a taken slot as a 409', async () => {
      fetchMock().mockResolvedValueOnce(
        jsonResponse({ message: 'That time is no longer available' }, 409)
      );

      const error = await submitBookingRequest('x', payload).catch((e) => e);
      expect(error.status).toBe(409);
    });
  });

  describe('confirmBookingRequest', () => {
    it('posts the token and returns the practice', async () => {
      fetchMock().mockResolvedValueOnce(
        jsonResponse({ data: { practiceName: 'Park Vets', slug: 'park-vets' } })
      );

      await expect(confirmBookingRequest('tok')).resolves.toEqual({
        practiceName: 'Park Vets',
        slug: 'park-vets',
      });

      const init = fetchMock().mock.calls[0][1] as RequestInit;
      expect(JSON.parse(init.body as string)).toEqual({ token: 'tok' });
    });

    it('throws for an invalid link', async () => {
      fetchMock().mockResolvedValueOnce(jsonResponse({ message: 'Not found' }, 404));

      await expect(confirmBookingRequest('tok')).rejects.toBeInstanceOf(PublicBookingRequestError);
    });
  });

  it('tolerates an unset base URL rather than emitting "undefined" in the path', async () => {
    delete process.env.NEXT_PUBLIC_BASE_URL;
    fetchMock().mockResolvedValueOnce(jsonResponse({ data: { slug: 'x' } }));

    await getPublicPractice('x');

    expect(fetchMock().mock.calls[0][0]).toBe('/public/booking/x');
  });
});
