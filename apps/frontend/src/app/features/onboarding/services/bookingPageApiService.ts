import { getData, putData } from '@/app/services/axios';

/**
 * The practice's public booking page configuration, exactly as the API reports it.
 *
 * `publicUrl` is the field that matters here. The wizard used to build
 * `book.yosemitecrew.com/<slug>` in the browser from the practice name, which
 * meant it could render a copyable address for a page that did not exist and a
 * host with no DNS record. The address is now only ever a value the server sent,
 * and the server sends null until the page is genuinely reachable - so there is
 * no code path left that can invent one.
 */
export type BookingPageConfig = {
  organisationId: string;
  /**
   * Whether the practice has ever saved this setup. Distinguishes a deliberate
   * "no services offered publicly" from a practice that has never answered,
   * which both arrive as an empty `serviceIds`.
   */
  configured: boolean;
  slug: string | null;
  publicBookingEnabled: boolean;
  publicUrl: string | null;
  serviceIds: string[];
  bookingWindowDays: number;
  bufferMinutes: number;
  autoConfirm: boolean;
  welcomeMessage: string | null;
  replyToEmail: string | null;
};

export type BookingPageSettingsPayload = {
  serviceIds: string[];
  bookingWindowDays: number;
  bufferMinutes: number;
  autoConfirm: boolean;
  welcomeMessage: string | null;
  replyToEmail: string | null;
  /**
   * Whether `/book/<slug>` should answer. Optional on the wire: a caller that
   * omits it is saving settings, and saving settings must never publish a
   * practice as a side effect.
   */
  publicBookingEnabled?: boolean;
};

type ConfigEnvelope = { data: BookingPageConfig };

export const bookingPageApi = {
  async getConfig(organisationId: string): Promise<BookingPageConfig> {
    const response = await getData<ConfigEnvelope>(`/v1/booking-page/${organisationId}`);
    return response.data.data;
  },

  async saveConfig(
    organisationId: string,
    payload: BookingPageSettingsPayload
  ): Promise<BookingPageConfig> {
    const response = await putData<ConfigEnvelope, BookingPageSettingsPayload>(
      `/v1/booking-page/${organisationId}`,
      payload
    );
    return response.data.data;
  },
};
