import { getData, patchData } from '@/app/services/axios';

/**
 * The practice's side of the public booking page: requests that a pet owner
 * submitted and then confirmed by email.
 *
 * Unconfirmed requests are not listable. The API refuses to return them, because
 * anyone can type anyone's address into a public form and an unconfirmed row is
 * an unverified claim.
 */
export type BookingRequestStatus = 'CONFIRMED' | 'DECLINED' | 'BOOKED';

export type BookingRequest = {
  id: string;
  serviceName: string;
  requestedStart: string;
  requestedEnd: string;
  durationMinutes: number;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string | null;
  petName: string;
  petSpecies: string;
  concern: string | null;
  status: BookingRequestStatus;
  confirmedAt: string | null;
  createdAt: string;
};

export const bookingRequestsApi = {
  async list(organisationId: string): Promise<BookingRequest[]> {
    const response = await getData<{ data: BookingRequest[] }>(
      `/v1/booking-page/${organisationId}/requests`
    );
    return response.data.data;
  },

  async setStatus(
    organisationId: string,
    requestId: string,
    status: 'DECLINED' | 'BOOKED'
  ): Promise<void> {
    await patchData(`/v1/booking-page/${organisationId}/requests/${requestId}`, { status });
  },
};
