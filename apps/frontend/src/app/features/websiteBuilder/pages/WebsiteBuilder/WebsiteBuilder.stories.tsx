import type { Meta, StoryObj } from '@storybook/react';
import { expect, userEvent, waitFor } from 'storybook/test';
import type { Organisation } from '@yosemite-crew/types';

import type { ServiceRevamp } from '@/app/features/organization/types/revamp';
import { useOrgStore } from '@/app/stores/orgStore';
import { useRevampCatalogStore } from '@/app/stores/revampCatalogStore';
import {
  practiceWebsiteApi,
  type PracticeWebsiteConfig,
} from '@/app/features/websiteBuilder/services/practiceWebsite.service';
import WebsiteBuilder from './WebsiteBuilder';

const ORG_ID = 'org-storybook-avenger-park';
const SPECIALITY_ID = 'spec-general-practice';

const ORG: Organisation = {
  _id: ORG_ID,
  name: 'Avenger Park Veterinary',
  type: 'HOSPITAL',
  phoneNo: '+493012345678',
  taxId: 'DE123456789',
};

const service = (over: Partial<ServiceRevamp>): ServiceRevamp => ({
  id: 'svc-1',
  code: 'GP-001',
  name: 'Wellness consultation',
  description: 'Nose-to-tail exam.',
  type: 'CONSULTATION',
  specialityId: SPECIALITY_ID,
  organisationId: ORG_ID,
  grossAmount: 72,
  currency: 'EUR',
  defaultDiscount: 0,
  maxDiscount: 10,
  durationMinutes: 30,
  isBookable: true,
  isInpatientPreferred: false,
  status: 'ACTIVE',
  createdAt: '2026-05-04T09:00:00.000Z',
  ...over,
});

const config = (over: Partial<PracticeWebsiteConfig> = {}): PracticeWebsiteConfig => ({
  organisationId: ORG_ID,
  configured: false,
  templateId: 'alpine-clinic',
  headline: 'Avenger Park Veterinary',
  tagline: null,
  about: null,
  published: false,
  publishedAt: null,
  slug: null,
  publicBookingEnabled: false,
  publicUrl: null,
  ...over,
});

/** Seeds the org and catalog stores and stubs the API, restoring all three afterwards. */
const seed = (stubbed: PracticeWebsiteConfig) => {
  const previousOrg = useOrgStore.getState();
  const previousCatalog = useRevampCatalogStore.getState();
  const previousGet = practiceWebsiteApi.getConfig;
  const previousSave = practiceWebsiteApi.saveConfig;

  practiceWebsiteApi.getConfig = async () => stubbed;
  practiceWebsiteApi.saveConfig = async (_id, payload) => ({ ...stubbed, ...payload });

  useOrgStore.setState({
    orgsById: { [ORG_ID]: ORG },
    orgIds: [ORG_ID],
    primaryOrgId: ORG_ID,
    status: 'loaded',
  });
  useRevampCatalogStore.setState({
    services: [
      service({}),
      service({ id: 'svc-2', name: 'Vaccination booster', durationMinutes: 20 }),
    ],
    specialities: [
      { id: SPECIALITY_ID, name: 'General Practice', organisationId: ORG_ID, teamMemberIds: [] },
    ],
    loadedSpecialityIds: [`${SPECIALITY_ID}:active`],
  });

  return () => {
    useOrgStore.setState(previousOrg);
    useRevampCatalogStore.setState(previousCatalog);
    practiceWebsiteApi.getConfig = previousGet;
    practiceWebsiteApi.saveConfig = previousSave;
  };
};

const meta = {
  title: 'WebsiteBuilder/WebsiteBuilder',
  component: WebsiteBuilder,
  parameters: { layout: 'fullscreen' },
  tags: ['autodocs'],
} satisfies Meta<typeof WebsiteBuilder>;

export default meta;
type Story = StoryObj<typeof meta>;

export const BookingNotLive: Story = {
  name: 'Draft, booking not live yet',
  beforeEach: () => seed(config()),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Set up online booking')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Publish website' })).toBeDisabled();
  },
};

export const ReadyToPublish: Story = {
  beforeEach: () =>
    seed(config({ configured: true, slug: 'avenger-park-veterinary', publicBookingEnabled: true })),
  play: async ({ canvas }) => {
    const headline = await canvas.findByLabelText('Headline');
    await userEvent.clear(headline);
    await userEvent.type(headline, 'Caring for Berlin pets');
    await waitFor(() =>
      expect(canvas.getAllByRole('heading', { level: 1 }).at(-1)).toHaveTextContent(
        'Caring for Berlin pets'
      )
    );
    await userEvent.click(canvas.getByLabelText(/City Vets/));
    await expect(canvas.getByRole('button', { name: 'Publish website' })).toBeEnabled();
  },
};

export const Live: Story = {
  beforeEach: () =>
    seed(
      config({
        configured: true,
        templateId: 'equine-estate',
        headline: 'Large-animal care across Brandenburg',
        tagline: 'Mobile visits seven days a week.',
        published: true,
        publishedAt: '2026-09-01T10:00:00.000Z',
        slug: 'avenger-park-veterinary',
        publicBookingEnabled: true,
        publicUrl: 'https://example.com/site/avenger-park-veterinary',
      })
    ),
  play: async ({ canvas }) => {
    await expect(await canvas.findByText('Live. Visitors can see this site.')).toBeInTheDocument();
    await expect(canvas.getByRole('button', { name: 'Unpublish' })).toBeEnabled();
  },
};
