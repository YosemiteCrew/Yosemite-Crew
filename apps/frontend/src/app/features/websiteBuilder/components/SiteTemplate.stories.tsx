import type { Meta, StoryObj } from '@storybook/react';
import { expect } from 'storybook/test';

import SiteTemplate from './SiteTemplate';

/** One story per template, with the same practice and copy, so the layouts compare directly. */

const PRACTICE = {
  name: 'Avenger Park Veterinary',
  city: 'Berlin',
  country: 'DE',
  services: [
    { id: 'svc-1', name: 'Wellness consultation', description: null, durationMinutes: 30 },
    { id: 'svc-2', name: 'Vaccination booster', description: null, durationMinutes: 20 },
    { id: 'svc-3', name: 'Dental scale and polish', description: null, durationMinutes: 90 },
  ],
};

const CONTENT = {
  headline: 'Caring for Berlin pets since 1998',
  tagline: 'Open late on weekdays, with same-day slots for poorly pets.',
  about:
    'We are a family practice of four vets and six nurses.\n\nEvery new patient gets a full nose-to-tail check on their first visit.',
};

const meta = {
  title: 'WebsiteBuilder/SiteTemplate',
  component: SiteTemplate,
  parameters: { layout: 'padded' },
  args: {
    content: { templateId: 'alpine-clinic', ...CONTENT },
    practice: PRACTICE,
    bookingHref: '/book/avenger-park-veterinary',
  },
  tags: ['autodocs'],
} satisfies Meta<typeof SiteTemplate>;

export default meta;
type Story = StoryObj<typeof meta>;

export const AlpineClinic: Story = {
  play: async ({ canvas }) => {
    await expect(canvas.getByRole('heading', { level: 1 })).toHaveTextContent(CONTENT.headline);
    await expect(canvas.getByRole('link', { name: 'Book an appointment' })).toHaveAttribute(
      'href',
      '/book/avenger-park-veterinary'
    );
  },
};

export const CityVets: Story = {
  args: { content: { templateId: 'city-vets', ...CONTENT } },
};

export const EquineEstate: Story = {
  args: { content: { templateId: 'equine-estate', ...CONTENT } },
};

export const PreviewWithoutBooking: Story = {
  name: 'Preview, booking not live',
  args: {
    content: {
      templateId: 'alpine-clinic',
      headline: 'Avenger Park Veterinary',
      tagline: null,
      about: null,
    },
    bookingHref: null,
  },
  play: async ({ canvas }) => {
    await expect(canvas.queryByRole('link', { name: 'Book an appointment' })).toBeNull();
  },
};
