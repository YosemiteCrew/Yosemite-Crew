/**
 * The pet owner's half of the booking page. No session, ever.
 *
 * Raw `fetch`, not the shared axios client, for the reason
 * `companionCard.service.ts` gives for its own public resolve: the authed
 * instance carries `withCredentials` and an interceptor that redirects a
 * signed-out caller to the sign-in page. Both are wrong here. A pet owner has no
 * account, and sending a staff member's session cookie to an endpoint that does
 * not want one is a habit worth not forming.
 */

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
};

export type PublicPractice = {
  slug: string;
  name: string;
  logoUrl: string | null;
  welcomeMessage: string | null;
  city: string | null;
  country: string | null;
  bookingWindowDays: number;
  requiresConfirmation: boolean;
  services: PublicService[];
};

/** A retired slug resolves to where the reader should go instead. */
export type PracticeResult =
  { kind: 'practice'; practice: PublicPractice } | { kind: 'redirect'; slug: string };

export type PublicSlot = { startTime: string; endTime: string };

export type PublicSlots = {
  date: string;
  serviceId: string;
  durationMinutes: number;
  windows: PublicSlot[];
};

export type BookingRequestPayload = {
  serviceId: string;
  date: string;
  startTime: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  petName: string;
  petSpecies: string;
  concern: string | null;
  consent: true;
};

const apiRoot = () => (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');

/**
 * Thrown for anything the API declined, carrying its status.
 *
 * The page distinguishes "this practice does not have a booking page" (404)
 * from "that time just went" (409) from everything else, and it can only do
 * that if the status survives the fetch.
 */
export class PublicBookingRequestError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PublicBookingRequestError';
    this.status = status;
  }
}

const readMessage = async (response: Response, fallback: string): Promise<string> => {
  try {
    const body = (await response.json()) as { message?: unknown };
    return typeof body.message === 'string' ? body.message : fallback;
  } catch {
    return fallback;
  }
};

export const getPublicPractice = async (slug: string): Promise<PracticeResult> => {
  const response = await fetch(`${apiRoot()}/public/booking/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new PublicBookingRequestError(
      await readMessage(response, 'This booking page is not available.'),
      response.status
    );
  }

  const body = (await response.json()) as {
    data: PublicPractice | { redirectTo: string };
  };

  if ('redirectTo' in body.data) {
    return { kind: 'redirect', slug: body.data.redirectTo };
  }
  return { kind: 'practice', practice: body.data };
};

export const getPublicSlots = async (
  slug: string,
  serviceId: string,
  date: string
): Promise<PublicSlots> => {
  const query = new URLSearchParams({ serviceId, date });
  const response = await fetch(
    `${apiRoot()}/public/booking/${encodeURIComponent(slug)}/slots?${query.toString()}`,
    { headers: { Accept: 'application/json' } }
  );

  if (!response.ok) {
    throw new PublicBookingRequestError(
      await readMessage(response, 'Could not load available times.'),
      response.status
    );
  }

  const body = (await response.json()) as { data: PublicSlots };
  return body.data;
};

export const submitBookingRequest = async (
  slug: string,
  payload: BookingRequestPayload
): Promise<void> => {
  const response = await fetch(`${apiRoot()}/public/booking/${encodeURIComponent(slug)}/requests`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new PublicBookingRequestError(
      await readMessage(response, 'Could not send your request.'),
      response.status
    );
  }
};

export const confirmBookingRequest = async (
  token: string
): Promise<{ practiceName: string; slug: string | null }> => {
  const response = await fetch(`${apiRoot()}/public/booking/requests/confirm`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ token }),
  });

  if (!response.ok) {
    throw new PublicBookingRequestError(
      await readMessage(response, 'This confirmation link is not valid.'),
      response.status
    );
  }

  const body = (await response.json()) as {
    data: { practiceName: string; slug: string | null };
  };
  return body.data;
};
