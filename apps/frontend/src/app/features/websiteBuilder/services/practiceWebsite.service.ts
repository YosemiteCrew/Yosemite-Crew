import { getData, putData } from '@/app/services/axios';
import type { PublicPractice } from '@/app/features/publicBooking/services/publicBooking.service';
import type { WebsiteTemplateId } from '@/app/features/websiteBuilder/templates';

/** The words a practice writes for its site. */
export type WebsiteContent = {
  templateId: WebsiteTemplateId;
  headline: string;
  tagline: string | null;
  about: string | null;
};

/** The site as the editor sees it. `publicUrl` is null unless the site answers. */
export type PracticeWebsiteConfig = WebsiteContent & {
  organisationId: string;
  configured: boolean;
  published: boolean;
  publishedAt: string | null;
  slug: string | null;
  publicBookingEnabled: boolean;
  publicUrl: string | null;
};

export type PracticeWebsitePayload = WebsiteContent & { published: boolean };

/** The published site as a visitor sees it. */
export type PublicSite = WebsiteContent & { practice: PublicPractice };

export type PublicSiteResult =
  { kind: 'site'; site: PublicSite } | { kind: 'redirect'; slug: string };

type ConfigEnvelope = { data: PracticeWebsiteConfig };

export const practiceWebsiteApi = {
  async getConfig(organisationId: string): Promise<PracticeWebsiteConfig> {
    const response = await getData<ConfigEnvelope>(`/v1/practice-website/${organisationId}`);
    return response.data.data;
  },

  async saveConfig(
    organisationId: string,
    payload: PracticeWebsitePayload
  ): Promise<PracticeWebsiteConfig> {
    const response = await putData<ConfigEnvelope, PracticeWebsitePayload>(
      `/v1/practice-website/${organisationId}`,
      payload
    );
    return response.data.data;
  },
};

/** Thrown when the public site is not available, carrying the status. */
export class PublicSiteError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'PublicSiteError';
    this.status = status;
  }
}

const apiRoot = () => (process.env.NEXT_PUBLIC_BASE_URL ?? '').replace(/\/$/, '');

/**
 * Raw `fetch`, not the shared axios client: a visitor has no session, and the
 * authed client would send staff cookies and redirect a signed-out caller.
 */
export const getPublicSite = async (slug: string): Promise<PublicSiteResult> => {
  const response = await fetch(`${apiRoot()}/public/site/${encodeURIComponent(slug)}`, {
    headers: { Accept: 'application/json' },
  });

  if (!response.ok) {
    throw new PublicSiteError('This website is not available.', response.status);
  }

  const body = (await response.json()) as { data: PublicSite | { redirectTo: string } };
  if ('redirectTo' in body.data) {
    return { kind: 'redirect', slug: body.data.redirectTo };
  }
  return { kind: 'site', site: body.data };
};
