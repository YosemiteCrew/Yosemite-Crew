import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import type { PublicSite } from '@/app/features/websiteBuilder/services/practiceWebsite.service';
import SiteClient from './SiteClient';

/** The published practice website. Stubbed at `fetch`, like the booking page stories. */

const SITE: PublicSite = {
  templateId: 'alpine-clinic',
  headline: 'Caring for Berlin pets since 1998',
  tagline: 'Open late on weekdays.',
  about: 'We are a family practice of four vets and six nurses.',
  practice: {
    slug: 'avenger-park-veterinary',
    name: 'Avenger Park Veterinary',
    logoUrl: null,
    welcomeMessage: null,
    city: 'Berlin',
    country: 'DE',
    bookingWindowDays: 28,
    requiresConfirmation: true,
    services: [
      { id: 'svc-1', name: 'Wellness consultation', description: null, durationMinutes: 30 },
    ],
  },
};

const stub = (status: number) => {
  const realFetch = globalThis.fetch;
  globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    if (url.includes('/public/site/')) {
      const body = status === 200 ? { data: SITE } : { message: 'Site not found' };
      return Promise.resolve(
        new Response(JSON.stringify(body), {
          status,
          headers: { 'Content-Type': 'application/json' },
        })
      );
    }
    return realFetch(input, init);
  }) as typeof globalThis.fetch;
  return () => {
    globalThis.fetch = realFetch;
  };
};

const meta = {
  title: 'PublicBooking/SiteClient',
  component: SiteClient,
  parameters: {
    layout: 'fullscreen',
    nextjs: { appDirectory: true, navigation: { pathname: '/site/avenger-park-veterinary' } },
  },
  args: { slug: 'avenger-park-veterinary' },
  tags: ['autodocs'],
} satisfies Meta<typeof SiteClient>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Published: Story = {
  beforeEach: () => stub(200),
  play: async ({ canvas }) => {
    await expect(await canvas.findByRole('heading', { level: 1 })).toHaveTextContent(SITE.headline);
  },
};

export const Unavailable: Story = {
  beforeEach: () => stub(404),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('This website is not available')).toBeInTheDocument();
  },
};
